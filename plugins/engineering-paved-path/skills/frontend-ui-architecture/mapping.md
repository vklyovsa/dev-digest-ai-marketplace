# Mapping onto your repository

The tiers in [SKILL.md](SKILL.md) are a default. A real repository already has a
layout, and usually some written rules. This file is how to translate one into the
other before you place a file or review a diff.

## 1. Find what the repository already says

Read, in this order, and stop collecting once the picture is clear:

| Source | What it usually gives you |
|---|---|
| `AGENTS.md` / `CLAUDE.md` (root and the frontend package) | folder conventions, naming, "never import X from Y" rules |
| `ARCHITECTURE.md`, `docs/architecture*.md` | the tier list and the allowed import directions |
| `docs/adr/**` | decisions that override a default (e.g. "we use Feature-Sliced Design") |
| `.eslintrc*` / `eslint.config.*` with `eslint-plugin-boundaries`, `import/no-restricted-paths`, `no-restricted-imports` | the boundaries that are actually enforced |
| `.dependency-cruiser.*` | forbidden edges and cycle rules, enforced in CI |
| `tsconfig.json` `paths` | the aliases that name each tier (`@/*`, `@acme/ui`, …) |

A rule the repository states wins over this skill. A rule that is enforced by a tool
wins over a rule that is only written down.

## 2. Build the tier map

Fill a table like this one from what you found — one row per general tier:

| General tier | In this repository | Notes |
|---|---|---|
| routes | e.g. `src/app/**/page.tsx` | thin; compose and delegate |
| route-local feature UI | e.g. `src/app/<route>/_components/<Name>/` | only that route subtree imports it |
| features | e.g. `src/features/<name>/` | may be absent in route-anchored layouts |
| cross-route, domain-aware | e.g. `src/components/<name>/` | earned by a second route |
| design system | e.g. `src/ui/` or a package alias | domain-free, imported through its public API |
| configured clients, plumbing | e.g. `src/lib/` | the one HTTP client, providers, theme |
| wire contracts | e.g. a shared package or `src/contracts/` | note every physical copy that must change together |

When a general tier has no counterpart, write "none" — that is information too (a
route-anchored app with no `features/` folder is a legitimate choice).

## 3. Note the promotion path in local terms

Write down where a module moves when it gains a second consumer:

1. Second consumer **inside the same route** → the nearest common route segment
   (`helpers.ts` / `constants.ts` there).
2. Second consumer **in another route** → the cross-route tier.

Skipping step 1 is the common mistake: it makes a route-specific helper look reusable.

## 4. Record the data-access path

Name the only sanctioned path to server data (a configured client plus hooks, a
feature `api/` folder, Server Actions, a Data Access Layer). Everything that fetches
outside that path is a finding. If the frontend is a pure HTTP consumer of a separate
backend, the DAL material in [app-router.md](app-router.md) does not apply.

## 5. List the deviations honestly

Where the code diverges from the general rules (client route roots, no boundary
linting, a grouping barrel), record it as existing debt, not as the house style. New
code follows the rules; existing debt is only a finding when the diff adds to it.

## When the repository documents nothing

Use the default architecture in [SKILL.md](SKILL.md) as the rulebook, say so in your
answer or review ("no repository architecture docs found — default tiers applied"), and
infer the tier map from the existing folder structure rather than inventing new folders.
