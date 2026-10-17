#!/usr/bin/env node
// Runs every row of hooks/guard-cases.tsv through hooks/readonly-guard.mjs and compares the
// exit code. No model, no network. Columns: expected_exit, agent_type ("-" = none),
// tool_name ("RAW" = send input as raw stdin), input (Bash command or file path; \n and \t
// are unescaped; {PLUGIN_ROOT} becomes the plugin directory).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const guard = join(root, 'hooks/readonly-guard.mjs');
const rows = readFileSync(join(root, 'hooks/guard-cases.tsv'), 'utf8').split('\n');

let failed = 0;
let total = 0;
for (const [n, line] of rows.entries()) {
  if (!line.trim() || line.startsWith('#') || line.startsWith('expected_exit\t')) continue;
  const [expected, agent, tool, rawInput = ''] = line.split('\t');
  const input = rawInput.replaceAll('{PLUGIN_ROOT}', root).replace(/\\([nt\\])/g, (_, c) => ({ n: '\n', t: '\t', '\\': '\\' })[c]);
  let stdin;
  if (tool === 'RAW') {
    stdin = input;
  } else {
    const payload = { session_id: 'check-guard', hook_event_name: 'PreToolUse', tool_name: tool, cwd: root };
    if (agent !== '-') Object.assign(payload, { agent_type: agent, agent_id: 'check-guard-agent' });
    payload.tool_input = tool === 'Bash' ? { command: input } : { file_path: input, content: 'x' };
    stdin = JSON.stringify(payload);
  }
  total++;
  const res = spawnSync(process.execPath, [guard], { input: stdin, encoding: 'utf8', env: { ...process.env, CLAUDE_PLUGIN_ROOT: root } });
  const got = String(res.status);
  if (got !== expected) {
    failed++;
    console.log(`FAIL line ${n + 1}: expected ${expected}, got ${got} — ${agent} ${tool}: ${rawInput}`);
    if (res.stderr) console.log(`     stderr: ${res.stderr.trim()}`);
  }
}
console.log(`${total - failed}/${total} guard cases pass`);
process.exit(failed ? 1 : 0);
