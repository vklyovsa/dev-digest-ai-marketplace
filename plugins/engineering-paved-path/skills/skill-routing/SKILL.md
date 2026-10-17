---
name: skill-routing
description: "Maps changed or planned files onto the engineering-paved-path skills that govern them (React, Next.js, testing, Fastify, Drizzle, PostgreSQL, Zod, TypeScript, onion/frontend architecture, security). Use when a planner must name the skills each stage applies, or a reviewer must decide which rulebooks a diff is checked against. A repository may override this table with its own routing file."
user-invocable: false
---

# Skill routing — file → skills

Given a list of files (a diff, or the files a plan will touch), decide which skills
govern each one. Consumers: the implementation planner of the `sdd-engineering` plugin
(which skills each stage applies) and the architecture reviewer of the
`architecture-review` plugin (which rulebooks a diff is checked against).

## 1. Repository override first

A repository may ship its own routing table. Look for it, in order:

1. the `skill_routing` key of the sdd-engineering project profile
   (`.claude/sdd-profile.md`) — a path to a routing file;
2. a routing section or file named in `AGENTS.md` / `CLAUDE.md`.

When one exists, it **replaces** the tables below (skill names in it are used as
written). Say which routing source you used. When none exists, use this file.

## 2. Map each path to the repository's layout

The patterns below use generic layouts (`src/app/**`, `src/modules/<name>/`). Before
matching, translate them onto the repository: read the frontend and backend layout from
`AGENTS.md` / `CLAUDE.md` or the architecture docs (see the `mapping.md` files of
`engineering-paved-path:onion-architecture` and
`engineering-paved-path:frontend-ui-architecture`). In a monorepo, apply the frontend
rows only inside frontend packages and the backend rows only inside backend packages.

## 3. By path

| Path pattern | Skills |
|---|---|
| `**/*.{test,spec}.{tsx,jsx}`, or a `.ts` test that renders components / hooks | `engineering-paved-path:react-testing-library` |
| Next.js route files: `app/**/{page,layout,route,loading,error,template,not-found,default}.{ts,tsx}` | `engineering-paved-path:next-best-practices`, `engineering-paved-path:react-best-practices`, `engineering-paved-path:frontend-ui-architecture` |
| frontend data access: the API client, `hooks/**`, a feature's `api/**` | `engineering-paved-path:react-best-practices`, `engineering-paved-path:frontend-ui-architecture` |
| any other frontend `*.tsx` / `*.jsx` (non-test) | `engineering-paved-path:react-best-practices`, `engineering-paved-path:frontend-ui-architecture` |
| any other frontend `*.ts` (non-test) | `engineering-paved-path:frontend-ui-architecture` |
| backend route / controller files (`src/modules/*/routes.ts`, `handlers.ts`) | `engineering-paved-path:fastify-best-practices` (when Fastify is used), `engineering-paved-path:onion-architecture`, `engineering-paved-path:security`, `engineering-paved-path:zod` (when Zod is used) |
| backend entry points: SSE, jobs, HTTP bootstrap | `engineering-paved-path:fastify-best-practices`, `engineering-paved-path:onion-architecture` |
| backend repositories (`src/modules/*/repository.ts`, `*.repo.ts`) | `engineering-paved-path:onion-architecture`, `engineering-paved-path:drizzle-orm-patterns` (when Drizzle is used) |
| other backend source: modules, domain, adapters, platform / container | `engineering-paved-path:onion-architecture` |
| backend tests | `engineering-paved-path:onion-architecture` (`rules/testing.md`: one way to test each ring) |
| DB schema, row types, migrations (`src/db/**`, `drizzle/**`, `migrations/**`) | `engineering-paved-path:drizzle-orm-patterns` (Drizzle only), `engineering-paved-path:postgresql-table-design` (PostgreSQL only) |
| shared wire contracts (a contracts package or vendored copy) | `engineering-paved-path:zod`, `engineering-paved-path:onion-architecture`, plus a check that every copy changed together |
| a pure core / engine package | `engineering-paved-path:onion-architecture`, `engineering-paved-path:typescript-expert`, `engineering-paved-path:zod` |
| a CLI or MCP server written in TypeScript | `engineering-paved-path:typescript-expert`, `engineering-paved-path:zod`, `engineering-paved-path:security` |
| CI, scripts, docs, specs, agent/skill files, e2e flows | no skill — repository conventions only (`AGENTS.md` / `CLAUDE.md`) |

`engineering-paved-path:onion-architecture` is the backend architecture lane and
`engineering-paved-path:frontend-ui-architecture` the frontend one. Frontend skills never
judge backend files and backend skills never judge frontend files — the split is the
point of this table.

A row whose library the repository does not use (no Fastify, no Drizzle, no Zod) is
dropped, not applied by analogy.

## 4. By content (added lines only)

Path alone misses these. Match them against the `+` lines of the diff (the whole file
for a new file):

| Trigger | Skill |
|---|---|
| `dangerouslySetInnerHTML`, `innerHTML`, `child_process`, `execSync`, `spawn(`, `exec(`, `eval(`, `new Function`, `Authorization`, `password`, `secret`, `token`, `apiKey`, `api_key`, `jwt`, `bcrypt`, `cookie`, `cors`, `helmet`, `.query.`, `.body.`, `.params.`, `redirect(`, `upload` | `engineering-paved-path:security` |
| `any`, `as unknown as`, `as <Type>`, `@ts-ignore`, `@ts-expect-error`, `infer`, `keyof`, `satisfies`, `declare module`, any `tsconfig*.json` | `engineering-paved-path:typescript-expert` |
| `.inject(` in a backend test | `engineering-paved-path:fastify-best-practices` (route tests through `app.inject()`) |

Content triggers are deliberately wide: the skill decides what is reportable. A wide
trigger costs one extra read; a narrow one costs a missed finding.

## 5. Not routed, on purpose

| Skill | Why |
|---|---|
| `engineering-paved-path:mermaid-diagram` | authoring aid for docs, has no review rules |
| `engineering-paved-path:skill-routing` | this file — the router, not a lane |

## Output

Return one line per skill with the files it governs, then the files no row matched
(`unrouted`). Name the routing source (repository override or this default). An
unrouted source file is reported, never silently dropped.
