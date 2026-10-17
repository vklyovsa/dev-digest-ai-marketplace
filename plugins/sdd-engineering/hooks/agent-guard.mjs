#!/usr/bin/env node
// PreToolUse guard for the sdd-engineering agents. Acts only when the hook input's agent_type is one of
// this plugin's agents; every other caller passes untouched. exit 0 = allow, exit 2 = block.
// Bash parsing is deliberately naive and errs towards blocking.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globToRegExp, loadProfile } from '../scripts/lib/profile.mjs';

const PLUGIN = 'sdd-engineering';
const AGENTS = {
  'implementation-planner': 'readonly',
  'plan-verifier': 'verifier',
  'spec-creator': 'specs',
  implementer: 'implementer',
};
const HINTS = {
  readonly: 'This agent is read-only; name what you could not check in your report.',
  verifier: 'This agent is read-only; put the command under "Needs a test run" or "Not verifiable".',
  specs: 'Say so in your report: a change outside the spec folders belongs to another agent or to the user.',
  implementer: 'Record it under "Not done / blockers" in the implementation report.',
};

class Blocked extends Error {}
const block = (subject, why) => {
  throw new Blocked(`${String(subject).replace(/\s+/g, ' ').slice(0, 160)} — ${why}`);
};

function realish(p) {
  let head = p;
  const tail = [];
  while (!existsSync(head)) {
    const up = dirname(head);
    if (up === head) return p;
    tail.unshift(basename(head));
    head = up;
  }
  return join(realpathSync(head), ...tail);
}

const PLUGIN_ROOT_RAW = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_ROOT = realish(PLUGIN_ROOT_RAW);
const PLUGIN_ROOTS = [...new Set([PLUGIN_ROOT, PLUGIN_ROOT_RAW, process.env.CLAUDE_PLUGIN_ROOT].filter(Boolean))];

// ---- command text --------------------------------------------------------

// Quoted literals become Q, so `grep -E 'a|b'` is not split on `|`. A double-quoted string holding
// `$(` or a backtick is kept verbatim, so `"$(rm x)"` is still seen.
function stripQuotes(s) {
  let out = '';
  let q = '';
  let buf = '';
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (!q) {
      if (c === "'" || c === '"') {
        q = c;
        buf = '';
      } else if (c === '\\') {
        out += c + (s[i + 1] ?? '');
        i += 1;
      } else out += c;
    } else if (q === "'") {
      if (c === "'") {
        out += 'Q';
        q = '';
      } else buf += c;
    } else if (c === '\\') {
      buf += c + (s[i + 1] ?? '');
      i += 1;
    } else if (c === '"') {
      out += buf.includes('$(') || buf.includes('`') ? `"${buf}"` : 'Q';
      q = '';
    } else buf += c;
  }
  if (q) out += q + buf;
  return out;
}

