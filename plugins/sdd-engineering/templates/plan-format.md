# Implementation Plan format

The one copy of the plan's shape. `implementation-planner` writes it; `implementer`,
`plan-verifier` and `/sdd-engineering:run-plan` read plans in it by their section numbers.

## Where it lives

Beside its spec, under the same name with `-plan` before `.md`:
`<specs_dir>/<YYYY-MM-DD>-<feature-slug>-plan.md`. The calling session saves it from the
planner's output once the user approves it (profile reference § 5).

## Skeleton

```
# Implementation Plan — <feature>
Source: <<specs_dir>/<slug>.md | task text> · Base: <git rev-parse --short HEAD> · Packages: <…>

## 0. Before the first edit
- Instructions: <CLAUDE.md / AGENTS.md files read; any rule of theirs that overrides the plugin>
- INSIGHTS: `<file> § <section>` — "<entry title>" → <how it shapes this plan>   (or: none bear | none exist)
- Read: <spec, docs, package README sections>
- Routing: <skill_routing used | missing → fell back to <files>>

## 1. Scope — as the source states it
Goal: <source wording> — `<file:line | task text | user answer>`
Non-goals: <source wording> — `<pointer>`   (or: none stated)
Acceptance criteria:
- AC1 <source wording> — `<pointer>` — <clear | already there `file:line` | open → F<n>>
- AC2 …

## 2. Impact map
| Package | Path | New / Modify | Layer or placement | AC |
|---|---|---|---|---|

## 3. Constraints in play
- <architecture rules (from architecture_docs, dependency checks) this change must keep green>
- <contract copies / migration / i18n / naming items that apply>

## 4. Stages
### Stage N — <title>
Track: <name from section 9> · After: <stage numbers | —>
Files: <paths>
Read first: <path[:from-to]>, <path> — <what each shows: the code to change, the pattern to follow>
Steps:
1. <concrete change, naming types, functions, columns, keys>
Skills: `engineering-paved-path:<skill>` → `<rules file>` — <the rule that shapes this stage>
Tests to add: `<path>` — <what it proves, which AC>
Done when: <command or observable check>

## 5. Skills matrix
| Stage | <skill> | <skill> | … |
|---|---|---|---|
(only columns that are used; a cell names the rules file, not just ✓)

## 6. Verification
| Package | Command (from the repository root) | Proves |
|---|---|---|
| <package> | `<the resolved check command for it>` | <typecheck, lint, tests — what it covers for this change> |
(list only the rows the change needs; a check the command does not run — a `diff -u` of contract
copies, an e2e suite the plan needs — gets its own row. No check command found → one row:
`Verification: not run — no check command found; set check_command in .claude/sdd-profile.md`,
and the ACs it would have proven are marked "needs a test run")

## 7. Risks and open questions
- [blocking] [→ spec-creator] F1 <AC-n | R-n>: <what the source leaves undecided> — stage <n> waits for the spec
- [blocking] <a decision about the plan that is the user's> — options: <a / b>   (every [blocking] also stands in "Questions for the user")
- [non-blocking] <question>
- [→ researcher] <external fact to confirm, e.g. library behaviour at the pinned version>

## 8. Handoff to reviewers
- Architecture: <new ports, cross-module edges, layer placements worth a second look>
- Security: <new routes, user input, file or archive handling, secrets, raw SQL, HTML rendering>

## 9. Execution
Mode: <multi-agent | single-agent> — stated in <where>   (or: undecided → question 1)
Recommended: <mode> — <reason: independent tracks, shared files, size>
| Track | Stages | Write set | After | Runs |
|---|---|---|---|---|
| shared | 1 | `<contract paths>` | — | alone |
| <track> | 2–4 | `<paths>` | shared | parallel |
| <track> | 5–6 | `<paths>` | shared | parallel |
| join | 7 | … | <tracks> | alone |
Briefs — one or two stages each, a fresh `implementer` per brief, in order inside a track:
- <track> · stages <n–m> → "Execute stages <n–m> of <plan path> (track <track>). Write only inside: <write set>. Check with: <check command for the package | none found>."
single-agent: the same briefs, one after another, 1 → N; the Runs column is not used.

## 10. Recommendations — not applied
- REC1 [requirements | approach | scope] <what to do differently> — why: <evidence> — would change: <stages / criteria>
(or: none)
```

## Stage rules

Stages are ordered so each ends in something verifiable, the provider before its consumer,
contracts first. Keep a stage to one concern; 3–8 stages is typical.

`Read first:` lists the files the planner opened to write the stage — the module it changes, the
neighbour whose pattern it follows, the test that shows the fixtures — with a line range for a
long one (`path:120-180`). The implementer reads exactly these in one message instead of finding
them again one command at a time; a file missing from the list costs it a turn, a file it does not
need costs it context on every turn after. Skill rules are not listed here — they stand on the
`Skills:` line.

## Tracks and briefs

- **single-agent** — nothing runs in parallel: the stages are executed in order, 1 → N, one
  `implementer` at a time (or by the calling session).
- **multi-agent** — the stages are grouped into tracks; tracks with disjoint write sets run in
  parallel, and the calling session runs the agents that follow (`/sdd-engineering:run-plan`).

In either mode no `implementer` runs longer than one **brief**: one or two stages, three when they
are trivial. An implementer's cost is the number of its turns times the size of its context, so
one long run costs several times what the same stages cost in short ones (measured on the project
this workflow comes from: one run of 312 turns re-read 82.6M tokens, three runs of about 50 turns
28M together). A track of more stages is a sequence of briefs, each handed to a fresh
`implementer` once the previous one has reported.

Building the tracks:

- A track is a run of stages one agent can finish without waiting for another track. Its **write
  set** is every path its stages create or modify.
- Parallel tracks have disjoint write sets. A file two tracks need — every copy of a shared
  contract, a message catalogue, the DI wiring, a schema file with its generated migration, a
  shared registry — belongs to a stage that runs alone, before the fork.
- Contracts first, then the fork; whatever joins the tracks (wiring, a journey that crosses
  packages) runs alone at the end.
- A change to a package another one compiles against is not parallel to that other package's
  track: its check stays red until the change lands, so that track runs `After:` it.
- Each track is cut into briefs of one or two stages, in order. A brief is what the calling session
  hands to an `implementer` as is: plan path, track, stages, write set, the check to run.

What to recommend:

- **multi-agent** when at least two tracks are independent after the shared stage and each is more
  than a stage of trivial edits — typically back end ∥ front end.
- **single-agent** when the stages chain (each needs the previous one's output), when they touch the
  same files, or when the whole change is one package and three stages or fewer: parallel agents
  then cost tokens and add a merge risk for no time saved.
