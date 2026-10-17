#!/usr/bin/env node
// Builds the static catalog snapshot (site/public/*.json + bodies/*.md) from the repository.
// Usage: node scripts/build-index.mjs [--root <dir>] [--out <dir>]
// Env fallbacks: MARKETPLACE_ROOT, INDEX_OUT.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const MARKETPLACE_NAME_FALLBACK = 'dev-digest-ai-marketplace';
const SEARCH_TEXT_LIMIT = 4000;
const KINDS = ['agent', 'skill', 'command', 'hook', 'mcp'];

class IndexError extends Error {}

function parseArgs(argv) {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(scriptDir, '..');
  const args = { root: process.env.MARKETPLACE_ROOT || repoRoot, out: process.env.INDEX_OUT || '' };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--root' || flag === '--out') {
      const value = argv[++i];
      if (!value) throw new IndexError(`${flag} needs a directory argument`);
      args[flag.slice(2)] = value;
    } else if (flag === '--help' || flag === '-h') {
      console.log('Usage: node scripts/build-index.mjs [--root <dir>] [--out <dir>]');
      process.exit(0);
    } else {
      throw new IndexError(`unknown argument: ${flag}`);
    }
  }
  args.root = resolve(args.root);
  args.out = resolve(args.out || join(repoRoot, 'site', 'public'));
  return args;
}

// ---------- frontmatter (YAML subset) ----------

function parseScalar(raw) {
  const value = raw.trim();
  if (value === '' || value === '~' || value === 'null') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.startsWith('[') && value.endsWith(']')) return splitInlineList(value.slice(1, -1));
  return stripComment(value);
}

function stripComment(value) {
  const idx = value.search(/\s#/);
  return idx === -1 ? value : value.slice(0, idx).trimEnd();
}

function splitInlineList(inner) {
  const items = [];
  let current = '';
  let quote = null;
  for (const ch of inner) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === ',') {
      items.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  items.push(current);
  return items.map((item) => parseScalar(item)).filter((item) => item !== null && item !== '');
}

const indentOf = (line) => line.length - line.trimStart().length;

export function parseFrontmatter(source) {
  const text = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (!match) return { data: {}, body: text };
  const lines = match[1].split('\n');
  const data = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#') || indentOf(line) > 0) {
      i++;
      continue;
    }
    const kv = /^([A-Za-z0-9_.-]+)\s*:(.*)$/.exec(line);
    if (!kv) {
      i++;
      continue;
    }
    const key = kv[1];
    const rest = kv[2].trim();
    const block = [];
    i++;
    while (i < lines.length && (lines[i].trim() === '' || indentOf(lines[i]) > 0 || /^-\s/.test(lines[i]))) {
      block.push(lines[i]);
      i++;
    }
    while (block.length && block[block.length - 1].trim() === '') block.pop();

    if (/^[|>][+-]?$/.test(rest)) {
      const content = dedent(block);
      data[key] = rest.startsWith('|') ? content.join('\n').trim() : foldLines(content);
    } else if (rest !== '') {
      const continuation = block.map((l) => l.trim()).filter(Boolean);
      data[key] = continuation.length && !/^["'[]/.test(rest)
        ? parseScalar([rest, ...continuation].join(' '))
        : parseScalar(rest);
    } else {
      const items = block.filter((l) => l.trim() !== '');
      if (items.length && items.every((l) => /^\s*-(\s|$)/.test(l))) {
        data[key] = items.map((l) => parseScalar(l.replace(/^\s*-\s?/, ''))).filter((v) => v !== null);
      } else {
        data[key] = null;
      }
    }
  }
  return { data, body: text.slice(match[0].length) };
}

function dedent(lines) {
  const indents = lines.filter((l) => l.trim()).map(indentOf);
  const min = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(min));
}

function foldLines(lines) {
  return lines.reduce((acc, line) => {
    if (line.trim() === '') return `${acc}\n`;
    if (acc === '' || acc.endsWith('\n')) return acc + line.trim();
    return `${acc} ${line.trim()}`;
  }, '').trim();
}

