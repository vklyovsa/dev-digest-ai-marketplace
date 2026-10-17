#!/usr/bin/env node
// PreToolUse guard for research-tools:researcher. Blocks file-writing Bash and the write
// tools; every other agent and the main session pass untouched. Fails closed: any error
// while reading the input or parsing the command exits 2.
import { readFileSync } from 'node:fs';
import { parseCommandLine, writingRedirect, splitAssignments, unwrap, checkGit, base, isSubst } from './lib/shell.mjs';

const AGENT = 'research-tools:researcher';
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

const WRITERS = new Set([
  'rm', 'rmdir', 'unlink', 'mv', 'cp', 'dd', 'tee', 'touch', 'mkdir', 'mktemp', 'mkfifo', 'ln',
  'chmod', 'chown', 'chgrp', 'chattr', 'truncate', 'shred', 'install', 'rsync', 'scp', 'sftp',
  'patch', 'split', 'csplit', 'tar', 'zip', 'unzip', 'gzip', 'gunzip', 'bzip2', 'bunzip2',
  'xz', 'unxz', 'zstd', '7z', 'vi', 'vim', 'nvim', 'nano', 'emacs', 'ed', 'ex', 'wget',
]);
const INTERPRETERS = new Set([
  'node', 'nodejs', 'python', 'python2', 'python3', 'perl', 'ruby', 'php', 'deno', 'lua',
  'Rscript', 'osascript', 'pwsh', 'powershell', 'tsx', 'ts-node',
]);
const PM_READ = {
  npm: ['ls', 'list', 'll', 'la', 'why', 'explain', 'view', 'info', 'show', 'outdated', 'help', 'root', 'prefix', 'bin'],
  pnpm: ['ls', 'list', 'll', 'why', 'view', 'info', 'outdated', 'help', 'root', 'bin'],
  yarn: ['why', 'list', 'info', 'outdated', 'help', 'bin'],
  pip: ['show', 'list', 'freeze', 'help'],
  pip3: ['show', 'list', 'freeze', 'help'],
  go: ['version', 'env', 'list', 'doc', 'help'],
  cargo: ['tree', 'metadata', 'help'],
  gem: ['list', 'info', 'help'],
  composer: ['show', 'depends', 'why', 'why-not', 'licenses', 'help'],
};
const PM_BLOCKED = new Set([
  'npx', 'pnpx', 'bunx', 'bun', 'pipx', 'uv', 'uvx', 'poetry', 'corepack', 'brew', 'apt',
  'apt-get', 'dnf', 'yum', 'apk', 'pacman', 'zypper', 'port', 'snap', 'flatpak', 'conda', 'mamba',
]);
const PM_GLOBAL_WITH_VALUE = new Set(['-C', '--dir', '--prefix', '--filter', '-F', '-w', '--workspace', '--cwd']);
const VERSION = new Set(['-v', '-V', '--version', 'version']);

function checkPackageManager(cmd, args) {
  if (args.length === 1 && VERSION.has(args[0])) return null;
  if (PM_BLOCKED.has(cmd)) return `"${cmd}" can install or run packages`;
  let k = 0;
  while (k < args.length && args[k].startsWith('-')) k += PM_GLOBAL_WITH_VALUE.has(args[k]) ? 2 : 1;
  const sub = args[k];
  if (!sub) return null;
  if (cmd === 'npm' && sub === 'config' && ['get', 'list', 'ls'].includes(args[k + 1])) return null;
  if (PM_READ[cmd].includes(sub)) return null;
  return `"${cmd} ${sub}" is not a read-only package-manager command`;
}

function checkCurl(args) {
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (/^(-[a-zA-Z]*[oOdDcFTKJ]|--(output|remote-name|data|form|upload-file|config|json|create-dirs|output-dir|cookie-jar|dump-header|trace|stderr))/.test(a)) {
      return `curl ${a} writes a file or sends data`;
    }
    if (/^(-X|--request)$/.test(a) && !/^(GET|HEAD)$/i.test(args[k + 1] ?? '')) return 'curl may only GET or HEAD';
    if (/^-X(?!GET$|HEAD$)./.test(a) || /^--request=(?!GET$|HEAD$)/i.test(a)) return 'curl may only GET or HEAD';
  }
  return null;
}

function checkGh(args) {
  const [area, action] = args;
  const reads = ['view', 'list', 'diff', 'checks', 'status', 'search'];
  if (['pr', 'issue', 'repo', 'release', 'run', 'workflow', 'gist', 'label'].includes(area) && reads.includes(action)) {
    return args.some((a) => a === '--web' || a === '-w') ? 'gh --web opens a browser' : null;
  }
  if (area === 'search') return null;
  if (area === 'api') {
    const bad = args.find((a, k) => /^(-f|-F|--field|--raw-field|--input)$/.test(a) || (/^(-X|--method)$/.test(a) && !/^GET$/i.test(args[k + 1] ?? '')));
    return bad ? `gh api ${bad} sends data` : null;
  }
  return `gh ${area ?? ''} ${action ?? ''}`.trim() + ' is not a read-only gh command';
}

function checkSimple(words) {
  const u = unwrap(words);
  if (u.block) return u.block;
  if (u.inline !== undefined) return checkLine(u.inline);
  if (u.lookup || !u.words.length) return null;
  const [first, ...args] = u.words;
  if (isSubst(first)) return 'a command name built from a substitution cannot be checked';
  const cmd = base(first);
  if (u.script) return `running a script with ${cmd} cannot be checked`;

  if (WRITERS.has(cmd)) return `"${cmd}" writes or deletes files`;
  if (INTERPRETERS.has(cmd)) {
    return args.length === 1 && VERSION.has(args[0]) ? null : `"${cmd}" runs arbitrary code`;
  }
  if (cmd === 'git') return checkGit(args);
  if (cmd === 'sed' || cmd === 'gsed') {
    const bad = args.find((a) => /^-[a-zA-Z]*i/.test(a) || a.startsWith('--in-place'));
    return bad ? `sed ${bad} edits files in place` : null;
  }
  if (cmd === 'awk' || cmd === 'gawk' || cmd === 'mawk') {
    if (args.some((a, k) => a === '-i' && /inplace/.test(args[k + 1] ?? ''))) return 'awk -i inplace edits files';
    if (args.some((a) => /system\s*\(|print[f]?\b[^;}]*>|\|\s*getline|"\s*\|/.test(a))) return 'awk program writes files or runs commands';
    return null;
  }
  if (cmd === 'find') {
    const bad = args.find((a) => /^-(delete|exec|execdir|ok|okdir|fprint|fprint0|fprintf|fls)$/.test(a));
    return bad ? `find ${bad} acts on files` : null;
  }
  if (cmd === 'sort') {
    const bad = args.find((a) => /^(-o|--output)/.test(a) || /^-[a-zA-Z]*o$/.test(a));
    return bad ? `sort ${bad} writes a file` : null;
  }
  if (cmd === 'curl') return checkCurl(args);
  if (cmd === 'gh') return checkGh(args);
  if (cmd in PM_READ || PM_BLOCKED.has(cmd)) return checkPackageManager(cmd, args);
  return null;
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
    const { rest } = splitAssignments(words);
    const r = checkSimple(rest);
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
    process.stderr.write(`research-tools readonly guard: blocked — ${reason}. The researcher is read-only; report what you would need instead.\n`);
    process.exit(2);
  }
  process.exit(0);
} catch (err) {
  process.stderr.write(`research-tools readonly guard: cannot verify the call (${err.message}); blocked.\n`);
  process.exit(2);
}
