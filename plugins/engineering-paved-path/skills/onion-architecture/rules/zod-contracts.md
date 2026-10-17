---
name: zod-contracts
description: Zod parses at the boundary; a wire contract is not the domain model
metadata:
  tags: zod, contracts, validation, boundary, dto, shared
---

# Zod at the boundary

## Parse, don't validate — and do it where data enters

Untyped data becomes typed data at exactly one point: the boundary crossing. Inside the
core, types are already trustworthy and re-parsing is noise.

Parse at:
- HTTP input — declaratively, via `schema:` and `fastify-type-provider-zod`
- LLM responses — `completeStructured({ schema })`; a model reply is untrusted input
- GitHub / external API responses, at the adapter edge
- environment configuration, once, in the configuration module

Do not parse between two internal typed functions.

## A contract is a transport shape, not a domain type

The shared contract module describes what goes over the wire: snake_case fields, nullable
columns, optional extras for backwards compatibility. The domain describes what is true
about the business. They coincide today for small entities and will diverge the moment
either side evolves — so keep the translation explicit.

```
HTTP body ──parse──▶ contract type ──map──▶ domain type ──use case──▶ domain result
                                                                        │
DB row ◀──map── persistence shape ◀──────────────────────────────────── ┘
```

The mappers are pure functions in `helpers.ts`. A route that hands `req.body` straight
to a domain constructor has skipped a translation and welded the two together.

## Naming and casing

- Follow the repository's casing convention; a common one is snake_case wire JSON
  (`head_sha`, `cost_usd`), camelCase TypeScript, and Drizzle columns snake_case in SQL
  and camelCase in TS.
- A contract schema is PascalCase and exports a type of the same name
  (`export const PrMeta` + `export type PrMeta`).
- Conversion happens at the adapter edge, never halfway up a service.

## Every copy must change

When a contract module exists as more than one physical copy (vendored into a backend
and a frontend, say), a contract change lands in all of them, or the packages disagree
silently.

## Zod does not belong in the domain

A domain invariant is a function or a constructor that refuses invalid state; it should
not need a schema library. Keep `z` out of the domain folder and the pure core except where a schema is genuinely the payload description handed
to an LLM port.

A declared contract field is not proof the value is produced. Verify the write path
before treating a schema as a guarantee.
