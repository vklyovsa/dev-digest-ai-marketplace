#!/usr/bin/env node
// Runs every row of hooks/guard-cases.tsv through hooks/agent-guard.mjs with a synthetic PreToolUse
// payload against a throwaway fixture project, and compares the exit code.
//
//   check-guards.mjs [--agent <name>] [--cases <file>] [--verbose]
//
// Exit 0 every row matches · 1 a mismatch · 64 usage.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GUARD = join(PLUGIN_ROOT, 'hooks', 'agent-guard.mjs');
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
for (const a of args) {
  if (a.startsWith('--') && !['--agent', '--cases', '--verbose'].includes(a)) {
    console.error(`check-guards: unknown argument ${a}`);
    process.exit(64);
  }
}
const CASES = opt('--cases') ?? join(PLUGIN_ROOT, 'hooks', 'guard-cases.tsv');
const ONLY = opt('--agent');
const VERBOSE = args.includes('--verbose');

const spec = (status) => `# Spec: Fixture\nSpec ID: SPEC-01\nStatus: ${status}\nSupersedes: none\n\n## Problem and user\nx\n`;
const FIXTURES = {
  default: {
    'specs/2026-10-01-draft-feature.md': spec('draft'),
    'specs/2026-10-02-approved-feature.md': spec('approved'),
    'specs/README.md': '# Specs\n\n## Open specs\n\n_None yet._\n',
    'migrations/0001_init.sql': 'create table x (id int);\n',
    'src/app.ts': 'export {};\n',
    'INSIGHTS.md': '# Insights\n',
    'CLAUDE.md': '# Instructions\n',
  },
  profiled: {
    '.claude/sdd-profile.md': [
      '# SDD profile',
      '',
      '```yaml',
      'specs_dir: docs/specs',
      'packages: [api, web]',
      'check_command: "make check PKG={package}"',
      'protected_paths:',
      '  - infra/**',
      '  - "*.generated.ts"',
      '```',
      '',
    ].join('\n'),
    'docs/specs/2026-10-01-draft.md': spec('draft'),
    'web/src/api.generated.ts': 'export {};\n',
    'specs/README.md': '# Specs\n',
  },
};

const base = realpathSync(mkdtempSync(join(tmpdir(), 'sdd-guards-')));
const roots = {};
for (const [name, files] of Object.entries(FIXTURES)) {
  roots[name] = join(base, name);
  for (const [rel, content] of Object.entries(files)) {
    const file = join(roots[name], rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
}

function run(agent, project, tool, input) {
  const root = roots[project];
  if (!root) throw new Error(`unknown project "${project}"`);
  const value = input.replaceAll('{root}', root).replaceAll('{plugin}', PLUGIN_ROOT);
  const payload = { session_id: 'check-guards', cwd: root, hook_event_name: 'PreToolUse', tool_name: tool };
  if (agent !== 'main') payload.agent_type = agent.includes(':') ? agent : `sdd-engineering:${agent}`;
  if (agent !== 'main') payload.agent_id = 'check-guards';
  payload.tool_input =
    tool === 'Bash' ? { command: value } : tool === 'NotebookEdit' ? { notebook_path: value } : { file_path: value };
  return spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify(payload),
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    encoding: 'utf8',
  });
}

let total = 0;
let failed = 0;
try {
  for (const [n, line] of readFileSync(CASES, 'utf8').split('\n').entries()) {
    if (!line.trim() || line.startsWith('#')) continue;
    const [agent, project, tool, input, expected] = line.split('\t');
    if (expected === undefined) {
      console.error(`check-guards: row ${n + 1} has fewer than 5 columns`);
      process.exitCode = 64;
      continue;
    }
    if (ONLY && agent !== ONLY) continue;
    const r = run(agent, project, tool, input);
    total += 1;
    const actual = String(r.status);
    if (actual !== expected.trim()) {
      failed += 1;
      console.log(`FAIL  row ${n + 1}: ${agent} ${project} ${tool} ${input} — expected ${expected.trim()}, got ${actual} ${r.stderr.trim()}`);
    } else if (VERBOSE) {
      console.log(`ok    ${agent} ${tool} ${input} → ${actual}${r.stderr ? `  (${r.stderr.trim()})` : ''}`);
    }
  }

  const raw = spawnSync(process.execPath, [GUARD], { input: '{not json', encoding: 'utf8' });
  total += 1;
  if (raw.status !== 2) {
    failed += 1;
    console.log(`FAIL  malformed payload: expected 2 (fail closed), got ${raw.status}`);
  }
} finally {
  rmSync(base, { recursive: true, force: true });
}

console.log(`check-guards: ${total - failed}/${total} rows match`);
if (failed) process.exitCode = 1;
