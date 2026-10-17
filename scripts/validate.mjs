#!/usr/bin/env node
// Repository rules that `claude plugin validate` does not check. Zero dependencies.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const fail = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const RANGE = /^[\^~]?\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$|^>=\d+\.\d+\.\d+( <\d+\.\d+\.\d+)?$/;
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TEXT_EXT = /\.(md|json|ya?ml|sh|mjs|cjs|js|ts|py|txt|tsv)$/;

const FORBIDDEN = [
  { re: /\/home\/[a-z_][\w-]*\//, why: 'absolute home path' },
  { re: /\/Users\/[A-Za-z][\w-]*\//, why: 'absolute macOS home path' },
  { re: /[A-Z]:\\Users\\/, why: 'absolute Windows path' },
  { re: /\$\{?CLAUDE_PROJECT_DIR\}?\/\.claude\/(agents|skills)\//, why: 'plugin file referenced through the project dir — use ${CLAUDE_PLUGIN_ROOT} or ${CLAUDE_SKILL_DIR}' },
  { re: /@devdigest\/|reviewer-core\/|dev-digest\/(server|client)/i, why: 'DevDigest product path' },
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, why: 'private key' },
  { re: /\b(sk-ant-[A-Za-z0-9-]{20,}|sk-[A-Za-z0-9]{32,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/, why: 'credential-like token' },
];

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    fail(rel(file), `invalid JSON — ${e.message}`);
    return null;
  }
};
const rel = (p) => relative(root, p) || '.';

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'results' || entry === '.git') continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function frontmatter(file) {
  const text = readFileSync(file, 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (kv) data[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return data;
}

// --- marketplace -----------------------------------------------------------
const mpFile = join(root, '.claude-plugin/marketplace.json');
if (!existsSync(mpFile)) {
  fail('.claude-plugin/marketplace.json', 'missing');
  report();
}
const mp = readJson(mpFile) ?? { plugins: [] };
if (!NAME.test(mp.name ?? '')) fail(rel(mpFile), `marketplace name "${mp.name}" must be kebab-case`);
if (!mp.owner?.name) fail(rel(mpFile), 'owner.name is required');

const plugins = new Map();
const seen = new Set();
for (const entry of mp.plugins ?? []) {
  if (seen.has(entry.name)) fail(rel(mpFile), `duplicate plugin entry "${entry.name}"`);
  seen.add(entry.name);
  if (typeof entry.source !== 'string' || !entry.source.startsWith('./plugins/')) {
    fail(rel(mpFile), `"${entry.name}": source must be a relative path under ./plugins/`);
    continue;
  }
  const dir = join(root, entry.source);
  const manifestFile = join(dir, '.claude-plugin/plugin.json');
  if (!existsSync(manifestFile)) {
    fail(rel(mpFile), `"${entry.name}": ${entry.source}/.claude-plugin/plugin.json not found`);
    continue;
  }
  const manifest = readJson(manifestFile);
  if (!manifest) continue;
  if (manifest.name !== entry.name) fail(rel(manifestFile), `name "${manifest.name}" differs from the marketplace entry "${entry.name}"`);
  if (entry.version && entry.version !== manifest.version) fail(rel(mpFile), `"${entry.name}": version duplicated and different from plugin.json — keep it in plugin.json only`);
  plugins.set(entry.name, { dir, manifest, manifestFile });
}

for (const dir of existsSync(join(root, 'plugins')) ? readdirSync(join(root, 'plugins')) : []) {
  if (!seen.has(dir)) fail(`plugins/${dir}`, 'not registered in marketplace.json');
}

// --- each plugin -----------------------------------------------------------
const codeowners = existsSync(join(root, 'CODEOWNERS')) ? readFileSync(join(root, 'CODEOWNERS'), 'utf8') : '';

for (const [name, { dir, manifest, manifestFile }] of plugins) {
  const mf = rel(manifestFile);
  if (!NAME.test(name)) fail(mf, `plugin name "${name}" must be kebab-case`);
  if (!SEMVER.test(manifest.version ?? '')) fail(mf, `version "${manifest.version}" is not SemVer`);
  if (!manifest.description) fail(mf, 'description is required');
  if (!manifest.author?.name) warn(mf, 'author.name is missing');
  if (!manifest.license) warn(mf, 'license is missing');

  for (const required of ['README.md', 'CHANGELOG.md', 'COMPATIBILITY.md']) {
    if (!existsSync(join(dir, required))) fail(rel(dir), `${required} is required`);
  }
  const changelog = existsSync(join(dir, 'CHANGELOG.md')) ? readFileSync(join(dir, 'CHANGELOG.md'), 'utf8') : '';
  if (manifest.version && !changelog.includes(`## [${manifest.version}]`)) {
    fail(`${rel(dir)}/CHANGELOG.md`, `no "## [${manifest.version}]" entry for the manifest version`);
  }
  if (!new RegExp(`^/plugins/${name}/\\s`, 'm').test(codeowners)) fail('CODEOWNERS', `no owner line for /plugins/${name}/`);

  for (const dep of manifest.dependencies ?? []) {
    const depName = typeof dep === 'string' ? dep : dep.name;
    const range = typeof dep === 'string' ? undefined : dep.version;
    if (!plugins.has(depName)) fail(mf, `dependency "${depName}" is not in this marketplace`);
    if (range && !RANGE.test(range)) fail(mf, `dependency "${depName}" range "${range}" is not supported (^x.y.z, ~x.y.z, x.y.z, >=x.y.z)`);
    if (range && plugins.has(depName) && !satisfies(plugins.get(depName).manifest.version, range)) {
      fail(mf, `dependency "${depName}@${range}" is not satisfied by the current ${depName}@${plugins.get(depName).manifest.version}`);
    }
  }

  for (const file of walk(dir)) {
    const r = rel(file);
    if (/(^|\/)\.env(\..*)?$/.test(r) && !r.endsWith('.env.example')) fail(r, '.env file must not be committed');
    if (!TEXT_EXT.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const { re, why } of FORBIDDEN) {
      const m = re.exec(text);
      if (m) {
        const line = text.slice(0, m.index).split('\n').length;
        fail(`${r}:${line}`, `${why} (${m[0].slice(0, 60)})`);
      }
    }
    if (/\/(agents)\/[^/]+\.md$/.test(r) && !r.endsWith('README.md')) checkAgent(file, name);
    if (/\/skills\/[^/]+\/SKILL\.md$/.test(r)) checkSkill(file, name);
  }
  checkCrossRefs(dir, name, manifest);
}

function checkAgent(file, plugin) {
  const fm = frontmatter(file);
  const r = rel(file);
  if (!fm) return fail(r, 'agent has no frontmatter');
  if (!fm.name || !NAME.test(fm.name)) fail(r, 'agent name missing or not kebab-case');
  if (!fm.description) fail(r, 'agent description missing');
  for (const key of ['hooks', 'mcpServers', 'permissionMode']) {
    if (key in fm) fail(r, `"${key}" is ignored in plugin agents — move it to the plugin's hooks/hooks.json or drop it`);
  }
  if (!fm.tools) warn(r, 'agent has no tools allowlist — it inherits every tool');
}

function checkSkill(file, plugin) {
  const fm = frontmatter(file);
  const r = rel(file);
  if (!fm) return fail(r, 'skill has no frontmatter');
  const dirName = file.split('/').at(-2);
  if (fm.name && fm.name !== dirName) fail(r, `skill name "${fm.name}" differs from its directory "${dirName}"`);
  if (!fm.description) fail(r, 'skill description missing');
  if ((fm.description ?? '').length > 1024) warn(r, 'description longer than 1024 chars');
  const text = readFileSync(file, 'utf8');
  if (/\bnode \.claude\/skills\/|bash \.claude\/skills\//.test(text)) fail(r, 'script referenced by a project path — use ${CLAUDE_SKILL_DIR}');
}

// A namespaced reference "<plugin>:<name>" must name a plugin this one depends on (or itself),
// and that plugin must ship the component.
function checkCrossRefs(dir, plugin, manifest) {
  const allowed = new Set([plugin, ...(manifest.dependencies ?? []).map((d) => (typeof d === 'string' ? d : d.name))]);
  for (const file of walk(dir)) {
    if (!/\.(md|json)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\b([a-z0-9]+(?:-[a-z0-9]+)+):([a-z0-9]+(?:-[a-z0-9]+)*)\b/g)) {
      const [ref, refPlugin, component] = m;
      if (!plugins.has(refPlugin)) continue;
      const line = text.slice(0, m.index).split('\n').length;
      if (!allowed.has(refPlugin)) {
        fail(`${rel(file)}:${line}`, `references ${ref} but ${plugin} does not depend on ${refPlugin}`);
        continue;
      }
      const target = plugins.get(refPlugin).dir;
      const exists =
        existsSync(join(target, 'skills', component, 'SKILL.md')) ||
        existsSync(join(target, 'agents', `${component}.md`)) ||
        existsSync(join(target, 'commands', `${component}.md`));
      if (!exists) fail(`${rel(file)}:${line}`, `references ${ref}, which ${refPlugin} does not ship`);
    }
  }
}

function satisfies(version, range) {
  const parse = (v) => v.replace(/^[\^~>=\s]+/, '').split('-')[0].split('.').map(Number);
  const [a, b, c] = parse(version);
  const [x, y, z] = parse(range);
  const gte = a > x || (a === x && (b > y || (b === y && c >= z)));
  if (range.startsWith('^')) return gte && (x === 0 ? a === 0 && b === y : a === x);
  if (range.startsWith('~')) return gte && a === x && b === y;
  if (range.startsWith('>=')) return gte;
  return a === x && b === y && c === z;
}

function report() {
  for (const w of warnings) console.log(`WARN  ${w}`);
  for (const e of errors) console.log(`FAIL  ${e}`);
  console.log(`\n${plugins?.size ?? 0} plugins · ${errors.length} errors · ${warnings.length} warnings`);
  process.exit(errors.length ? 1 : 0);
}
report();
