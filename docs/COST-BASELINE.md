# Cost baseline — sdd-engineering

What one short SDD workflow costs, and whether an optimisation kept quality.

## Scenario

The fixed case `plugins/sdd-engineering/evals/spec-and-plan`: in the `notes-api` fixture
repository the user asks for a spec and a plan of a small feature (tags on notes). The
session runs `sdd-engineering:spec-creator`, approves on the user's standing instruction,
runs `sdd-engineering:implementation-planner`, copies both files to `specs/_review/` for the
judges, and implements nothing.

```bash
scripts/eval.sh sdd-engineering --case spec-and-plan --runs 3 -j 3 \
  --ablation none --trust-plugin --scaffold --keep-temp \
  --allow-tools Bash Write Edit --model claude-opus-5-5 --json <out>.json
node scripts/eval-metrics.mjs <out>.json --md
```

- Model: `claude-opus-5-5` for the session and both agents (their frontmatter says `opus`).
- Claude Code 2.1.295; plugins loaded from the working tree with their three dependencies.
- Cost is the eval's per-run `costUsd` (list price, session + subagents, judges excluded).
  Tokens are summed over every model of the run (`modelUsage`); API and tool calls count the
  main session only.

## Quality gate

16 graders. Deterministic: both agents ran, no implementer ran, spec and plan files exist,
the spec says approved, has EARS criteria, AC IDs, an edge-case section, the tag limit and
the `GET /notes?tag=` filter, and no code blocks. LLM-judged: acceptance criteria describe
observable behaviour; the plan cites the spec, adds no requirement, names `npm test`, keeps
the repository's layering; no source or test file was edited.

A run passes when all 16 pass. Critical failure = a deterministic grader fails (wrong agent,
missing artifact, implementation started).

## Baseline — sdd-engineering 1.0.0 candidate, commit `b37449d`

| run | score | cost | latency | input | output | cache read | cache write | API calls | tool calls | agent launches |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1.000 | $1.750 | 412s | 52 | 42 860 | 814 183 | 121 505 | 24 | 35 | 2 |
| 2 | 0.938 | $1.826 | 487s | 48 | 47 953 | 716 370 | 119 864 | 22 | 34 | 2 |
| 3 | 0.875 | $2.793 | 683s | 92 | 67 906 | 1 457 732 | 192 726 | 41 | 62 | 5 |

Median cost **$1.826**, median latency **487 s**, pass rate 1/3, suite cost with judges
$6.37. Deterministic graders: 3/3 runs green — no critical failures. Failures: `plan-quality`
(2 runs) and `spec-behaviour-not-code` (1 run, votes PASS/FAIL/FAIL), both LLM judges on
14–20 k-character files, which Claude Code itself flags as noisy. Run 3 relaunched agents
(5 launches instead of 2) and is the outlier.

## Optimisation — one change: one copy of each shared instruction

Commit `6c5f719` (measured as `4c40e7d`, the same plus the eval changes). Duplicated blocks
removed from the four agents and `run-plan`; the plan format moved to
`templates/plan-format.md`, shared rules to `templates/profile-reference.md`; agents keep
pointers, their boundaries and their output contracts. Model, routing, tools unchanged.
Prompt sizes: `implementation-planner` 25.9 → 19.2 KB, `spec-creator` 31.2 → 27.8 KB.

| run | score | cost | latency | input | output | cache read | cache write | API calls | tool calls | agent launches |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1.000 | $1.852 | 433s | 48 | 45 600 | 716 864 | 132 936 | 22 | 43 | 2 |
| 2 | 1.000 | $1.842 | 499s | 54 | 47 342 | 846 130 | 120 761 | 25 | 52 | 2 |
| 3 | 0.938 | $2.276 | 525s | 66 | 56 360 | 1 012 195 | 161 674 | 30 | 67 | 3 |

Median cost **$1.852**, median latency **499 s**, pass rate 2/3, suite cost with judges
$5.97. Deterministic graders: 3/3 green. One failure: `plan-quality`, votes FAIL/FAIL/PASS.

## Result

| | median cost | median latency | max cost | pass rate | critical failures |
|---|---|---|---|---|---|
| baseline | $1.826 | 487 s | $2.79 | 1/3 | 0 |
| one copy per instruction | $1.852 | 499 s | $2.28 | 2/3 | 0 |

- **Cost: no measurable saving.** Medians differ by +1.4 % — inside run-to-run noise (the
  baseline alone spans $1.75–$2.79). We do not claim a saving.
- **Why:** the planner reads `plan-format.md` at Step 5 and keeps it for the rest of its run,
  and most of its turns come after Step 5; spec-creator lost only 3.4 KB of 31 KB. Moving
  text into an on-demand file saves only on turns before the file is read.
- **Quality gate: held.** No critical failure in either arm; the LLM-judged failures are
  the same grader on both sides and too noisy at n = 3 to call a difference.
- **Decision:** keep the change for maintainability (one place per rule), recorded as
  cost-neutral. The next candidate with a real expected effect is the number of agent
  launches (run 3 of the baseline doubled its cost by relaunching), not prompt size.

## Run log

| date | commit | arm | runs | notes |
|---|---|---|---|---|
| 2026-10-17 | `40594d1` | baseline | 3 | discarded: `focus: files` hands the judge file names only, every quality judge failed |
| 2026-10-17 | `a27adb7` | baseline | 3 | discarded: one LLM judge for the whole 14 k-char spec failed on every run; replaced by regex graders |
| 2026-10-17 | `b37449d` | baseline | 3 | above |
| 2026-10-17 | `4c40e7d` | optimisation | 3 | above |
