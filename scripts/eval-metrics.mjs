#!/usr/bin/env node
// Per-run cost metrics from `claude plugin eval --keep-temp` traces: tokens, API calls, tool calls.
//   node scripts/eval-metrics.mjs <aggregate-result.json | --json output> [--md]
import { readFileSync, existsSync } from 'node:fs';

const [file, flag] = process.argv.slice(2);
if (!file) {
  console.error('usage: eval-metrics.mjs <eval json> [--md]');
  process.exit(2);
}
const result = JSON.parse(readFileSync(file, 'utf8'));
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const rows = [];
for (const c of result.cases ?? []) {
  for (const [i, run] of (c.arms?.with ?? []).entries()) {
    const row = { case: c.name, run: i + 1, score: run.score, passed: run.passed, costUsd: run.costUsd, judgeUsd: run.judgeCostUsd, seconds: run.durationSeconds };
    if (run.tracePath && existsSync(run.tracePath)) {
      const lines = readFileSync(run.tracePath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      const msgIds = new Set();
      let tools = 0, agents = 0;
      for (const l of lines) {
        if (l.type !== 'assistant') continue;
        msgIds.add(l.message.id);
        for (const part of l.message.content ?? []) {
          if (part.type !== 'tool_use') continue;
          tools++;
          if (part.name === 'Agent' || part.name === 'Task') agents++;
        }
      }
      const final = lines.findLast((l) => l.type === 'result');
      const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
      for (const m of Object.values(final?.modelUsage ?? {})) {
        usage.input += m.inputTokens ?? 0;
        usage.output += m.outputTokens ?? 0;
        usage.cacheRead += m.cacheReadInputTokens ?? 0;
        usage.cacheWrite += m.cacheCreationInputTokens ?? 0;
      }
      Object.assign(row, usage, { mainApiCalls: msgIds.size, mainToolCalls: tools, agentLaunches: agents, models: Object.keys(final?.modelUsage ?? {}).join(' '), turns: final?.num_turns });
    }
    rows.push(row);
  }
}

if (flag === '--md') {
  const cols = ['run', 'score', 'costUsd', 'seconds', 'input', 'output', 'cacheRead', 'cacheWrite', 'mainApiCalls', 'mainToolCalls', 'agentLaunches'];
  console.log(`| ${cols.join(' | ')} |\n|${cols.map(() => '---').join('|')}|`);
  for (const r of rows) console.log(`| ${cols.map((k) => (typeof r[k] === 'number' && !Number.isInteger(r[k]) ? r[k].toFixed(3) : r[k] ?? 'n/a')).join(' | ')} |`);
  const num = (k) => rows.map((r) => r[k]).filter((x) => typeof x === 'number');
  console.log(`\nmedian cost $${median(num('costUsd')).toFixed(3)} · median latency ${median(num('seconds')).toFixed(0)}s · pass rate ${rows.filter((r) => r.score === 1).length}/${rows.length} · suite cost incl. judge $${result.costUsd?.toFixed(3)}`);
} else {
  console.log(JSON.stringify(rows, null, 2));
}
