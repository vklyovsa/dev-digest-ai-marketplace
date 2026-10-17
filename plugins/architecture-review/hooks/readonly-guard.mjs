#!/usr/bin/env node
// PreToolUse guard for architecture-review:architecture-reviewer. Blocks the write tools
// and allows Bash only when every simple command is on a read-only allowlist. Every other
// agent and the main session pass untouched. Fails closed: any error exits 2.
import { readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseCommandLine, writingRedirect, splitAssignments, unwrap, checkGit, base, isSubst } from './lib/shell.mjs';

const AGENT = 'architecture-review:architecture-reviewer';
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

const TEXT_TOOLS = new Set([
  'cd', 'pwd', 'ls', 'cat', 'head', 'tail', 'wc', 'grep', 'egrep', 'fgrep', 'rg', 'cut', 'tr',
  'nl', 'diff', 'cmp', 'comm', 'jq', 'realpath', 'readlink', 'dirname', 'basename', 'stat',
  'file', 'echo', 'printf', 'test', '[', 'true', 'false', 'which', 'type', 'tree', 'column',
  'uniq', 'sort', 'date', 'find', 'sed', 'gsed',
]);
const SAFE_ASSIGNMENTS = /^(NO_COLOR|FORCE_COLOR|LC_ALL|LANG|GIT_PAGER|PAGER|TERM|CI)=/;
const SCRIPT_NAME = /^(typecheck|type-check|types|check-types|check:types|tsc|lint|lint:[a-z0-9:_-]+|arch|arch:check|check:arch|depcruise|deps:check)$/;
const PM = new Set(['npm', 'pnpm', 'yarn']);
const PM_GLOBAL_WITH_VALUE = new Set(['-C', '--dir', '--prefix', '--filter', '-F', '-w', '--workspace', '--cwd']);
const SED_PRINT = /^(\s*((\d+|\$|\/([^/\\]|\\.)*\/)(\s*,\s*(\d+|\$|\/([^/\\]|\\.)*\/))?)?\s*!?\s*p\s*;?)+$/;