const segments = (cmd) => cmd.split(/&&|\|\||;|\||\$\(|\(|\)|`|\n/);

function normalize(seg) {
  let s = seg;
  let prev;
  do {
    prev = s;
    s = s
      .replace(/^\s+/, '')
      .replace(/^(env|sudo|command|time|nohup|exec)\s+/, '')
      .replace(/^[A-Za-z_][A-Za-z0-9_]*=\S*\s+/, '');
  } while (s !== prev);
  return s.trim();
}

const hasFileRedirect = (cmd) =>
  stripQuotes(cmd)
    .replace(/[0-9]*>>?\s*(\/dev\/null|&[0-9-])/g, '')
    .replace(/<<<?/g, '')
    .includes('>');

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---- shared denylist (implementer) --------------------------------------

const GIT = String.raw`^git(\s+-[Cc]\s+\S+)*\s+`;

function checkGitSegment(s) {
  if (new RegExp(`${GIT}(commit|push|pull|merge|rebase|reset|checkout|switch|stash|restore|clean|revert|cherry-pick|tag|am)(\\s|$)`).test(s)) {
    block(s, 'git history and the working-tree state belong to the user; agents leave their changes uncommitted.');
  }
  if (new RegExp(`${GIT}branch(\\s+\\S+)*\\s+(-[dDmMcCf]|--delete|--move|--copy|--force)(\\s|$)`).test(s)) {
    block(s, 'branches are created and deleted by the user.');
  }
  if (/^gh\s+pr\s+(create|ready|merge|close|reopen|edit|comment|review)(\s|$)/.test(s)) {
    block(s, 'a pull request is opened by the user after the reviews, not by an agent.');
  }
}

const DB_WRITE =
  /^((npm|pnpm|yarn|bun)\s.*\bdb:(migrate|seed|reset|drop|push|wipe)(\s|$)|((npx|pnpm\s+(exec|dlx)|yarn|bunx)\s+)?drizzle-kit\s+(migrate|push|drop|up)(\s|$)|((npx|pnpm\s+exec|yarn|bunx)\s+)?prisma\s+(migrate\s+(deploy|reset|dev)(?!.*--create-only)|db\s+(push|seed|execute))|php\s+artisan\s+(migrate|db:seed|db:wipe)(:\S+)?(\s|$)|(bundle\s+exec\s+)?(rails|rake)\s+db:(migrate|seed|drop|reset|setup)|alembic\s+(upgrade|downgrade)|((npx|pnpm\s+exec)\s+)?(knex|sequelize(-cli)?)\s+(migrate:latest|migrate:rollback|db:migrate|db:seed:all|seed:run)|(python3?\s+)?manage\.py\s+(migrate|flush|loaddata)|flyway\s+(migrate|clean)|liquibase\s+update)/;

function checkDbSegment(s) {
  if (DB_WRITE.test(s)) {
    block(s, 'migrations and seeds are not applied to a developer database from an agent session; generate the migration and let the user apply it.');
  }
  if (/^(docker\s+exec\s.*\s)?(dropdb|pg_restore)(\s|$)/.test(s)) {
    block(s, 'a database restore or drop destroys local data.');
  }
  if (/^docker(\s+compose|-compose)\s.*down.*\s(-v|--volumes)(\s|$)/.test(s) || /^docker\s+(volume\s+(rm|prune)|system\s+prune)(\s|$)/.test(s)) {
    block(s, 'removing Docker volumes destroys local data.');
  }
}

function checkSqlClient(cmd) {
  if (
    /(^|[\s"'])(psql|mysql|mariadb|sqlite3|mongosh)(\s|$)/.test(cmd) &&
    /(insert\s+into|update\s+[\w".]+\s+set|delete\s+from|drop\s+(table|database|schema|index|collection)|alter\s+table|truncate\s|create\s+(table|database|index)|\.drop\(|\.deletemany\()/i.test(cmd)
  ) {
    block('a database client with a write statement', 'writes to a developer database are made by the user.');
  }
}

// ---- read-only allowlist -------------------------------------------------

const GIT_RO = new RegExp(`${GIT}(--no-pager\\s+)?(status|diff|log|show|blame|grep|ls-files|ls-tree|rev-parse|rev-list|merge-base|cat-file|describe|shortlog|name-rev|for-each-ref)(\\s|$)`);
const GIT_RO_EXTRA = new RegExp(`${GIT}(remote\\s+(-v|show|get-url)|stash\\s+(list|show)|worktree\\s+list|config\\s+--get)(\\s|$)`);
const TEXT_TOOLS = /^(ls|cat|head|tail|wc|grep|egrep|rg|find|sort|uniq|cut|tr|sed|diff|cmp|comm|nl|jq|realpath|readlink|dirname|basename|stat|file|du|tree|date|echo|printf|test|\[|true|false|cd|pwd|which|type|read|column|paste|tac|rev)(\s|$)/;
const STATIC = /^((npm|pnpm|yarn|bun)\s+(run\s+)?(typecheck|type-check|lint)|(npx|pnpm\s+exec|yarn|bunx)\s+(tsc\s.*--noEmit|depcruise|eslint)|tsc\s.*--noEmit|go\s+vet|cargo\s+(check|clippy)|ruff\s+check|mypy|bash\s+-n|node\s+--check)(\s|$)/;
const TESTS = /^((npm|pnpm|yarn|bun)\s+(run\s+)?test(:[\w-]+)?|(npx|pnpm\s+exec|pnpm|yarn|bunx)\s+(vitest\s+run|jest|mocha)|vitest\s+run|jest|pytest|python3?\s+-m\s+pytest|go\s+test|cargo\s+test|dotnet\s+test|mvn\s+(\S+\s+)*test|(\.\/)?gradlew?\s+test|make\s+(test|check)|just\s+(test|check)|php\s+artisan\s+test|(\.\/)?vendor\/bin\/(phpunit|pest)|(bundle\s+exec\s+)?rspec|node\s+--test)(\s|$)/;
const PLUGIN_SCRIPT = new RegExp(
  `(["']?)(?:${PLUGIN_ROOTS.map(escapeRe).join('|')}|\\$\\{?CLAUDE_PLUGIN_ROOT\\}?)/scripts/check-spec\\.mjs\\1`,
  'g',
);

function allowedGit(s) {
  if (GIT_RO.test(s) || GIT_RO_EXTRA.test(s)) return true;
  if (new RegExp(`${GIT}branch(\\s|$)`).test(s)) {
    const args = s.replace(new RegExp(`${GIT}branch`), '');
    if (/(^|\s)(-[dDmMcCf]|--delete|--move|--copy|--force|--set-upstream-to|-u|--unset-upstream|--edit-description)(\s|$)/.test(args)) return false;
    if (/(^|\s)[^-\s]/.test(args) && !/--(contains|merged|no-merged|points-at|sort|format)/.test(args)) return false;
    return true;
  }
  return false;
}

function checkCommandMatcher(profile) {
  if (!profile.checkCommand) return null;
  const parts = profile.checkCommand.trim().split('{package}').map((p) => escapeRe(p).replace(/\s+/g, '\\s+'));
  return new RegExp(`^${parts.join('\\S+')}(\\s|$)`);
}

function readonlySegment(raw, { allowTests, checkRe }) {
  let s = raw.replace(/^(if|then|else|elif|while|until|do|!|\{)\s+/, '');
  if (!s || /^(done|fi|else|then|do|\}|:)$/.test(s)) return;
  if (/^for\s+[A-Za-z_]\w*\s+in(\s|$)/.test(s)) return;

  if (/^git(\s|$)/.test(s)) {
    if (allowedGit(s)) return;
    block(s, 'only read-only git (status, diff, log, show, blame, grep, ls-files, rev-parse, …) is allowed.');
  }
  if (TEXT_TOOLS.test(s)) {
    if (/^find(\s.*)?\s-(delete|exec|execdir|ok|okdir|fprint|fprint0|fprintf|fls)(\s|$)/.test(s)) block(s, 'find may only list files here.');
    if (/^sed(\s.*)?\s(-[A-Za-z]*i[A-Za-z.]*|--in-place)([\s=]|$)/.test(s)) block(s, 'sed may only print here.');
    if (/^sort(\s.*)?\s(-[A-Za-z]*o[A-Za-z]*|--output)([\s=]|$)/.test(s)) block(s, 'sort may only print here.');
    return;
  }
  if (STATIC.test(s)) {
    if (/(^|\s)(--fix|--write)(\s|=|$)/.test(s)) block(s, 'a fixing linter rewrites files.');
    return;
  }
  if (/^node\s+sdd-check-spec(\s|$)/.test(s)) return;
  const isCheck = checkRe && checkRe.test(s);
  if (isCheck || TESTS.test(s)) {
    if (!allowTests) block(s, 'this agent does not run tests or the check command; name the command under "Not checked" in the report.');
    if (/(^|\s)(-u|--update|--updateSnapshot|--update-snapshots|--watch|--watchAll|-w)(\s|=|$)/.test(s)) block(s, 'tests run once and never rewrite snapshots.');
    return;
  }
  block(s, `not on the read-only allowlist (read-only git, text tools, typecheck/lint without --fix, the plugin's check-spec.mjs${allowTests ? ', the check command, test runners' : ''}).`);
}

function checkReadonlyCommand(cmd, opts) {
  if (!cmd) return;
  const marked = cmd.replace(PLUGIN_SCRIPT, 'sdd-check-spec');
  if (hasFileRedirect(marked)) block(cmd, 'redirecting output into a file is a write.');
  const bare = stripQuotes(marked);
  if (/--output(-to)?([=\s]|$)/.test(bare)) block(cmd, 'writing command output to a file is a write.');
  for (const seg of segments(bare)) {
    const s = normalize(seg);
    if (s) readonlySegment(s, opts);
  }
}

function checkImplementerCommand(cmd) {
  if (!cmd) return;
  checkSqlClient(cmd);
  for (const seg of segments(cmd)) {
    const s = normalize(seg);
    if (!s) continue;
    checkGitSegment(s);
    checkDbSegment(s);
  }
}

// ---- paths ----------------------------------------------------------------

const LOCKFILE = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|bun\.lockb?|Cargo\.lock|poetry\.lock|Pipfile\.lock|composer\.lock|Gemfile\.lock|go\.sum|uv\.lock|pdm\.lock|mix\.lock)$/;
const MIGRATION = /(^|\/)(migrations|db\/migrate)\/./;

function repoRel(p, root, cwd) {
  const abs = realish(isAbsolute(p) ? p : resolve(cwd, p));
  if (abs === PLUGIN_ROOT || abs.startsWith(PLUGIN_ROOT + sep)) block(p, "the plugin's own files (agents, guards, scripts) are changed by its maintainers, not by an agent.");
  const rel = relative(root, abs);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) block(p, 'agents only edit files inside the project directory.');
  return { rel: rel.split(sep).join('/'), abs };
}

function checkProtected(rel, abs, profile) {
  if (LOCKFILE.test(rel)) block(rel, "lockfiles are never hand-edited; change the dependency through the package's own manager.");
  if (/(^|\/)\.env(\.[^/]*)?$/.test(rel) && !/\.example$/.test(rel)) block(rel, 'local environment and secrets; document a new variable in .env.example instead.');
  if (/^\.claude\/(settings(\.local)?\.json|sdd-profile\.md)$/.test(rel)) block(rel, 'hook settings and the SDD profile are changed by the user.');
  if (MIGRATION.test(rel) && existsSync(abs)) block(rel, 'an existing migration is never edited; write or generate a new one.');
  for (const pattern of profile.protectedPaths) {
    if (globToRegExp(pattern).test(rel)) block(rel, `protected by protected_paths in .claude/sdd-profile.md (${pattern}).`);
  }
}

function specHeaderStatus(abs) {
  const header = [];
  for (const line of readFileSync(abs, 'utf8').split(/\r?\n/)) {
    if (/^## /.test(line)) break;
    header.push(line);
  }
  const status = header.find((l) => /^Status:/.test(l));
  return status ? status.trim() : '';
}

function checkSpecPath(rel, abs, profile) {
  if (/(^|\/)(CLAUDE|AGENTS|INSIGHTS)\.md$/.test(rel)) block(rel, 'project instructions and insights are not spec files.');
  const dirs = profile.specDirs.map(escapeRe).join('|');
  if (new RegExp(`^(${dirs})/README\\.md$`).test(rel)) return;
  if (!new RegExp(`^(${dirs})/\\d{4}-\\d{2}-\\d{2}-[a-z0-9]+(-[a-z0-9]+)*\\.md$`).test(rel)) {
    block(rel, `spec-creator writes specs only: <YYYY-MM-DD>-<feature-slug>.md in ${profile.specDirs.join(', ')}, plus that folder's README.md index.`);
  }
  if (/-plan\.md$/.test(rel)) block(rel, "an Implementation Plan is saved from implementation-planner's output; spec-creator does not write it.");
  if (existsSync(abs) && specHeaderStatus(abs) !== 'Status: draft') {
    block(rel, 'only a spec whose header says `Status: draft` is changed; an approved or implemented one is replaced by a new spec with Supersedes.');
  }
}

// ---- main -----------------------------------------------------------------

function judge(payload) {
  const type = payload.agent_type;
  if (typeof type !== 'string' || !type.startsWith(`${PLUGIN}:`)) return null;
  const agent = type.slice(PLUGIN.length + 1);
  const mode = AGENTS[agent];
  if (!mode) return null;

  const rootGiven = process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd();
  const root = realish(resolve(rootGiven));
  const cwd = payload.cwd ? resolve(payload.cwd) : root;
  const profile = loadProfile(root);
  const tool = payload.tool_name;
  const input = payload.tool_input ?? {};

  try {
    if (tool === 'Bash') {
      const cmd = typeof input.command === 'string' ? input.command : '';
      if (mode === 'implementer') checkImplementerCommand(cmd);
      else checkReadonlyCommand(cmd, { allowTests: mode === 'verifier', checkRe: checkCommandMatcher(profile) });
      return null;
    }
    if (!['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) return null;
    if (mode === 'readonly' || mode === 'verifier') block(tool, 'this agent is read-only: no file-writing tools.');
    if (mode === 'specs' && tool === 'NotebookEdit') block(tool, 'notebooks are outside this agent\'s scope.');
    const p = tool === 'NotebookEdit' ? input.notebook_path : input.file_path;
    if (typeof p !== 'string' || !p) block(tool, 'no file path in the tool input.');
    const { rel, abs } = repoRel(p, root, cwd);
    checkProtected(rel, abs, profile);
    if (mode === 'specs') checkSpecPath(rel, abs, profile);
    return null;
  } catch (e) {
    if (e instanceof Blocked) return `${PLUGIN} guard (${agent}): blocked ${e.message} Do not work around this. ${HINTS[mode]}`;
    throw e;
  }
}

try {
  const text = readFileSync(0, 'utf8');
  const reason = judge(JSON.parse(text || '{}'));
  if (reason) {
    process.stderr.write(`${reason}\n`);
    process.exit(2);
  }
  process.exit(0);
} catch (e) {
  process.stderr.write(`${PLUGIN} guard failed (${e?.message ?? e}), so it fails closed.\n`);
  process.exit(2);
}
