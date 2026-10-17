# Cost baseline — sdd-engineering

What one short SDD workflow costs, and whether an optimisation kept quality.

## Scenario

The fixed case `plugins/sdd-engineering/evals/spec-and-plan`: in the `notes-api` fixture
repository the user asks for a spec and a plan of a small feature (tags on notes). The
session runs `sdd-engineering:spec-creator`, approves on the user's standing instruction,
runs `sdd-engineering:implementation-planner`, and implements nothing. Quality gate: all
graders of the case pass (agents ran, files written, spec and plan quality judged by an LLM
grader, nothing implemented).

```bash
claude plugin eval plugins/sdd-engineering --case spec-and-plan --runs 3 \
  --ablation none --scaffold --trust-plugin \
  --allow-tools Bash Write Edit --no-publish --json <out>.json \
  --model <model>
```

`--plugin-dir`-style loading of the three dependencies: the eval resolves dependencies from
the installed marketplace; see the run notes below.

## Runs

_Filled in from the eval JSON — never estimated._
