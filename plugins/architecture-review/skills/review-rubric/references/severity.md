# Severity

## The scale

`CRITICAL` · `WARNING` · `SUGGESTION` — no other label. If the repository defines its own
finding-severity enum (in a contract module, a review config, `AGENTS.md`), map onto it
and say which mapping you used; never emit `INFO` or a fourth level.

## Mapping a rulebook's own scale

| Rulebook's own label | Here |
|---|---|
| `engineering-paved-path:react-best-practices` CRITICAL | CRITICAL — **only if** the three-part test below passes; otherwise WARNING |
| `engineering-paved-path:react-best-practices` HIGH | WARNING |
| `engineering-paved-path:react-best-practices` MEDIUM | SUGGESTION |
| `engineering-paved-path:security` HIGH confidence (attacker-controlled input confirmed) | CRITICAL |
| `engineering-paved-path:security` MEDIUM confidence | WARNING |
| `engineering-paved-path:security` LOW confidence | not reported at all |
| a rulebook with no scale (`zod`, `typescript-expert`, `fastify-best-practices`, `drizzle-orm-patterns`, `postgresql-table-design`, `frontend-ui-architecture`, `next-best-practices`, `react-testing-library`) | WARNING by default; CRITICAL only via the test below |
| a layering violation the repository's enforced tool reports (dependency-cruiser, eslint-plugin-boundaries, import-linter) | CRITICAL |
| a layering violation no enforced tool catches (signature shape, property access on the container, construction outside the composition root) | WARNING |

A rulebook calling its own rule "CRITICAL" is a prior, not a verdict. The test below decides.

## The three-part test for CRITICAL

All three, or it is not a CRITICAL:

1. **Location** — a `file:line` inside the diff. Not "somewhere in this module".
2. **Failure scenario** — concrete input or state → wrong output, crash, data loss, leak,
   or a broken build. Written out, not implied.
3. **Verified** — the file was opened and the pattern is really there.

Fails any one → WARNING. Style, taste, "would be nicer", theoretical risk, a pattern in a
test file, dead code, or anything in `docs/`, `specs/`, `*.md` → never CRITICAL.

## What is genuinely CRITICAL

- The typecheck fails in a package the diff touches.
- The repository's architecture check (dependency-cruiser, eslint boundaries, import-linter)
  reports a violation the diff introduces: a transport file importing the ORM or the DB
  schema, a module constructor taking the DI container, a module reaching into another
  module's internals, an import cycle.
- A contract that exists as more than one physical copy changed in one copy only — the
  copies are one contract, and the packages now disagree.
- A rule the repository's own architecture docs mark as mandatory ("must", "never"),
  broken by the diff with a concrete failure.
- A secret, token or real `.env` value added by the diff.
- A destructive migration (`DROP TABLE`, `DROP COLUMN`) with no documented data plan.

The repository's own docs may add to this list; cite them when they do.

## What is not

- A service over 300 lines, a component over 200 lines → SUGGESTION.
- A naming-convention miss (a file or folder name against the documented convention) → WARNING.
- A missing test for new code → WARNING (not an architecture finding — leave it to a test review).
- Drift that is already on the base commit → not a finding; at most one summary line.

## Finding contract

```
Finding fields: severity · band · file · line · in_diff · skill · rule_source · title · evidence · failure · fix · verified
```

- `band` is always `n/a` for an architecture finding — the band scale belongs to a
  security review.
- `skill` is the rulebook the rule comes from (`onion-architecture`,
  `frontend-ui-architecture`, or `repository` when the rule is the repository's own doc).
- `rule_source` names the exact rule: `depcruise: <rule-name>`, `ARCHITECTURE.md § Layers`,
  `docs/adr/0007-*.md`, `onion-architecture rules/ports-and-di.md`, `OA-2`.
- Cap 10 findings, CRITICAL first. A pre-existing issue outside the diff is never a
  finding — at most one line, `Pre-existing, not in this diff: N — <rule>`.

JSON shape, one object per finding:

```json
[{"severity":"CRITICAL","band":"n/a","file":"src/modules/orders/routes.ts","line":12,
  "in_diff":true,"skill":"onion-architecture","rule_source":"depcruise: orm-only-in-repositories",
  "title":"routes.ts queries the ORM directly",
  "evidence":"import { eq } from 'drizzle-orm'",
  "failure":"the architecture check fails CI; the HTTP layer reads persistence with no repository",
  "fix":"move the query into orders/repository.ts and call it from service.ts","verified":true}]
```

## Recheck protocol

After a fix round the caller sends the IDs of the fixed findings and the files the fix
touched. For each finding answer one line:

- `resolved` — the rule now holds at that location;
- `still open` — quote the line that still breaks the rule;
- `changed` — the fix moved the violation; report it as a new finding in the full
  contract, numbered after the last one.

Then rerun the deterministic checks whose precondition the touched files match, and judge
the changed lines against the rules again — a fix can break a rule the original code kept.
Return the status lines, any new finding, and the JSON array of what is still open.
