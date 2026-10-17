// Minimal POSIX-shell reader for guard hooks. It does not execute anything; it splits a
// command line into simple commands, collects redirections, and extracts the bodies of
// command/process substitutions and `sh -c` strings so a policy can inspect them too.
// Anything it cannot read (unbalanced quotes, unterminated substitution) throws, and the
// caller fails closed.

const SUBST = '\u0000SUBST\u0000';

export function parseCommandLine(src) {
  const segments = [];
  const nested = [];
  let words = [];
  let redirects = [];
  let word = null;
  let wordQuoted = false;
  let pendingRedirect = null;
  const heredocs = [];
  let i = 0;

  const pushWord = () => {
    if (word === null) return;
    if (pendingRedirect) {
      const target = word;
      if (pendingRedirect.startsWith('<<') && pendingRedirect !== '<<<') {
        heredocs.push({ delim: target, stripTabs: pendingRedirect === '<<-' });
      }
      redirects.push({ op: pendingRedirect, target });
      pendingRedirect = null;
    } else {
      words.push(word);
    }
    word = null;
    wordQuoted = false;
  };
  const endSegment = () => {
    pushWord();
    if (pendingRedirect) throw new Error(`redirection "${pendingRedirect}" has no target`);
    if (words.length || redirects.length) segments.push({ words, redirects });
    words = [];
    redirects = [];
  };
  const append = (s) => {
    word = (word ?? '') + s;
  };

  const readBalanced = (start, open, close) => {
    let depth = 1;
    let j = start;
    while (j < src.length) {
      const c = src[j];
      if (c === '\\') {
        j += 2;
        continue;
      }
      if (c === "'") {
        const end = src.indexOf("'", j + 1);
        if (end < 0) throw new Error('unbalanced single quote');
        j = end + 1;
        continue;
      }
      if (c === '"') {
        j = skipDouble(j + 1);
        continue;
      }
      if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) return j;
      }
      j++;
    }
    throw new Error(`unterminated "${open}"`);
  };
  const skipDouble = (j) => {
    while (j < src.length) {
      if (src[j] === '\\') {
        j += 2;
        continue;
      }
      if (src[j] === '"') return j + 1;
      if (src[j] === '$' && src[j + 1] === '(') {
        j = readBalanced(j + 2, '(', ')') + 1;
        continue;
      }
      j++;
    }
    throw new Error('unbalanced double quote');
  };
  const readBacktick = (start) => {
    let j = start;
    while (j < src.length) {
      if (src[j] === '\\') {
        j += 2;
        continue;
      }
      if (src[j] === '`') return j;
      j++;
    }
    throw new Error('unbalanced backtick');
  };
  const takeDollar = () => {
    if (src[i + 1] === '(' && src[i + 2] === '(') {
      const end = readBalanced(i + 3, '(', ')');
      if (src[end + 1] !== ')') throw new Error('unterminated arithmetic expansion');
      append(src.slice(i, end + 2));
      i = end + 2;
      return true;
    }
    if (src[i + 1] === '(') {
      const end = readBalanced(i + 2, '(', ')');
      nested.push(src.slice(i + 2, end));
      append(SUBST);
      i = end + 1;
      return true;
    }
    return false;
  };
  const consumeHeredocs = () => {
    while (heredocs.length) {
      const { delim, stripTabs } = heredocs.shift();
      for (;;) {
        if (i >= src.length) throw new Error(`unterminated here-document "${delim}"`);
        let nl = src.indexOf('\n', i);
        if (nl < 0) nl = src.length;
        let line = src.slice(i, nl);
        i = nl + 1;
        if (stripTabs) line = line.replace(/^\t+/, '');
        if (line === delim) break;
      }
    }
  };

  while (i < src.length) {
    const c = src[i];

    if (c === ' ' || c === '\t') {
      pushWord();
      i++;
      continue;
    }
    if (c === '\n') {
      endSegment();
      i++;
      consumeHeredocs();
      continue;
    }
    if (c === '#' && word === null) {
      const nl = src.indexOf('\n', i);
      i = nl < 0 ? src.length : nl;
      continue;
    }
    if (c === '\\') {
      if (src[i + 1] === '\n') {
        i += 2;
        continue;
      }
      if (i + 1 >= src.length) throw new Error('trailing backslash');
      append(src[i + 1]);
      wordQuoted = true;
      i += 2;
      continue;
    }
    if (c === "'") {
      const end = src.indexOf("'", i + 1);
      if (end < 0) throw new Error('unbalanced single quote');
      append(src.slice(i + 1, end));
      wordQuoted = true;
      i = end + 1;
      continue;
    }
    if (c === '"') {
      wordQuoted = true;
      append('');
      i++;
      for (;;) {
        if (i >= src.length) throw new Error('unbalanced double quote');
        const d = src[i];
        if (d === '"') {
          i++;
          break;
        }
        if (d === '\\') {
          append(src[i + 1] ?? '');
          i += 2;
          continue;
        }
        if (d === '$' && takeDollar()) continue;
        if (d === '`') {
          const end = readBacktick(i + 1);
          nested.push(src.slice(i + 1, end));
          append(SUBST);
          i = end + 1;
          continue;
        }
        append(d);
        i++;
      }
      continue;
    }
    if (c === '$' && takeDollar()) continue;
    if (c === '`') {
      const end = readBacktick(i + 1);
      nested.push(src.slice(i + 1, end));
      append(SUBST);
      i = end + 1;
      continue;
    }
    if ((c === '<' || c === '>') && src[i + 1] === '(') {
      pushWord();
      const end = readBalanced(i + 2, '(', ')');
      nested.push(src.slice(i + 2, end));
      words.push(SUBST);
      i = end + 1;
      continue;
    }
    if (c === '(' || c === ')' || c === '{' && word === null && /\s/.test(src[i + 1] ?? ' ') || c === '}' && word === null) {
      endSegment();
      i++;
      continue;
    }
    if (c === ';' || c === '|' || (c === '&' && src[i + 1] !== '>')) {
      endSegment();
      i += (src[i + 1] === c || (c === '|' && src[i + 1] === '&')) ? 2 : 1;
      continue;
    }
    if (c === '>' || c === '<' || c === '&') {
      if (word !== null && !wordQuoted && /^\d+$/.test(word)) {
        word = null;
      } else {
        pushWord();
      }
      const op = /^(&>>|&>|>>|>\||>&|<<<|<<-|<<|<>|<&|>|<)/.exec(src.slice(i))[0];
      i += op.length;
      if ((op === '>&' || op === '<&')) {
        const m = /^\s*(\d+|-)(?=$|[\s;|&)])/.exec(src.slice(i));
        if (m) {
          redirects.push({ op, target: m[1] });
          i += m[0].length;
          continue;
        }
      }
      pendingRedirect = op;
      continue;
    }
    append(c);
    i++;
  }
  endSegment();
  if (heredocs.length) throw new Error('unterminated here-document');
  return { segments, nested };
}

