---
name: run-plan
description: "Spec Driven Development, the build half: executes an approved Implementation Plan with sdd-engineering:implementer agents (one brief each), runs the project's check command, then sdd-engineering:plan-verifier, then architecture-review:architecture-reviewer with fix rounds until its findings are closed, and reports. Manual only — the user types /sdd-engineering:run-plan. spec-creator and implementation-planner are run before it."
disable-model-invocation: true
argument-hint: "<plan or spec path> [design paths…] [notes for this run]"
---

# /sdd-engineering:run-plan — build an approved plan

You are the calling session of the Spec Driven Development pipeline, from the approved plan
onwards. You orchestrate and the agents work: you write no code, you do not read the diff or the
source files, and you do not repeat a check that an agent's report already carries. Work
economically (profile reference § 9).

Arguments: $ARGUMENTS

Project facts come from `${CLAUDE_PLUGIN_ROOT}/templates/profile-reference.md`, read once in
step 0 and applied (§ 1: the repository's instructions win over this skill).

## Not in this skill

- `sdd-engineering:spec-creator` and `sdd-engineering:implementation-planner` — the user runs them
  first. No plan, or a plan that is not ready, is a reason to stop, never a reason to write one.
- Test writing beyond the plan's own `Tests to add`, documentation, and a security review — this
  plugin ships no agent for them. The report says what was left out.
- Commits, pushes, PRs, dev servers, migrations on a developer database.

## 0 — Preflight

1. Sort the arguments:
   - a path ending in `-plan.md` → the plan; another `.md` in a spec folder → the spec, and the
     plan is the file beside it with `-plan` before `.md`;
   - image or PDF paths, and anything under a design folder → design references;
   - the remaining text → notes for this run.
2. In one message: read `${CLAUDE_PLUGIN_ROOT}/templates/profile-reference.md`,
   `.claude/sdd-profile.md` when it exists, `grep -n '^## \|^### Stage' <plan>`,
   `git rev-parse --short HEAD`, `git status --short`. Then read the plan's header, §6, §7 and §9 —
   not the stages, they are the implementers'. A plan written before §9 carried briefs: cut its
   stages into briefs of one or two, in order, one track.
3. Resolve the check command: the plan's §6, else the profile reference § 4. None found → keep
   that section's "not run" line for the report, and skip step 2 and every "check" step of a fix
   round — never invent a command, never loop over a check that cannot run.
4. Stop and say what is missing when:
   - there is no plan file → "run `sdd-engineering:implementation-planner` on the approved spec
     first";
   - the plan's `Source:` is a spec with a `Status:` line that is not `approved`;
   - §7 holds a `[blocking]` line tagged `[→ spec-creator]` for a stage of this run → a gap in the
     requirements is settled in the spec, never by a question here: "send it to
     `sdd-engineering:spec-creator`, then the plan back to `sdd-engineering:implementation-planner`".
5. Ask the user (`AskUserQuestion`), never answer yourself, when:
   - §7 still holds another `[blocking]` line or §9 `Mode:` is undecided. An answer that only settles
     the mode or confirms the option the plan assumes is recorded in the plan (§9 `Mode:`, §7); any
     other answer means the plan goes back to `implementation-planner` — stop;
   - a note asks for behaviour the plan does not contain. That is a requirement and belongs in the
     spec and the plan, not in a brief: continue without it, or stop. A note may only narrow the run
     (which stages, which track) or say how to run it.
6. Keep the `git status --short` list: those files were changed before this run, and the verifier
   and the reviewer are told so. `HEAD` differing from the plan's `Base:` is said to the user, then
   the run goes on.

## 1 — Implement

- Order by the §9 table: a track marked `alone` by itself, `parallel` tracks together; inside a
  track the briefs strictly in order.
- One `sdd-engineering:implementer` per brief, a fresh one every time. The first brief of every
  parallel track is launched in a single message; when one reports, that track's next brief starts.
  Two implementers whose write sets overlap never run together.
- The prompt is the brief as §9 words it, plus the notes that apply to it, plus the design
  references — only for a brief whose write set holds UI code.
- From each report read `Status`, `Verification` and `Not done / blockers`:
  - `done` → the next brief;
  - `partial` or `blocked` → that track stops. A blocker only the user can decide is asked; a
    missing change outside the write set becomes a fix brief (below) once no running implementer
    owns that file.

## 2 — One check over everything

Run the check command once for every package the run touched (and any other §6 row the plan marks
as required). Red → a fix round before any agent reviews the diff. No check command → skip this
step; the report carries the "not run" line.

## 3 — plan-verifier

One `sdd-engineering:plan-verifier`; remember the instance for the recheck. Give it the plan path,
the `Deviations from the plan` and `Not done / blockers` sections of the implementation reports as
they were returned, and the list of files changed before the run.

- `missing`, `partial`, `deviated (undeclared)` → a fix round, then a recheck: `SendMessage` to that
  same instance with the items. A test the plan lists under `Tests to add` is such an item — the
  implementer writes it.
- An acceptance criterion with no test at all and no plan item asking for one is not fixed here: it
  goes into the report.
- A `Needs a test run` row the check command covers → run it; any other → the report.
- At most two fix rounds; items still open after them go to the user.

## 4 — Architecture review, with fix rounds

Start `architecture-review:architecture-reviewer` with the plan path (its `Base:` and §8), the
`architecture_docs` of the profile, and the list of files changed before the run. Remember the
instance. Then loop:

1. No CRITICAL and no WARNING → leave the loop. A SUGGESTION is never fixed here; it goes into the
   report.
2. A fix round for every CRITICAL and WARNING.
3. The check command on the packages the fix touched (when one exists).
4. Recheck: `SendMessage` to the same reviewer instance with the IDs of the findings that were
   fixed and the files the fix touched. It answers per finding — `resolved`, `still open`,
   `changed` — and reviews only the lines the fix changed.

At most three fix rounds. Stop the loop and ask the user — another round, accept what is open and go
on, or stop — when the cap is reached with a CRITICAL or WARNING open, when the same finding is
`still open` after two attempts, or when fixing a finding would contradict the plan or the spec:
then the plan is what is wrong, and that is not the implementer's call.

When at least one fix round ran here: one recheck by the `plan-verifier` instance, limited to the
files those fixes touched, then step 2 once more.

## Fix round

Used by steps 2, 3 and 4.

- Group the items by package; one fresh `sdd-engineering:implementer` per group, groups with
  disjoint files in one message.
- The brief:

  ```
  Fix brief for <plan path> — <check | plan-verifier | architecture review>, round <n>.
  Items, as returned:
  <the finding blocks, the verifier rows or the check excerpt — pasted, not retold>
  Write only inside: <the files the items name, and their tests>.
  Fix exactly these items; anything else you notice goes under "Not done / blockers".
  Check with: <the check command for the package | none found — run nothing invented>.
  ```

- Never paraphrase a finding, never widen a brief, never make the fix yourself.

## 5 — Report

In the user's language, short:

- the plan, the mode, the briefs that ran;
- the final check lines, as printed — or the § 4 "not run" line, with the criteria that therefore
  need a test run;
- `plan-verifier`: its counts, and what is still not done;
- the review: findings fixed per round, what stays open (SUGGESTIONs, items the user accepted), how
  many rounds it took;
- not run: tests for the criteria that have none, documentation, a security review — not part of
  this plugin — and the security surfaces the plan's §8 names;
- next: the user reviews the diff and commits.

## Never

- Edit production code, tests, a spec or a plan's stages — the plan's `Mode:` line and a settled §7
  question are the only lines of it you write.
- Commit, push, open a PR, start a dev server, or run a migration on a developer database.
- Start `spec-creator` or `implementation-planner`.
- Answer an agent's `Questions for the user` or `Clarification needed` for the user.
- Start a new reviewer or verifier for a recheck when the first instance can be messaged.
- Go past a round cap without asking, or invent a check command.
