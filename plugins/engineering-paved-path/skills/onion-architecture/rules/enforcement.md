---
name: enforcement
description: Making the dependency rule mechanical — dependency-cruiser config, script and CI lane
metadata:
  tags: enforcement, dependency-cruiser, ci, architecture-linting
---

# Enforcement

Documented layering decays; checked layering does not. Use the tool the repository
already has: dependency-cruiser for a TypeScript/Node backend, `eslint-plugin-boundaries`
when the repository already runs ESLint and wants in-editor feedback, import-linter for
Python. If one is configured, read its config rather than copying a snippet from here —
the config is the source of truth.

## A starting rule set (dependency-cruiser)

Adapt the paths to the repository's layer map (`mapping.md`):

| Rule | Forbids |
|---|---|
| `orm-only-in-repositories` | anything but the persistence edge importing the ORM / DB driver |
| `schema-only-in-repositories` | anything but the persistence edge importing the DB schema |
| `no-row-types-in-transport` | `modules/*/routes.ts` importing DB row types |
| `no-domain-to-infra` | `src/domain/**` importing transport, persistence, SDKs or node builtins |
| `no-adapter-to-module` | `src/adapters/**` importing `src/modules/**` |
| `no-cross-module-internals` | module A importing module B's `repository` / `helpers` |
| `no-service-to-container` | `modules/*/service.ts` importing the composition root |
| `core-purity` | a pure core package importing DB, transport, fs or application code other than its shared contracts |
| `llm-sdk-stays-in-llm-folder` | a core file outside its LLM folder importing a provider SDK |
| `no-circular` | import cycles |

### Two things that will bite

- **`tsPreCompilationDeps: true` is mandatory for ESM TypeScript.** When `service.ts`
  imports `./service.js`, the local graph otherwise resolves to nothing and every rule
  passes vacuously — a green run that proves nothing.
- **npm dependencies match on the resolved path, not the specifier.** `^drizzle-orm`
  never fires; `node_modules/drizzle-orm` does. Under pnpm the real path is
  `node_modules/.pnpm/drizzle-orm@<version>/node_modules/drizzle-orm/...`, so anchoring
  with `^` silently disables the rule.

`no-cross-module-internals` can use dependency-cruiser's `$1` backreference from the
`from.path` capture group inside a negative lookahead (`to: '^src/modules/(?!$1/)...'`).
Probe a new rule on a known edge before trusting it.

## Script

```json
"arch:check": "depcruise src --config .dependency-cruiser.cjs",
"arch:graph": "depcruise src --config .dependency-cruiser.cjs --output-type dot"
```

## Severity ladder

Start a NEW rule at `warn`, record its violation count as the baseline, and flip it to
`error` once that count reaches zero. A rule that starts at `error` on a red tree gets
disabled within a week. When a rule at `error` would go red, fix the import — do not
lower the severity.

## CI

Run the check in the backend's typecheck job, right after the typecheck, and include
every package whose modules are part of the graph (a pure core aliased into the backend
belongs to the same lane).

## Verifying a change

1. The architecture check (`pnpm exec depcruise src --config .dependency-cruiser.cjs`
   or the repository's script) — must report no violations.
2. The typecheck of every package a moved type touches.
3. Walk the `SKILL.md` pre-flight checklist (`OA-1` … `OA-13`) for the rules the graph
   cannot see.
4. Check that no route reaches past a service (OA-2). The graph cannot see this one:
   a route reaches an adapter or a repository by PROPERTY access on the container it
   already holds, not by an import. Adapt the names; this must print nothing:

   ```bash
   grep -nE "container\.(github\(|llm\(|git\b|secrets|db\b|\w+Repo\b)" src/modules/*/routes.ts
   ```

5. Check the error taxonomy (OA-10, `rules/errors.md`). Both must print nothing:

   ```bash
   grep -rnE "throw new Error\(" src/modules
   grep -nE "reply\.(status|code)\((4|5)[0-9]{2}\)" src/modules/*/routes.ts
   ```

6. Run the four traces in `rules/tracing.md` (OA-5, OA-11, OA-12, OA-13). Nothing above
   can see what they look for; a green run of steps 1–5 says nothing about them.

Report what actually ran. A check that was not executed is not evidence.