export const isSubst = (w) => w.includes(SUBST);

const SAFE_TARGETS = new Set(['/dev/null', '/dev/stdout', '/dev/stderr']);

export function writingRedirect(redirects) {
  for (const { op, target } of redirects) {
    if (op === '<' || op === '<<' || op === '<<-' || op === '<<<' || op === '<&') continue;
    if ((op === '>&' || op === '<&') && /^(\d+|-)$/.test(target)) continue;
    if (SAFE_TARGETS.has(target)) continue;
    return `redirection "${op} ${target}" writes a file`;
  }
  return null;
}

const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

export function splitAssignments(words) {
  let k = 0;
  while (k < words.length && ASSIGNMENT.test(words[k])) k++;
  return { assignments: words.slice(0, k), rest: words.slice(k) };
}

export const base = (cmd) => cmd.split('/').pop();

// Read-only git: shared by every guard.
const GIT_READ = new Set([
  'log', 'show', 'blame', 'annotate', 'diff', 'grep', 'status', 'rev-parse', 'ls-files',
  'ls-tree', 'cat-file', 'describe', 'shortlog', 'merge-base', 'rev-list', 'show-ref',
  'for-each-ref', 'name-rev', 'whatchanged', 'count-objects', 'check-ignore', 'var',
  'diff-tree', 'diff-files', 'diff-index', 'range-diff', 'cherry', 'version', 'help',
]);
const GIT_GLOBAL_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace']);
const GIT_RISKY_CONFIG = /(alias|pager|external|hookspath|fsmonitor|sshcommand|editor|textconv|filter|credential|askpass|proxy)/i;

