---
name: review-rubric
description: "Severity rubric, finding contract, recheck protocol and diff-collection script for the architecture reviewer: CRITICAL / WARNING / SUGGESTION with the three-part CRITICAL test, the finding fields (severity · band · file · line · in_diff · skill · rule_source · title · evidence · failure · fix · verified), and collect-diff.sh, which lists the open changes (branch since merge base + uncommitted + untracked). Use when gating architecture findings or collecting the diff under review."
user-invocable: false
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/collect-diff.sh *), Bash(sh ${CLAUDE_SKILL_DIR}/scripts/collect-diff.sh *), Bash(bash ${CLAUDE_SKILL_DIR}/scripts/collect-diff.sh *)
---

# Review rubric

The rules every architecture finding is gated by, and the script that says which files
are under review.

## Severity and the finding contract

Read [references/severity.md](references/severity.md) before writing any finding. It
holds the scale, the three-part test for CRITICAL, the mapping from each rulebook's own
labels, the finding contract (text and JSON) and the recheck protocol. Those shapes are
consumed by other tools (sdd-engineering's review gate parses them) — keep field names and
order literal.

## Collecting the diff

```bash
${CLAUDE_SKILL_DIR}/scripts/collect-diff.sh [--base <ref>] [--scope branch|working] [--format json|list|diff] [--max-lines <n>]
```

- `--scope branch` (default): committed on the branch since the merge base with the base
  ref, plus uncommitted and untracked files. `--scope working`: uncommitted and untracked only.
- Base resolution when `--base` is absent: the branch's upstream, then `origin/HEAD`,
  `origin/main`, `origin/master`, `main`, `master`.
- `--format list`: one file per line. `diff`: the unified diff of the included files.
  `json` (default): base, merge base, branch, head sha, included / deleted / skipped files.
- Excluded: lockfiles, `node_modules/`, binary assets, `*.tsbuildinfo`, `*.log`, `*.map`.
  Files with more than `--max-lines` changed lines (default 1500) are listed as skipped.

| Exit | Meaning |
|---|---|
| `0` | done; empty output means nothing changed since the base |
| `3` | not a git repository, or no base / merge base could be resolved — ask for `--base` |
| `64` | bad arguments |
| `69` | `node` is not installed |

The script only reads git state; it never writes, fetches or changes refs. It needs Node
22 or newer.
