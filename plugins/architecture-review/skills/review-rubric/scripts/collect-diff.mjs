#!/usr/bin/env node
// Collect the open changes of the current working copy: committed on the branch since the
// merge base, plus uncommitted, plus untracked. Read-only; prints to stdout.
//
//   collect-diff.sh [--base <ref>] [--scope branch|working] [--format json|list|diff] [--max-lines <n>]
//
// Exit codes: 0 ok (empty output = nothing changed), 3 not a git repository or no base,
// 64 bad arguments.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';

process.stdout.on('error', (err) => process.exit(err.code === 'EPIPE' ? 0 : 1));

const opts = { base: '', scope: 'branch', format: 'json', maxLines: 1500 };
const argv = process.argv.slice(2);
for (let k = 0; k < argv.length; k++) {
  const a = argv[k];
  const v = argv[k + 1];
  if (a === '--base') opts.base = v ?? '';
  else if (a === '--scope') opts.scope = v === 'all' ? 'branch' : v;
  else if (a === '--format') opts.format = v;
  else if (a === '--max-lines') opts.maxLines = Number(v);
  else die(64, `unknown argument ${a}`);
  k++;
}
if (!['branch', 'working'].includes(opts.scope)) die(64, '--scope must be branch or working');
if (!['json', 'list', 'diff'].includes(opts.format)) die(64, '--format must be json, list or diff');
if (!Number.isFinite(opts.maxLines) || opts.maxLines <= 0) die(64, '--max-lines must be a positive number');

function die(code, msg) {
  process.stderr.write(`collect-diff: ${msg}\n`);
  process.exit(code);
}

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (err) {
    if (allowFail) return null;
    throw err;
  }
}
const lines = (s) => (s ?? '').split('\n').filter(Boolean);
const verify = (ref) => git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { allowFail: true }) !== null;

const root = git(['rev-parse', '--show-toplevel'], { allowFail: true })?.trim();
if (!root) die(3, 'not a git repository');
process.chdir(root);

function resolveBase(explicit) {
  if (explicit) return verify(explicit) ? explicit : null;
  const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], { allowFail: true })?.trim();
  if (upstream) return upstream;
  const head = git(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'], { allowFail: true })?.trim();
  for (const candidate of [head, 'origin/main', 'origin/master', 'main', 'master'].filter(Boolean)) {
    if (verify(candidate)) return candidate;
  }
  return null;
}

const baseRef = resolveBase(opts.base);
if (!baseRef) die(3, 'cannot resolve a base ref — pass --base <ref> explicitly');

let mergeBase = '';
if (opts.scope === 'branch') {
  mergeBase = git(['merge-base', baseRef, 'HEAD'], { allowFail: true })?.trim() ?? '';
  if (!mergeBase) die(3, `no merge base between ${baseRef} and HEAD — pass --base <ref> explicitly`);
}

const names = (filter) => {
  const out = new Set();
  if (mergeBase) lines(git(['diff', '--name-only', `--diff-filter=${filter}`, mergeBase, 'HEAD'])).forEach((f) => out.add(f));
  lines(git(['diff', '--name-only', `--diff-filter=${filter}`, 'HEAD'])).forEach((f) => out.add(f));
  return [...out].sort();
};
const tracked = names('ACMRT');
const deleted = names('D');
const untracked = lines(git(['ls-files', '--others', '--exclude-standard'])).sort();

const EXCLUDED = [
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|npm-shrinkwrap\.json|Cargo\.lock|poetry\.lock|composer\.lock|go\.sum)$/,
  /(^|\/)node_modules\//,
  /\.(png|jpe?g|gif|ico|pdf|zip|gz|tgz|woff2?|ttf|otf|webp|svg|mp4|mov)$/i,
  /\.(tsbuildinfo|log|map)$/,
];
const isExcluded = (f) => EXCLUDED.some((re) => re.test(f));

function changedLines(file) {
  let sum = 0;
  const runs = [];
  if (mergeBase) runs.push(['diff', '--numstat', mergeBase, 'HEAD', '--', file]);
  runs.push(['diff', '--numstat', 'HEAD', '--', file]);
  for (const args of runs) {
    for (const row of lines(git(args, { allowFail: true }))) {
      const [a, d] = row.split('\t');
      if (/^\d+$/.test(a) && /^\d+$/.test(d)) sum += Number(a) + Number(d);
    }
  }
  return sum;
}

const included = new Set();
const skipped = [];
let excludedCount = 0;
const consider = (file, isUntracked) => {
  if (!existsSync(file) || !statSync(file).isFile()) return;
  if (isExcluded(file)) {
    excludedCount++;
    return;
  }
  const n = isUntracked ? readFileSync(file, 'utf8').split('\n').length : changedLines(file);
  if (n > opts.maxLines) {
    skipped.push({ file, reason: 'too-large', lines: n });
    return;
  }
  included.add(file);
};
tracked.forEach((f) => consider(f, false));
untracked.forEach((f) => consider(f, true));
const files = [...included].sort();

if (opts.format === 'list') {
  if (files.length) process.stdout.write(`${files.join('\n')}\n`);
} else if (opts.format === 'diff') {
  if (files.length) {
    const trackedFiles = files.filter((f) => !untracked.includes(f));
    if (trackedFiles.length) {
      if (mergeBase) process.stdout.write(git(['diff', mergeBase, 'HEAD', '--', ...trackedFiles]));
      process.stdout.write(git(['diff', 'HEAD', '--', ...trackedFiles]));
    }
    for (const f of files.filter((x) => untracked.includes(x))) {
      const res = spawnSync('git', ['--no-pager', 'diff', '--no-index', '--', '/dev/null', f], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      process.stdout.write(res.stdout ?? '');
    }
  }
} else {
  const out = {
    base: baseRef,
    merge_base: mergeBase,
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']).trim(),
    head_sha: git(['rev-parse', 'HEAD']).trim(),
    scope: opts.scope,
    file_count: files.length,
    files,
    deleted,
    skipped,
    excluded_count: excludedCount,
  };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}
