---
name: domain-purity
description: What the core may not import, and how new capability reaches it
metadata:
  tags: domain, purity, core, side-effects, testability
---

# Domain purity

The innermost rings — the domain folder and any pure core package — are the part of
the system that outlives the stack. They stay free of side effects and of every
implementation detail: no persistence, no transport, no environment.

## Forbidden imports in the core

the web framework (`fastify`, `express`) · the ORM and driver (`drizzle-orm`, `postgres`) ·
HTTP / git / LLM SDKs (`octokit`, `simple-git`, `openai`) · any `node:` builtin (`node:fs`, `node:path`,
`node:child_process`) · `process.env` · `Date.now()` and `Math.random()` when the result
is part of an outcome.

Non-determinism is a dependency too. If a rule needs the current time or an id, take a
`clock` or `idGenerator` port — that is what makes the rule assertable.

## New capability arrives as a port

The rule: "new outside capability arrives as an injected port, never as an import". A
core whose only side effect is, say, an LLM call through an injected `LLMProvider` is
mock-testable as a whole because of that single decision.

```ts
// GOOD — the engine asks for a capability it cannot perform itself
export async function runReview(input: ReviewInput, deps: { llm: LLMProvider }): Promise<ReviewOutcome>
```

```ts
// BAD — the core reached out and took one
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

## Rules live in the core, not in helpers of a service

Pricing, eligibility, scoring, prompt assembly — these are domain services.
They are pure, they are unit-tested without infrastructure, and they are the reason the
engine can be reasoned about at all. A new rule that ends up in `service.ts` because
"it was easier there" is a rule that will be re-implemented differently somewhere else.

Concretely: "a discount never exceeds the order total, and the total is recomputed
after it is applied" is domain logic. It lives in a pure domain function — not in the
route, not in the repository.

## Purity is a testing property

The check is simple: **can this run in a test with no Docker, no network, no clock and
no filesystem?** If not, something outside leaked in. A test that needs Postgres is
testing an adapter, by definition.
