---
name: testing
description: Testing by layer — pure core, mocked ports, adapters against the real thing
metadata:
  tags: testing, vitest, mocks, integration, layers
---

# Testing by layer

The architecture pays for itself in tests. Each ring has one way to test it, and a test
that reaches for a heavier tool than its ring allows is reporting a leak.

| Layer | How it is tested | File name |
|---|---|---|
| Domain model / domain services | pure inputs → assertions, no doubles | `<area>.test.ts` |
| Application services (use cases) | real service + mock ports | `<area>.test.ts` |
| Driven adapters (Drizzle, HTTP SDKs, git) | against the real dependency | the repository's integration naming (e.g. `<area>.it.test.ts`) |
| Driving adapters (routes) | `app.inject()` with mocked services/ports | `<area>.test.ts` |

## Keep the lanes apart

When the repository separates hermetic and DB-backed tests by a file suffix or folder
(e.g. `*.it.test.ts`), follow it exactly: the name is what puts a test in the right CI
lane, so a DB-backed test with the wrong name fails in the hermetic run.

Integration tests self-skip when Docker is absent — a green run does not prove they
executed. Say which lane actually ran when reporting results.

## Use-case tests use mocks, not a database

```ts
// GOOD — one use case, substituted collaborators, no Docker
const reviews = new InMemoryReviewRepository();
const llm = stubLLM({ findings: [finding('src/a.ts', 12)] });
const service = new ReviewService(reviews, agents, llm, bus);

await service.runReview(workspaceId, prId, agentId);

expect(reviews.runs).toHaveLength(1);
```

If writing that test requires standing up Postgres, the rule under test is in the wrong
ring — move it inward and the test follows.

## Mocks belong to the ports

Mock implementations live beside the adapters, and container overrides inject them. Prefer constructing the service directly with mock ports for a unit test; use the
container override path when the test exercises wiring or a route.

Do not mock what you own three layers down (do not stub Drizzle) and do not mock the
system under test. Mock the port, exercise the real rule.

## Running tests

Follow the repository's instructions on when tests may be run and how (`AGENTS.md` /
`CLAUDE.md`). Report the command with its result, and say which lane actually ran — a
skipped integration lane is not a pass.