export function checkGit(args) {
  let k = 0;
  while (k < args.length && args[k].startsWith('-')) {
    const a = args[k];
    if (a === '-c' && GIT_RISKY_CONFIG.test(args[k + 1] ?? '')) return `git -c ${args[k + 1]} can run a command`;
    if (/^--(exec-path|config-env)/.test(a)) return `git ${a} is not allowed`;
    k += GIT_GLOBAL_WITH_VALUE.has(a) ? 2 : 1;
  }
  const sub = args[k];
  const rest = args.slice(k + 1);
  if (!sub) return null;
  if (rest.some((a) => /^--output(=|$)/.test(a))) return `git ${sub} --output writes a file`;
  if (sub === 'grep' && rest.some((a) => a === '-O' || a.startsWith('--open-files-in-pager'))) {
    return 'git grep -O runs a pager command';
  }
  if (rest.some((a) => /^--ext-diff$/.test(a))) return 'git --ext-diff runs an external command';
  if (GIT_READ.has(sub)) return null;
  const flags = rest.filter((a) => a.startsWith('-'));
  const positional = rest.filter((a) => !a.startsWith('-'));
  switch (sub) {
    case 'branch': {
      const bad = flags.find((f) => /^(-[dDmMcCfu]|--(delete|move|copy|force|set-upstream|unset-upstream|track|edit-description))/.test(f));
      if (bad) return `git branch ${bad} changes refs`;
      const listing = flags.some((f) => /^(-l|--list|-a|--all|-r|--remotes|--contains|--no-contains|--merged|--no-merged|--points-at|--format|--sort|--show-current|-v|-vv)/.test(f));
      if (positional.length && !listing) return 'git branch <name> creates a branch';
      return null;
    }
    case 'tag': {
      const listing = flags.some((f) => /^(-l|--list|--contains|--no-contains|--merged|--no-merged|--points-at|--sort|--format|-n\d*)/.test(f));
      if (positional.length && !listing) return 'git tag <name> creates a tag';
      if (flags.some((f) => /^(-d|--delete|-a|-s|-f|-m|-F|-u)/.test(f))) return 'git tag with that flag changes refs';
      return null;
    }
    case 'remote':
      if (!positional.length || ['show', 'get-url'].includes(positional[0])) return null;
      return `git remote ${positional[0]} changes configuration`;
    case 'config':
      if (flags.some((f) => /^(--get|--get-all|--get-regexp|--list|-l)$/.test(f)) || positional[0] === 'get' || positional[0] === 'list') return null;
      return 'git config without --get/--list changes configuration';
    case 'stash':
      if (['list', 'show'].includes(positional[0])) return null;
      return 'git stash changes the working tree';
    case 'reflog':
      if (!positional.length || positional[0] === 'show') return null;
      return `git reflog ${positional[0]} changes the reflog`;
    case 'worktree':
      if (positional[0] === 'list') return null;
      return 'git worktree changes worktrees';
    case 'notes':
      if (['list', 'show'].includes(positional[0])) return null;
      return 'git notes changes notes';
    default:
      return `git ${sub} is not a read-only git command`;
  }
}

// Strips wrappers that run another command, and reports the inner command.
// Returns { words } for the command to check, { block } for a wrapper that is never allowed,
// or { inline } with a string that must be parsed as a command line of its own.
export function unwrap(words) {
  let w = words;
  for (let guard = 0; guard < 16; guard++) {
    if (!w.length) return { words: w };
    const cmd = base(w[0]);
    if (['sudo', 'doas', 'su', 'eval', 'source', '.', 'exec'].includes(cmd)) {
      return { block: `"${cmd}" is not allowed` };
    }
    if (['command', 'builtin'].includes(cmd)) {
      if (w[1] === '-v' || w[1] === '-V') return { words: w, lookup: true };
      w = w.slice(1);
      continue;
    }
    if (['time', 'nohup', 'nice', 'stdbuf', 'ionice'].includes(cmd)) {
      w = w.slice(1);
      while (w.length && w[0].startsWith('-')) w = w.slice(cmd === 'nice' && w[0] === '-n' ? 2 : 1);
      continue;
    }
    if (cmd === 'timeout') {
      w = w.slice(1);
      while (w.length && w[0].startsWith('-')) w = w.slice(['-s', '--signal', '-k', '--kill-after'].includes(w[0]) ? 2 : 1);
      w = w.slice(1);
      continue;
    }
    if (cmd === 'env') {
      w = w.slice(1);
      while (w.length && (w[0].startsWith('-') || ASSIGNMENT.test(w[0]))) {
        if (['-S', '--split-string'].includes(w[0])) return { block: 'env -S is not allowed' };
        w = w.slice(['-u', '--unset', '-C', '--chdir'].includes(w[0]) ? 2 : 1);
      }
      continue;
    }
    if (cmd === 'xargs') {
      w = w.slice(1);
      while (w.length && w[0].startsWith('-')) {
        w = w.slice(/^-(I|L|n|P|s|d|E|a)$|^--(replace|max-lines|max-args|max-procs|max-chars|delimiter|eof|arg-file)$/.test(w[0]) ? 2 : 1);
      }
      if (!w.length) return { words: ['echo'] };
      continue;
    }
    if (['bash', 'sh', 'zsh', 'dash', 'ksh'].includes(cmd)) {
      const ci = w.findIndex((a, k) => k > 0 && /^-[a-z]*c[a-z]*$/.test(a));
      if (ci > 0) {
        if (w[ci + 1] === undefined) return { block: `${cmd} -c has no command` };
        return { inline: w[ci + 1] };
      }
      return { words: w, script: true };
    }
    return { words: w };
  }
  return { block: 'too many nested wrappers' };
}
