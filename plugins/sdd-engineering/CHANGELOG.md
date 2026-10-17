# Changelog

All notable changes to `sdd-engineering`. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [SemVer](https://semver.org/).

## [1.1.0] - 2026-10-17

### Added

- `spec-creator` does not finish a spec while a mandatory requirement (every `G-n`, every `US-n`) has no acceptance criterion: it writes the criterion the sources support, or marks it `[NEEDS CLARIFICATION]` and returns a blocking question — never invents one, never drops the requirement.
- `check-spec`: a goal must reach an AC through `covers:` when the template has no Traceability section.
- Eval `spec-requires-ac`.

## [1.0.0] - 2026-10-17

### Added

- Agents `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`.
- Skill `/sdd-engineering:run-plan` (manual only): implementers → check command → plan-verifier → architecture review with up to three fix rounds.
- Skill `engineering-insights` with the append-only `append-insight.mjs`.
- Skill `/sdd-engineering:workflow-retro` (manual only) with `collect-run.mjs` and `ledger.mjs`.
- Optional project profile `.claude/sdd-profile.md`; generic spec template; `check-spec.mjs`.
- `PreToolUse` guard scoped by `agent_type`, with `guard-cases.tsv` and `check-guards.mjs`.