function collectDiffPath() {
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  if (!root) return null;
  const p = join(root, 'skills/review-rubric/scripts/collect-diff.sh');
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

function isCollectDiff(path) {
  const expected = collectDiffPath();
  if (!expected) return false;
  let actual = resolve(path);
  try {
    actual = realpathSync(actual);
  } catch {
    return false;
  }
  return actual === expected;
}

function checkTextTool(cmd, args) {
  switch (cmd) {
    case 'find': {
      const bad = args.find((a) => /^-(delete|exec|execdir|ok|okdir|fprint|fprint0|fprintf|fls)$/.test(a));
      return bad ? `find ${bad} acts on files` : null;
    }
    case 'sort': {
      const bad = args.find((a) => /^(-o|--output)/.test(a) || /^-[a-zA-Z]*o$/.test(a));
      return bad ? `sort ${bad} writes a file` : null;
    }
    case 'uniq':
      return args.filter((a) => !a.startsWith('-')).length > 1 ? 'uniq with an output file writes it' : null;
    case 'date':
      return args.some((a) => /^(-s|--set)/.test(a)) ? 'date --set changes the clock' : null;
    case 'rg':
      return args.some((a) => /^--pre(=|$)/.test(a)) ? 'rg --pre runs a command' : null;
    case 'sed':
    case 'gsed': {
      if (args.some((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith('--in-place'))) return 'sed -i edits files in place';
      if (!args.some((a) => /^-[a-zA-Z]*n[a-zA-Z]*$/.test(a) || a === '--quiet' || a === '--silent')) return 'sed is allowed only as sed -n with a print script';
      const scripts = [];
      for (let k = 0; k < args.length; k++) {
        if (args[k] === '-e' || args[k] === '--expression') scripts.push(args[++k] ?? '');
        else if (args[k] === '-f' || args[k] === '--file') return 'sed -f runs a script file';
      }
      if (!scripts.length) {
        const first = args.find((a) => !a.startsWith('-'));
        if (first !== undefined) scripts.push(first);
      }
      const bad = scripts.find((s) => !SED_PRINT.test(s));
      return bad === undefined ? null : `sed script "${bad}" is not a print-only range`;
    }
    default:
      return null;
  }
}

function checkTool(tool, args) {
  if (tool === 'depcruise' || tool === 'dependency-cruiser') {
    const bad = args.find((a) => /^(-f|--output-to|-i|--init|--cache)(=|$)/.test(a));
    return bad ? `depcruise ${bad} writes files` : null;
  }
  if (tool === 'tsc') {
    if (!args.includes('--noEmit')) return 'tsc is allowed only with --noEmit';
    const bad = args.find((a) => /^(-b|--build|--init|-w|--watch|--incremental|-i|--tsBuildInfoFile|--generateTrace|--composite)(=|$)/.test(a));
    return bad ? `tsc ${bad} writes files or keeps running` : null;
  }
  if (tool === 'eslint') {
    const bad = args.find((a) => /^(--fix|--fix-type|-o|--output-file|--cache|--init)(=|$)/.test(a));
    return bad ? `eslint ${bad} writes files` : null;
  }
  return `"${tool}" is not on the architecture reviewer's allowlist`;
}

function checkPackageManager(cmd, args) {
  let k = 0;
  while (k < args.length && args[k].startsWith('-')) k += PM_GLOBAL_WITH_VALUE.has(args[k]) ? 2 : 1;
  let sub = args[k];
  let rest = args.slice(k + 1);
  if (cmd === 'yarn' && sub === 'workspace') {
    sub = rest[1];
    rest = rest.slice(2);
  }
  if (!sub) return `${cmd} without a script is not allowed`;
  if (sub === 'exec' || (cmd === 'npm' && sub === 'x')) {
    if (cmd === 'npm' && !rest.some((a) => a === '--no' || a === '--no-install' || a === '--offline')) return 'npm exec may download packages — add --no';
    const r = rest.filter((a) => !['--no', '--no-install', '--offline', '--'].includes(a));
    return r.length ? checkTool(base(r[0]), r.slice(1)) : `${cmd} exec without a tool`;
  }
  if (sub === 'run' || sub === 'run-script') {
    sub = rest[0];
    rest = rest.slice(1);
  }
  if (!SCRIPT_NAME.test(sub ?? '') || /fix|format|write|prettier/.test(sub ?? '')) {
    return `"${cmd} ${sub}" is not a typecheck, lint or architecture-check script`;
  }
  if (rest.some((a) => /^--(fix|write)/.test(a))) return 'script arguments may not fix or write';
  return null;
}

function checkSimple(words) {
  const { assignments, rest: afterAssign } = splitAssignments(words);
  const unsafe = assignments.find((a) => !SAFE_ASSIGNMENTS.test(a));
  if (unsafe) return `environment assignment "${unsafe.split('=')[0]}" is not allowed`;
  const u = unwrap(afterAssign);
  if (u.block) return u.block;
  if (u.inline !== undefined) return checkLine(u.inline);
  if (u.lookup || !u.words.length) return null;
  const [first, ...args] = u.words;
  if (isSubst(first)) return 'a command name built from a substitution cannot be checked';
  const cmd = base(first);

  if (u.script) {
    const script = args.find((a) => !a.startsWith('-'));
    return script && isCollectDiff(script) ? null : `running a script with ${cmd} is allowed only for the review-rubric collect-diff script`;
  }
  if (first.includes('/') && isCollectDiff(first)) return null;
  if (TEXT_TOOLS.has(cmd) && !first.includes('/')) return checkTextTool(cmd, args);
  if (cmd === 'git' && !first.includes('/')) return checkGit(args);
  if (PM.has(cmd)) return checkPackageManager(cmd, args);
  if (cmd === 'npx' || cmd === 'pnpx') {
    const noInstall = args.some((a) => a === '--no-install' || a === '--no' || a === '--offline');
    if (!noInstall) return `${cmd} may download packages — use ${cmd} --no-install`;
    const r = args.filter((a) => !['--no', '--no-install', '--offline', '--'].includes(a));
    return r.length ? checkTool(base(r[0]), r.slice(1)) : `${cmd} without a tool`;
  }
  if (/^(\.\/)?node_modules\/\.bin\/[^/]+$/.test(first) || !first.includes('/')) return checkTool(cmd, args);
  return `"${first}" is not on the architecture reviewer's allowlist`;
}

function checkLine(line) {
  const { segments, nested } = parseCommandLine(line);
  for (const inner of nested) {
    const r = checkLine(inner);
    if (r) return r;
  }
  for (const { words, redirects } of segments) {
    const w = writingRedirect(redirects);
    if (w) return w;
    const r = checkSimple(words);
    if (r) return r;
  }
  return null;
}

function decide(input) {
  if (input.agent_type !== AGENT) return null;
  if (WRITE_TOOLS.has(input.tool_name)) return `${input.tool_name} is not available to a read-only agent`;
  if (input.tool_name !== 'Bash') return null;
  const command = input.tool_input?.command;
  if (typeof command !== 'string') throw new Error('Bash input has no command');
  return checkLine(command);
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const reason = decide(input);
  if (reason) {
    process.stderr.write(`architecture-review readonly guard: blocked — ${reason}. Use Read/Grep/Glob, or list the check under "Not checked".\n`);
    process.exit(2);
  }
  process.exit(0);
} catch (err) {
  process.stderr.write(`architecture-review readonly guard: cannot verify the call (${err.message}); blocked.\n`);
  process.exit(2);
}
