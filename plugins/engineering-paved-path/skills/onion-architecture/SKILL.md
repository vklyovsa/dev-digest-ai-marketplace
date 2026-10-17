---
name: onion-architecture
description: "Enforces Onion Architecture (ports & adapters) in a TypeScript/Node backend. Use when adding or changing a backend module, a route, a service, a repository, an adapter or a DI wiring; when deciding where a piece of backend logic belongs; when a service needs a new external capability (LLM, git, a third-party API, filesystem, search index); when reviewing backend code for layering; or when a change makes an inner layer depend on an outer one. Covers the dependency rule, mapping the layers onto your repository, Fastify routes as driving adapters, Drizzle repositories as driven adapters, narrow ports instead of the DI container, Zod at the boundary, domain purity and dependency-cruiser enforcement. Trigger terms: onion architecture, hexagonal, ports and adapters, clean architecture, layering, dependency rule, repository pattern, where does this code go."
metadata:
  tags: architecture, onion, hexagonal, ports-and-adapters, backend, fastify, drizzle, zod, dependency-injection, dependency-cruiser
---

# Onion Architecture — backend

Scope: backend code — HTTP services, workers, and pure engine/core packages. Not the
frontend (that is `frontend-ui-architecture`), not end-to-end tests.

The repository's own architecture docs win over this skill. Before applying the layer
map below, read [mapping.md](mapping.md): it tells you how to find the repository's
layers, ports and enforced rules, and what to do when none are documented.

## The one rule

**All coupling points inward.** An outer layer may depend on an inner layer. An inner
layer must never depend — by import, by type, or by knowledge — on an outer one.

The domain does not know that Postgres, Fastify, GitHub or an LLM vendor exist. Everything
outside the core reaches the core through a **port** (an interface owned by the inside)
implemented by an **adapter** (a class owned by the outside), and the two are wired
together in exactly one place: the **composition root**.

If you cannot state which layer a new file belongs to, do not write it yet — read
`rules/layers.md`.

## The request path

```
route (driving adapter) → application service → domain
                              ↓ through ports
                         driven adapters (Drizzle, HTTP SDKs, git, LLM, search index)
```

The **container** is what connects them: it builds each service with the concrete
adapters behind its ports. A route reaches a use case, never an adapter.

**A route never calls an adapter directly.** Not `container.github()`, not
`container.llm(id)`, not `container.git`, not `container.searchIndex`, not a Drizzle
query — even for "just one read". The moment a route talks to an adapter, the use case
is split between two rings, it can no longer be tested without HTTP, and the next
caller (a job, the CI runner) has to copy it. Put the call in a service method and
call that.

## Default layer map

Typical locations; the real ones come from [mapping.md](mapping.md).

| Layer | What it is | Typical location |
|---|---|---|
| Domain model | entities, value objects and their invariants | `src/domain/<aggregate>/`, or a separate pure core package |
| Domain services | rules spanning several entities, still no I/O (scoring, policy, assembly) | `src/domain/<aggregate>/*.ts` |
| Application services (use cases) | `placeOrder`, `addRepo`, `importInvoice` | `src/modules/<name>/service.ts` |
| Ports | `LLMProvider`, `GitClient`, `PaymentGateway`, `SecretsProvider`, repository ports | `src/ports/`, a shared contracts module, or interfaces declared by the consumer |
| Driven adapters | Drizzle repositories, HTTP SDK clients, git, LLM providers | `src/modules/*/repository.ts`, `src/adapters/*` |
| Driving adapters | Fastify routes, SSE streams, queue/job handlers, CLI commands | `src/modules/*/routes.ts`, `src/platform/{sse,jobs}.ts` |
| Composition root | the DI container — the only place that constructs concrete classes | `src/platform/container.ts` (or `src/container.ts`, `src/main.ts`) |

A pure core package — "no DB, network, filesystem or environment reads; new outside
capability arrives as an injected port" — is the reference shape for the domain rings.

## Where a change starts

Build **inward-out**, never outward-in:

1. Name the use case in one sentence ("place an order for one customer").
2. Express the rule in the domain — a type, an invariant, a pure function. No I/O.
3. Declare the ports the use case needs. A port is named after what the *caller*
   wants (`OrderRepositoryPort.listOpenForCustomer`), not after what the library offers.
4. Write the application service against those ports only.
5. Implement the adapters (Drizzle, HTTP client, LLM).
6. Wire them in the container.
7. Expose the use case through a route — last, and thinnest.

## Rule index

Read the file that matches what you are touching:

