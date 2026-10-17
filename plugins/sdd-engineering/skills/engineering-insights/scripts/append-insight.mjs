#!/usr/bin/env node
// Appends one entry to a section of an insights file, newest first. Append-only by construction:
// the result is verified to keep every existing line.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';

const SECTIONS = [
  'What Works',
  "What Doesn't Work",
  'Codebase Patterns',
  'Tool & Library Notes',
  'Recurring Errors & Fixes',
  'Session Notes',
  'Open Questions',
];

const USAGE = `append-insight.mjs — append one entry to an insights file section, newest first.

  append-insight.mjs --file <path> --section "<heading>" [--dry-run] [--create]

The entry body is read from stdin. <path> is relative to the project root.
--create   start the file with the seven empty sections when it does not exist — only when the
           user asked for an insights file; otherwise a missing file is an error.

Sections: ${SECTIONS.map((s) => `"${s}"`).join(' · ')}

Example:
  printf '%s\\n' \\
    '- **Migrations never run on boot.** A fresh DB fails at route level with' \\
    '  \`relation ... does not exist\`, not at startup.' \\
    '  → Run the migrate script before reading the code.' \\
  | node append-insight.mjs --file INSIGHTS.md --section "Recurring Errors & Fixes"`;

const die = (msg) => {
  process.stderr.write(`append-insight: ${msg}\n`);
  process.exit(1);
};

const args = process.argv.slice(2);
let file = '';
let section = '';
let dryRun = false;
let create = false;
for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === '--file') file = args[(i += 1)] ?? '';
  else if (a === '--section') section = args[(i += 1)] ?? '';
  else if (a === '--dry-run') dryRun = true;
  else if (a === '--create') create = true;
  else if (a === '-h' || a === '--help') {
    console.log(USAGE);
    process.exit(0);
  } else {
    process.stderr.write(`append-insight: unknown argument '${a}'\n${USAGE}\n`);
    process.exit(2);
  }
}
if (!section) die('--section is required');
if (!file) die('--file is required');

function projectRoot() {
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return process.cwd();
  }
}

const root = resolve(projectRoot());
const target = isAbsolute(file) ? resolve(file) : resolve(root, file);
const rel = relative(root, target);
if (rel.startsWith('..') || isAbsolute(rel)) die(`${file} is outside the project directory`);
if (!/(^|\/)[^/]+\.md$/.test(rel)) die(`${file} is not a markdown file`);

if (!existsSync(target)) {
  if (!create) die(`no such file: ${rel}. Agents skip a missing insights file; pass --create only when the user asked to start one.`);
  if (!SECTIONS.includes(section)) die(`unknown section '${section}'`);
}

const original = existsSync(target)
  ? readFileSync(target, 'utf8')
  : `# Insights\n\nWhat a future session would otherwise have to rediscover. Newest entries first.\n\n${SECTIONS.map((s) => `## ${s}\n\n_None yet._\n`).join('\n')}`;
const lines = original.replace(/\n$/, '').split('\n');

if (!lines.some((l) => l.replace(/\s+$/, '') === `## ${section}`)) {
  const available = lines.filter((l) => l.startsWith('## ')).join('\n');
  die(`'${rel}' has no section '## ${section}'. Available:\n${available}`);
}

const raw = readFileSync(0, 'utf8').split('\n');
while (raw.length && !/\S/.test(raw.at(-1))) raw.pop();
const entry = raw;
if (!entry.length || !entry.some((l) => /\S/.test(l))) die('the entry body was empty (it is read from stdin)');
if (entry.length > 12) die(`entry is ${entry.length} lines. An insight is 1-3 lines (a Session Note, 2-4). Trim it, or it is a task log, not an insight.`);

const first = entry[0];
if (section === 'Session Notes') {
  if (!/^### \d{4}-\d{2}-\d{2}/.test(first)) die(`a Session Note must start with '### YYYY-MM-DD — topic' (today's real date from \`date +%F\`); got: ${first}`);
} else if (!first.startsWith('- ')) die(`an entry in '${section}' must start with '- **Claim.**'; got: ${first}`);

const firstTrimmed = first.replace(/\s+$/, '');
if (lines.some((l) => l === firstTrimmed)) {
  die(`that first line is already in ${rel} verbatim. Read the section before appending; if it needs correcting, append a dated correction instead.`);
}

const out = [];
const target_ = `## ${section}`;
let inside = false;
let done = false;
let replaced = -1;
for (const [index, line] of lines.entries()) {
  const t = line.replace(/\s+$/, '');
  if (/^## /.test(t)) {
    if (inside && !done) {
      out.push(...entry, '');
      done = true;
    }
    inside = t === target_;
    out.push(line);
    continue;
  }
  if (inside && !done) {
    if (t === '_None yet._') {
      out.push(...entry);
      done = true;
      replaced = index;
      continue;
    }
    if (/^- /.test(t) || /^### /.test(t)) {
      out.push(...entry, '', line);
      done = true;
      continue;
    }
  }
  out.push(line);
}
if (inside && !done) out.push('', ...entry);

// Append-only guard: the placeholder is the only line this script may ever remove.
const kept = lines.filter((_, index) => index !== replaced);
let j = 0;
for (const line of out) if (j < kept.length && line === kept[j]) j += 1;
if (j !== kept.length) die('refusing to write: the rewrite would drop existing lines');
const result = `${out.join('\n')}\n`;
if (existsSync(target) && result.length <= original.length) die(`refusing to write: ${rel} would not grow`);

if (dryRun) {
  console.log(`--- ${rel}\n+++ ${rel} (with the entry)`);
  for (const l of entry) console.log(`+ ${l}`);
  console.log(`(under ## ${section})`);
  process.stderr.write(`append-insight: dry run, ${rel} untouched\n`);
  process.exit(0);
}

mkdirSync(dirname(target), { recursive: true });
const tmp = join(dirname(target), `.${basename(target)}.tmp.${process.pid}`);
writeFileSync(tmp, result);
renameSync(tmp, target);
process.stderr.write(`append-insight: added ${entry.length}-line entry to '## ${section}' in ${rel}\n`);