// ---------- helpers ----------

function readText(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function readJson(path, label) {
  const text = readText(path);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new IndexError(`${label}: invalid JSON (${err.message})`);
  }
}

const toPosix = (p) => p.split(sep).join('/');
const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function toList(value) {
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  const items = [];
  let current = '';
  let depth = 0;
  for (const ch of value) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && (ch === ',' || /\s/.test(ch))) {
      items.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  items.push(current);
  return items.map((v) => v.trim()).filter(Boolean);
}

function personName(value) {
  if (typeof value === 'string') return str(value);
  if (value && typeof value === 'object') return str(value.name);
  return null;
}

function listFiles(dir, base = dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === '.DS_Store' || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else if (entry.isFile()) out.push(toPosix(relative(base, full)));
  }
  return out;
}

function markdownFiles(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.md') && f.toLowerCase() !== 'readme.md')
    .sort();
}

export function toPlainText(markdown) {
  return (markdown || '')
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/```[^\n]*\n/g, '\n')
    .replace(/```/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^[ \t]*(#{1,6}|>|[-*+]|\d+\.)[ \t]+/gm, '')
    .replace(/[*_`~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SEARCH_TEXT_LIMIT);
}

function safeFileName(...parts) {
  return `${parts.map((p) => String(p).replace(/[^A-Za-z0-9._-]+/g, '-')).join('--')}.md`;
}

function compareVersionsDesc(a, b) {
  const pa = String(a).split(/[.+-]/).map((x) => (Number.isNaN(Number(x)) ? x : Number(x)));
  const pb = String(b).split(/[.+-]/).map((x) => (Number.isNaN(Number(x)) ? x : Number(x)));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x === y) continue;
    if (typeof x === 'number' && typeof y === 'number') return y - x;
    return String(y).localeCompare(String(x));
  }
  return 0;
}

function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

function repoSlug(root) {
  const pkg = readJson(join(root, 'package.json'), 'package.json');
  const repo = pkg?.repository;
  const raw = typeof repo === 'string' ? repo : repo?.url;
  if (raw) {
    const m = /(?:github:|github\.com[/:])?([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(raw.trim());
    if (m) return m[1];
  }
  return process.env.GITHUB_REPOSITORY || null;
}

// ---------- changelog / compatibility ----------

export function parseChangelog(markdown) {
  const releases = [];
  const lines = (markdown || '').replace(/\r\n?/g, '\n').split('\n');
  let current = null;
  const heading = /^##\s+\[?v?([0-9][^\]\s]*)\]?(?:\s*[-–—]\s*(\d{4}-\d{2}-\d{2}))?/;
  for (const line of lines) {
    if (/^##\s/.test(line)) {
      if (current) releases.push(current);
      const m = heading.exec(line);
      current = m ? { version: m[1], date: m[2] || null, lines: [] } : null;
    } else if (/^#\s/.test(line)) {
      if (current) releases.push(current);
      current = null;
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) releases.push(current);
  return releases.map(({ version, date, lines: body }) => ({ version, date, notes: body.join('\n').trim() }));
}

function parseCompatibility(markdown) {
  if (!markdown) return null;
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((l) => /^##\s+Requires\b/i.test(l.trim()));
  if (start === -1) return null;
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    const text = line.trim().replace(/^[-*+]\s+/, '').trim();
    if (text) return text;
  }
  return null;
}

// ---------- artifacts ----------

function collectArtifacts(plugin, pluginDir, relDir, manifest) {
  const artifacts = [];

  for (const file of markdownFiles(join(pluginDir, 'agents'))) {
    const { data, body } = parseFrontmatter(readFileSync(join(pluginDir, 'agents', file), 'utf8'));
    const name = str(data.name) || basename(file, '.md');
    artifacts.push({
      kind: 'agent', name, data, body,
      model: str(data.model),
      tools: toList(data.tools),
      invoke: `@${plugin}:${name}`,
      path: `${relDir}/agents/${file}`,
      files: [],
    });
  }

  const skillsDir = join(pluginDir, 'skills');
  if (existsSync(skillsDir)) {
    for (const dir of readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
      const skillFile = join(skillsDir, dir, 'SKILL.md');
      if (!existsSync(skillFile)) {
        console.warn(`warn: ${relDir}/skills/${dir} has no SKILL.md, skipped`);
        continue;
      }
      const { data, body } = parseFrontmatter(readFileSync(skillFile, 'utf8'));
      const name = str(data.name) || dir;
      artifacts.push({
        kind: 'skill', name, data, body,
        model: null,
        tools: toList(data['allowed-tools']),
        manual: data['disable-model-invocation'] === true,
        invoke: `/${plugin}:${name}`,
        path: `${relDir}/skills/${dir}/SKILL.md`,
        files: listFiles(join(skillsDir, dir)),
      });
    }
  }

  for (const file of markdownFiles(join(pluginDir, 'commands'))) {
    const { data, body } = parseFrontmatter(readFileSync(join(pluginDir, 'commands', file), 'utf8'));
    const name = basename(file, '.md');
    artifacts.push({
      kind: 'command', name, data, body,
      model: null,
      tools: toList(data['allowed-tools']),
      invoke: `/${plugin}:${name}`,
      path: `${relDir}/commands/${file}`,
      files: [],
    });
  }

  const hooksRel = typeof manifest.hooks === 'string' ? manifest.hooks.replace(/^\.\//, '') : 'hooks/hooks.json';
  const hooksJson = readJson(join(pluginDir, hooksRel), `${relDir}/${hooksRel}`);
  const hookEvents = hooksJson?.hooks && typeof hooksJson.hooks === 'object' ? hooksJson.hooks : {};
  for (const [event, entries] of Object.entries(hookEvents)) {
    const list = Array.isArray(entries) ? entries : [];
    const summary = list.map((entry) => {
      const matcher = str(entry?.matcher);
      const commands = (Array.isArray(entry?.hooks) ? entry.hooks : [])
        .map((h) => str(h?.command) || str(h?.prompt) || str(h?.type))
        .filter(Boolean);
      return `${matcher ? `[${matcher}] ` : ''}${commands.join(', ')}`.trim();
    }).filter(Boolean);
    artifacts.push({
      kind: 'hook', name: event, id: `${plugin}:hook:${event}`,
      data: { description: summary.length ? `${event}: ${summary.join('; ')}` : `${event} hook` },
      body: `Event \`${event}\`\n\n\`\`\`json\n${JSON.stringify(list, null, 2)}\n\`\`\`\n`,
      model: null, tools: [], invoke: null,
      path: `${relDir}/${hooksRel}`,
      files: [],
    });
  }

  const inlineMcp = typeof manifest.mcpServers === 'object' && manifest.mcpServers !== null;
  const mcpRel = inlineMcp
    ? '.claude-plugin/plugin.json'
    : (typeof manifest.mcpServers === 'string' ? manifest.mcpServers : '.mcp.json').replace(/^\.\//, '');
  const mcpJson = inlineMcp ? { mcpServers: manifest.mcpServers } : readJson(join(pluginDir, mcpRel), `${relDir}/${mcpRel}`);
  const servers = mcpJson ? (mcpJson.mcpServers && typeof mcpJson.mcpServers === 'object' ? mcpJson.mcpServers : mcpJson) : {};
  for (const [server, config] of Object.entries(servers)) {
    if (!config || typeof config !== 'object') continue;
    const launch = [config.command, ...(Array.isArray(config.args) ? config.args : [])].filter(Boolean).join(' ') || str(config.url) || '';
    artifacts.push({
      kind: 'mcp', name: server, id: `${plugin}:mcp:${server}`,
      data: { description: str(config.description) || `MCP server${launch ? `: ${launch}` : ''}` },
      body: `MCP server \`${server}\`\n\n\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\`\n`,
      model: null, tools: [], invoke: null,
      path: `${relDir}/${mcpRel}`,
      files: [],
    });
  }

  return artifacts;
}

// ---------- main ----------

function resolveSource(root, entry, pluginRoot) {
  const source = entry.source;
  if (typeof source !== 'string') return null;
  if (source.startsWith('./') || source.startsWith('../') || source.startsWith('/')) return resolve(root, source);
  return resolve(root, pluginRoot || '.', source);
}

function build({ root, out }) {
  const warnings = [];
  const warn = (msg) => {
    warnings.push(msg);
    console.warn(`warn: ${msg}`);
  };

  const marketplacePath = join(root, '.claude-plugin', 'marketplace.json');
  const marketplace = readJson(marketplacePath, '.claude-plugin/marketplace.json');
  if (!marketplace) warn(`${marketplacePath} not found, writing an empty index`);

  const mpName = str(marketplace?.name) || MARKETPLACE_NAME_FALLBACK;
  const entries = Array.isArray(marketplace?.plugins) ? marketplace.plugins : [];
  const tags = new Set((git(root, ['tag', '--list', '*--v*']) || '').split('\n').map((t) => t.trim()).filter(Boolean));
  const errors = [];
  const plugins = [];
  const artifacts = [];
  const releases = [];
  const bodies = new Map();
  const seenIds = new Set();

  for (const entry of entries) {
    const entryName = str(entry?.name);
    if (!entryName) {
      errors.push('marketplace.json: a plugin entry has no "name"');
      continue;
    }
    const pluginDir = resolveSource(root, entry, marketplace?.metadata?.pluginRoot);
    if (!pluginDir) {
      warn(`${entryName}: source is not a local path, skipped`);
      continue;
    }
    const manifestPath = join(pluginDir, '.claude-plugin', 'plugin.json');
    if (!existsSync(pluginDir)) {
      errors.push(`${entryName}: source ${entry.source} does not exist`);
      continue;
    }
    if (!existsSync(manifestPath)) {
      errors.push(`${entryName}: ${toPosix(relative(root, manifestPath))} is missing`);
      continue;
    }
    const manifest = readJson(manifestPath, toPosix(relative(root, manifestPath)));
    if (str(manifest.name) !== entryName) {
      errors.push(`${entryName}: marketplace entry name does not match plugin.json name "${manifest.name}"`);
      continue;
    }

    const name = entryName;
    const relDir = toPosix(relative(root, pluginDir));
    const readme = readText(join(pluginDir, 'README.md'));
    const changelog = readText(join(pluginDir, 'CHANGELOG.md'));
    const readmeBody = readme === null ? null : parseFrontmatter(readme).body;
    const readmeFile = safeFileName('plugin', name);
    bodies.set(readmeFile, readmeBody ?? `# ${name}\n\n_No README.md in this plugin._\n`);
    let changelogFile = null;
    if (changelog !== null) {
      changelogFile = safeFileName('changelog', name);
      bodies.set(changelogFile, changelog);
    }

    const dependencies = (Array.isArray(manifest.dependencies) ? manifest.dependencies : [])
      .map((dep) => {
        if (typeof dep === 'string') {
          const at = dep.lastIndexOf('@');
          return at > 0 ? { name: dep.slice(0, at), version: dep.slice(at + 1) } : { name: dep, version: null };
        }
        return dep && str(dep.name) ? { name: dep.name.trim(), version: str(dep.version) } : null;
      })
      .filter(Boolean);

    const pluginArtifacts = collectArtifacts(name, pluginDir, relDir, manifest).map((a) => {
      const id = a.id || `${name}:${a.name}`;
      const bodyFile = safeFileName(a.kind, name, a.name);
      bodies.set(bodyFile, a.body);
      return {
        id,
        kind: a.kind,
        name: a.name,
        plugin: name,
        description: str(a.data.description) || '',
        model: a.kind === 'agent' ? a.model : null,
        tools: a.tools,
        manual: a.kind === 'skill' ? Boolean(a.manual) : false,
        invoke: a.invoke,
        path: a.path,
        body: `bodies/${bodyFile}`,
        files: a.files,
        text: toPlainText(a.body),
      };
    });

    for (const a of pluginArtifacts) {
      if (seenIds.has(a.id)) errors.push(`${name}: duplicate artifact id ${a.id}`);
      else {
        seenIds.add(a.id);
        artifacts.push(a);
      }
    }

    const version = str(manifest.version) || str(entry.version);
    if (!version) warn(`${name}: no version in plugin.json`);

    plugins.push({
      name,
      version,
      description: str(manifest.description) || str(entry.description) || '',
      author: personName(manifest.author) || personName(entry.author),
      license: str(manifest.license) || str(entry.license),
      keywords: toList(manifest.keywords ?? entry.keywords ?? entry.tags),
      category: str(entry.category),
      source: typeof entry.source === 'string' ? entry.source : `./${relDir}`,
      dependencies,
      dependents: [],
      compatibility: parseCompatibility(readText(join(pluginDir, 'COMPATIBILITY.md'))),
      install: `/plugin install ${name}@${mpName}`,
      readme: `bodies/${readmeFile}`,
      changelog: changelogFile ? `bodies/${changelogFile}` : null,
      artifacts: pluginArtifacts.map((a) => a.id),
      text: toPlainText(readmeBody || ''),
    });

    for (const release of parseChangelog(changelog)) {
      const tag = `${name}--v${release.version}`;
      releases.push({ plugin: name, version: release.version, date: release.date, tag, tagged: tags.has(tag), notes: release.notes });
    }
  }

  if (errors.length) {
    throw new IndexError(`marketplace index failed:\n  - ${errors.join('\n  - ')}`);
  }

  const byName = new Map(plugins.map((p) => [p.name, p]));
  let edges = 0;
  for (const plugin of plugins) {
    for (const dep of plugin.dependencies) {
      edges++;
      const target = byName.get(dep.name);
      if (target) target.dependents.push(plugin.name);
      else warn(`${plugin.name}: dependency "${dep.name}" is not in this marketplace`);
    }
  }
  for (const plugin of plugins) plugin.dependents.sort();

  releases.sort((a, b) => (b.date || '').localeCompare(a.date || '') || compareVersionsDesc(a.version, b.version) || a.plugin.localeCompare(b.plugin));

  const generatedAt = new Date().toISOString();
  const commit = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : git(root, ['rev-parse', '--short', 'HEAD']);
  const index = {
    generatedAt,
    commit: commit || null,
    marketplace: {
      name: mpName,
      owner: personName(marketplace?.owner),
      repo: repoSlug(root),
      description: str(marketplace?.description) || str(marketplace?.metadata?.description) || '',
    },
    plugins,
    artifacts,
  };
  const count = (kind) => artifacts.filter((a) => a.kind === kind).length;
  const latest = releases[0];
  const stats = {
    plugins: plugins.length,
    agents: count('agent'),
    skills: count('skill'),
    commands: count('command'),
    hooks: count('hook'),
    mcp: count('mcp'),
    artifacts: artifacts.length,
    dependencyEdges: edges,
    latestRelease: latest ? { plugin: latest.plugin, version: latest.version, date: latest.date } : null,
    generatedAt,
  };

  mkdirSync(out, { recursive: true });
  const bodiesDir = join(out, 'bodies');
  rmSync(bodiesDir, { recursive: true, force: true });
  mkdirSync(bodiesDir, { recursive: true });
  for (const [file, content] of bodies) writeFileSync(join(bodiesDir, file), content);
  writeFileSync(join(out, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  writeFileSync(join(out, 'releases.json'), `${JSON.stringify(releases, null, 2)}\n`);
  writeFileSync(join(out, 'stats.json'), `${JSON.stringify(stats, null, 2)}\n`);

  const kindSummary = KINDS.map((k) => `${count(k)} ${k}`).join(', ');
  console.log(`index: ${plugins.length} plugins, ${kindSummary}, ${releases.length} releases -> ${toPosix(relative(process.cwd(), out)) || '.'}`);
  if (warnings.length) console.log(`index: ${warnings.length} warning(s)`);
}

try {
  build(parseArgs(process.argv.slice(2)));
} catch (err) {
  if (err instanceof IndexError) {
    console.error(`build-index: ${err.message}`);
    process.exit(1);
  }
  throw err;
}
