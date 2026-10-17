# Project profile — how the sdd-engineering agents learn a repository

The one place the `sdd-engineering` agents and skills take their project facts from. Every agent
reads this file before its first step and applies it; none restates it.

## 1. Precedence

1. The repository's own instructions — `CLAUDE.md` and `AGENTS.md` at the root and in every
   package the task touches (and the files they import). **When they disagree with this plugin,
   they win**; say in your report which rule of theirs you followed instead of the plugin's.
2. The project profile `.claude/sdd-profile.md`, when it exists.
3. Discovery (§ 3) for every key the profile leaves out.
4. The defaults below.

Paths in a profile, a spec, a plan and a report are relative to the repository root, never
absolute.

## 2. The profile

`.claude/sdd-profile.md` is an optional markdown file whose first fenced `yaml` block holds the
keys (template: the plugin's `templates/sdd-profile.example.md`). Read it with `Read`. Only flat
keys, strings and lists are used.

| Key | Meaning | Default when absent |
|---|---|---|
| `specs_dir` | where specs and plans live | `specs` |
| `spec_template` | the spec template in use | `<specs_dir>/TEMPLATE.md` when it exists, else the plugin's `templates/spec-template.md` |
| `check_command` | the one "does it still hold" command — typecheck, lint, tests in one call; `{package}` is replaced by a package directory | discovered (§ 4) |
| `packages` | package directories of a monorepo (`apps/web`, `services/api`) | none: the repository is one package |
| `insights_files` | the insights files agents read before editing and append to through `sdd-engineering:engineering-insights` | `INSIGHTS.md`, plus `<package>/INSIGHTS.md` for each listed package where it exists |
| `architecture_docs` | files that state the architecture rules (layering, placement, dependency-cruiser or ArchUnit configs) | discovered from the project instructions; none is fine |
| `skill_routing` | what maps a file to the skills that govern it: a skill id, or a repository file | `engineering-paved-path:skill-routing` |
| `protected_paths` | globs the implementer must not edit, on top of the built-in list (§ 6) | none |
| `retro_dir` | where `/sdd-engineering:workflow-retro` writes ledger entries | `docs/retro/ledger` |

A key the profile sets wins over discovery. A profile value that names a missing file is
reported, never silently replaced.

## 3. Discovery

When the profile is absent or silent on a key, learn it from the repository, in this order:

1. Project instructions — `CLAUDE.md`, `AGENTS.md` (root and per package), `CONTRIBUTING.md`,
   the README sections they point to.
2. Package manifests — `package.json` (`scripts`, `workspaces`), `pnpm-workspace.yaml`,
   `pyproject.toml`, `go.mod`, `Cargo.toml`, `composer.json`, `Gemfile`, `pom.xml`,
   `build.gradle*`.
3. Task runners — `Makefile`, `justfile`, `Taskfile.yml`, scripts under `scripts/` or `bin/`
   that the instructions name.

Discovery reads; it never guesses. A fact no source states is reported as unknown.

## 4. The check command

Resolve it once per run, in this order, and use the first that exists:

1. `check_command` of the profile.
2. A command the project instructions name for verification ("run X before a PR", "tests: X").
3. Manifest scripts — `package.json` `check`, `verify`, `test`, `typecheck`, `lint` (several of
   them chained with `&&` is one check); `Makefile` / `justfile` targets `check`, `test`, `lint`;
   `pyproject.toml` test tooling (`pytest`); `go test ./...` with a `go.mod`; `cargo test` with a
   `Cargo.toml`.

Use the package manager the lockfile shows (`pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn,
`bun.lock*` → bun, `package-lock.json` → npm). In a monorepo, run it per touched package —
`{package}` substituted, or from inside that package's directory.

**No check command found** — the agents never invent one. They write, word for word:

```
Verification: not run — no check command found; set check_command in .claude/sdd-profile.md
```

and every acceptance criterion that needed a run is marked `needs a test run`. The planner says
so in plan § 6, the implementer in its Verification table, the verifier under "Needs a test run",
and `/sdd-engineering:run-plan` in its final report — without fix rounds over a check that could
not run.

A check that cannot run here (needs Docker, a live key, a service) is reported as not run, with
the reason. A suite that skipped itself is not a pass.

## 5. Where files are written

| File | Path | Written by |
|---|---|---|
| Spec | `<specs_dir>/<YYYY-MM-DD>-<feature-slug>.md` — with `packages` set, a feature in exactly one package goes to `<package>/<specs_dir>/` | `spec-creator`, `Status: draft` only |
| Spec index | the `## Open specs` list of `<specs_dir>/README.md`, when that file exists | `spec-creator` |
| Approval | the spec's `Status:` line → `approved` | the calling session, after the user approves in so many words and `check-spec.mjs --for-approval` passes |
| Plan | beside its spec: `<specs_dir>/<YYYY-MM-DD>-<feature-slug>-plan.md` | the calling session, from `implementation-planner`'s output, once the user approves it |
| Code and tests | the plan's write sets | `implementer` |
| Insights | the `insights_files` | `sdd-engineering:engineering-insights` — only into a file that exists, unless the user asked to start one |
| Retro ledger | `<retro_dir>/<YYYY-MM-DD>-<run-slug>.md` | `/sdd-engineering:workflow-retro`, on the user's command |

Dates come from `date +%F`, never from memory or a neighbouring file.

## 6. Protected paths

The implementer never edits, and the guard refuses:

- lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock*`, `Cargo.lock`,
  `poetry.lock`, `Pipfile.lock`, `composer.lock`, `Gemfile.lock`, `go.sum`, `uv.lock`, …) — a
  dependency changes through its package manager;
- `.env` and `.env.*`, except `.env.example`;
- an existing file under a `migrations/` or `db/migrate/` directory — a new migration is
  generated or written new, an applied one is never edited;
- `.claude/settings*.json` and `.claude/sdd-profile.md`;
- the plugin's own files, and anything outside the project directory;
- every glob in `protected_paths`, and whatever the project instructions mark do-not-touch.

## 7. Insights

The insights files are read in full before the first edit in the area they cover — not grepped:
the entry that matters is the one nobody thought to search for. When no insights file exists, the
agents skip this silently and create none. Appending goes through
`sdd-engineering:engineering-insights` only.

## 8. Guards

The plugin's `PreToolUse` hook enforces the write limits of each agent (README § Guards). Hooks
may not run before the workspace-trust dialog is accepted, so every agent states its own limits
in its text and treats them as hard rules either way. A refused call is not worked around: it is
reported.

## 9. Working economically

An agent's cost is the number of its turns times the size of its context: every turn re-reads
everything read so far.

- **One message, many calls.** Reads, searches, read-only git and edits that do not depend on each
  other go out together in a single message. Ten files read one per turn re-read the context ten
  times; read together, once.
- **Read, Grep and Glob, not Bash.** `cat`, `sed -n`, `grep` and `ls` through Bash, one per turn,
  were half the cost of earlier runs. Bash is for commands that do something.
- **A slice, not the file.** A plan, a spec or a long source file is read by section or line range
  once you know which part you need.
