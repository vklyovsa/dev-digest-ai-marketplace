import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const PROFILE_PATH = '.claude/sdd-profile.md';

export const DEFAULTS = {
  specs_dir: 'specs',
  insights_files: ['INSIGHTS.md'],
  retro_dir: 'docs/retro/ledger',
  skill_routing: 'engineering-paved-path:skill-routing',
};

const unquote = (s) => s.trim().replace(/^(["'])(.*)\1$/, '$2');
const cleanDir = (s) => String(s).trim().replace(/^\.\//, '').replace(/\/+$/, '');

export function parseProfileText(text) {
  const fence = /```ya?ml[^\n]*\n([\s\S]*?)```/.exec(text);
  if (!fence) return {};
  const out = {};
  let listKey = null;
  for (const raw of fence[1].split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').replace(/\s+$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item) {
      if (listKey) out[listKey].push(unquote(item[1]));
      continue;
    }
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, key, value] = kv;
    if (value === '') {
      out[key] = [];
      listKey = key;
      continue;
    }
    listKey = null;
    out[key] = /^\[.*\]$/.test(value)
      ? value.slice(1, -1).split(',').map(unquote).filter(Boolean)
      : unquote(value);
  }
  return out;
}

const asList = (v) => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);

export function loadProfile(root) {
  const file = join(root, PROFILE_PATH);
  const present = existsSync(file);
  const raw = present ? parseProfileText(readFileSync(file, 'utf8')) : {};
  const specsDir = cleanDir(raw.specs_dir || DEFAULTS.specs_dir);
  const packages = asList(raw.packages).map(cleanDir).filter(Boolean);
  return {
    file: present ? PROFILE_PATH : null,
    raw,
    specsDir,
    specTemplate: typeof raw.spec_template === 'string' && raw.spec_template ? raw.spec_template : null,
    checkCommand: typeof raw.check_command === 'string' && raw.check_command ? raw.check_command : null,
    packages,
    insightsFiles: asList(raw.insights_files).length ? asList(raw.insights_files) : DEFAULTS.insights_files,
    architectureDocs: asList(raw.architecture_docs),
    skillRouting: (typeof raw.skill_routing === 'string' && raw.skill_routing) || DEFAULTS.skill_routing,
    protectedPaths: asList(raw.protected_paths),
    retroDir: cleanDir(raw.retro_dir || DEFAULTS.retro_dir),
    specDirs: [specsDir, ...packages.map((p) => `${p}/${specsDir}`)],
  };
}

// gitignore-like: a pattern without a slash matches at any depth; `dir/` and `dir/**` match everything below.
export function globToRegExp(pattern) {
  let p = cleanDir(pattern.replace(/\/\*\*$/, '/'));
  const anyDepth = !p.includes('/');
  let src = '';
  for (let i = 0; i < p.length; i += 1) {
    const ch = p[i];
    if (ch === '*') {
      if (p[i + 1] === '*' && p[i + 2] === '/') {
        src += '(?:.*/)?';
        i += 2;
      } else if (p[i + 1] === '*') {
        src += '.*';
        i += 1;
      } else src += '[^/]*';
    } else if (ch === '?') src += '[^/]';
    else src += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${anyDepth ? '(?:.*/)?' : ''}${src}(?:/.*)?$`);
}
