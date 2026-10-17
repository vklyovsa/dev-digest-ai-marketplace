# Mapping onto your repository

The layer map in `SKILL.md` is a default. Before applying it, find out how the
repository you are working in names its layers and which rules it already enforces.

## 1. Read what the repository says

| Source | What to take from it |
|---|---|
| `AGENTS.md` / `CLAUDE.md` (root and each backend package) | module shape, naming, "X must not import Y" rules, test lanes |
| `ARCHITECTURE.md`, `docs/architecture*.md` | the layer list, the dependency direction, the composition root |
| `docs/adr/**` | decisions that override a default (e.g. "transactions live in repositories") |
| `.dependency-cruiser.*` | forbidden edges as named rules — the strongest citation there is |
| `eslint.config.*` / `.eslintrc*` with `eslint-plugin-boundaries` or `import/no-restricted-paths` | zones and allowed imports |
| `.importlinter` / `importlinter` in `setup.cfg` / `pyproject.toml` | layer contracts for Python services |
| `tsconfig.json` `paths`, workspace manifests | which packages are the pure core and which are the shell |

A rule the repository states wins over this skill. A rule a tool enforces wins over a
rule that is only written down.

## 2. Fill the layer map

Write one row per layer with the real location:

| Layer | In this repository |
|---|---|
| Domain model / domain services | e.g. `src/domain/**`, or a pure core package |
| Application services | e.g. `src/modules/<name>/service.ts` |
| Ports | e.g. `src/ports/`, a shared contracts module, consumer-declared interfaces |
| Driven adapters | e.g. `src/modules/*/repository.ts`, `src/adapters/**` |
| Driving adapters | e.g. `src/modules/*/routes.ts`, job handlers, CLI entry points |
| Composition root | e.g. `src/platform/container.ts` |
| Error taxonomy | e.g. `src/platform/errors.ts` and the registered error handler |
| Configuration entry | e.g. `src/platform/config.ts` — the one place `process.env` is read |

Note every physical copy of a shared contract module: a contract change must land in
all of them.

## 3. Translate the checklist

For each `OA-n` item in `SKILL.md`, substitute the real paths from the table. Where a
tool already enforces the same thing, cite the tool's rule name instead of the OA ID.
Record which checks are mechanical (the tool's command) and which stay review-only.

## 4. Find the verification commands

Look for an architecture check script (`arch:check`, `lint:boundaries`,
`depcruise ...`), the typecheck command, and the test command in `package.json`,
`Makefile` or the CI workflow. Report which of them you ran; a check that did not run
is not evidence.

## When the repository documents nothing

Apply the default layer map and the OA checklist from `SKILL.md`, infer the real
locations from the existing folder structure, and say explicitly in the answer or
review that no repository architecture docs were found and the defaults were used.