| Touching | Read |
|---|---|
| deciding where code belongs, a new module | `rules/layers.md` |
| `routes.ts`, HTTP status codes, SSE, job handlers | `rules/fastify-transport.md` |
| throwing or mapping an error, a `4xx` anywhere | `rules/errors.md` |
| `repository.ts`, Drizzle queries, transactions, row types | `rules/drizzle-persistence.md` |
| a service constructor, `Container`, a new adapter | `rules/ports-and-di.md` |
| Zod schemas, shared contracts, wire shapes | `rules/zod-contracts.md` |
| the domain folder or a pure core package | `rules/domain-purity.md` |
| writing tests for any of the above | `rules/testing.md` |
| CI, dependency-cruiser, verifying a change | `rules/enforcement.md` |
| reviewing someone's diff or a PR for layering | `rules/review-report.md`, `rules/tracing.md` |

Worked before/after refactors: `examples.md`. Mapping onto a repository: `mapping.md`.
Sources: `references.md`.

## Pre-flight checklist

Run through this before finishing any backend change. Each item has an ID so a review
can cite it; where dependency-cruiser checks the same thing, its rule name
(`rules/enforcement.md`) is the better citation.

- [ ] **OA-1** No `routes.ts` imports `drizzle-orm` (or another ORM / driver), the DB schema or DB row types.
- [ ] **OA-2** No `routes.ts` reaches past a service through the container: no adapter
      (`container.github()`, `container.llm()`, `container.git`, `container.searchIndex`,
      `container.secrets`), no repository (`container.<x>Repo`),
      no `container.db`. It calls one service method. (dependency-cruiser sees imports,
      not property access, so this one is checked by review and by the grep in
      `rules/enforcement.md`.)
- [ ] **OA-3** No `service.ts` imports `drizzle-orm` or the Drizzle schema.
- [ ] **OA-4** No constructor under `src/modules/**` takes `Container`; it takes named ports.
- [ ] **OA-5** No public method signature exposes a Drizzle row (`typeof table.$inferSelect`) —
      under any name: a `*Row` type, an alias, a `ReturnType<…>` of a repository method,
      or an un-annotated repository method whose result flows out unmapped.
- [ ] **OA-6** Every new external capability has a port where the repository keeps ports,
      an implementation under the adapters folder, and a mock/fake beside the other mocks.
- [ ] **OA-7** Nothing in the domain folder or a pure core package imports the web framework,
      the ORM, a DB driver, an HTTP SDK, git, an LLM SDK, a `node:` builtin, or reads `process.env`.
- [ ] **OA-8** Module A does not import module B's `repository.ts` or `helpers.ts`; shared
      repositories are resolved from the composition root.
- [ ] **OA-9** A business rule lives in a service or the domain — not in a route — and can
      be tested without starting Postgres.
- [ ] **OA-10** A use case fails with the repository's application error type (`AppError` or subclass):
      no `throw new Error(...)` under `src/modules/**`, and no route writes an error
      response by hand (`reply.status(4xx).send(...)`). See `rules/errors.md`.
- [ ] **OA-11** The rules follow the role, not the file name: code that takes the
      `Container`, a `FastifyRequest` or a `reply` is transport wherever it lives
      (`handlers.ts`, `controller.ts`), and OA-1, OA-2, OA-9 apply to it.
- [ ] **OA-12** `helpers.ts` and `constants.ts` are pure — no I/O, no `process.env`, no clock
      or randomness, directly or through a function they call. Time arrives as a parameter.
- [ ] **OA-13** No adapter class is constructed outside the composition root — not in a
      service, and not in a factory function inside a module.

OA-5 and OA-11 to OA-13 cannot be seen by dependency-cruiser or by a one-line grep: they
show only when a type, a call or a `new` is followed across files. `rules/tracing.md`
has the four traces; run them on every review, including when the static checks are green.

## Reviewing a change

When the task is to review rather than to build, the answer follows
`rules/review-report.md`: a **Must fix** table where every row cites a rule (a
dependency-cruiser rule name or an `OA-n` ID above) with `path:line`, a **Fine as is**
list, the checks actually run, and a final `Verdict: BLOCK — <n> must-fix` or
`Verdict: PASS` line. Read that file and `rules/tracing.md` before writing the review.

## When the repository already enforces layering

If the repository has a dependency-cruiser config, `eslint-plugin-boundaries` zones or
an import-linter contract, those rule names are the primary citations and the OA IDs
cover only what the tool cannot see (signature shapes, property access on the
container, construction outside the root). Never lower a rule's severity to make a
change pass; fix the import.

What no import graph can check is signature shape: "no `*Row` type in a public service
signature" stays a review rule, enforced by the checklist above.
