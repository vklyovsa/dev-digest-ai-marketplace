# Spec template

The shape of a spec written with the `sdd-engineering` plugin. The `spec-creator` agent writes
from it; a spec written by hand follows it too. It is used when the repository has no template
of its own (`spec_template` in `.claude/sdd-profile.md`, or `<specs_dir>/TEMPLATE.md`). To adapt
it, copy it to `<specs_dir>/TEMPLATE.md` and edit there: the plugin's `scripts/check-spec.mjs`
reads the required sections from the skeleton block below, so keep that block's shape.

`check-spec.mjs` checks a spec against this file mechanically. The line formats below are what
it parses — keep them exact, dashes (`—`), dots (`·`) and arrows (`→`) included.

## Skeleton

```markdown
# Spec: <feature name>
Spec ID: SPEC-NN
Status: draft | approved | implemented
Supersedes: <SPEC-NN (path), when this spec replaces an earlier decision | none>

## Problem and user
## Goals / Non-goals
## User stories
## Acceptance criteria (EARS)
## Edge cases
## Non-functional requirements
## Module interactions
## Design review
## Inputs and provenance
## Untrusted inputs
## Traceability
## Open questions
```

Every heading stays, in this order. Edge cases, Non-functional requirements, Module
interactions, Design review, Untrusted inputs and Open questions may read `None — <why>`, so
"considered and empty" is told apart from "forgotten"; the other sections always have content.
An item is one list line (a long one wraps onto lines indented by two spaces) and is referred to
by its ID everywhere else.

## Where it lives and its file name

`<specs_dir>/<YYYY-MM-DD>-<feature-slug>.md` (`specs_dir` defaults to `specs`) — the date the
draft was created (`date +%F`), then the feature's name in kebab-case:
`2026-10-04-blast-radius.md`. When the profile lists `packages`, a feature that lives in exactly
one package goes to `<package>/<specs_dir>/` instead; two or more packages stay in
`<specs_dir>/`. One file per feature, never a root spec plus package halves.

The date and the name are what tell one spec from another in a folder listing; the title line
`# Spec: <feature name>` carries the same name in words. The file is not renamed when the spec is
revised, approved or implemented. The Implementation Plan sits beside it under the same name
with `-plan` before `.md`.

## Header

- **Spec ID** — `SPEC-NN`: one sequence for the whole repository (all spec folders together),
  two digits, never reused. `check-spec.mjs --next-id` prints the next free one.
- **Status** — exactly one value:

  | Status | Means | Set by |
  |---|---|---|
  | `draft` | Being written; may still change. | The author. `spec-creator` writes nothing else. |
  | `approved` | The user accepted it and no `[blocking]` question is open. Frozen. | The calling session or the user, after the user's explicit approval and a passing `check-spec.mjs --for-approval`. |
  | `implemented` | The work landed and matches the spec. | The calling session or the user. |

- **Supersedes** — the spec whose decision this one replaces: `SPEC-NN (path)`, or the path alone
  for a spec written without this template; `none` otherwise. The superseded file is left as it is.

## Language

English throughout. A source in another language is quoted in its own words under Inputs and
provenance, and the requirement is its English translation. A translation that has two readings
is an open question, not a choice.

## Sections

### Problem and user

Who has the problem — a role that exists in the product — what they cannot do or see today, and
how that is known. No solution here.

### Goals / Non-goals

```
- **G-1** <an outcome a user or a caller can observe once the feature exists>
- **NG-1** <what a reader could expect to be included and is not> — <why>
```

### User stories

```
- **US-1** As a <role>, I want <capability>, so that <benefit>.
```

One capability per story. Every story is covered by at least one acceptance criterion. A flow
with branches or states may be drawn here as a workflow diagram (§ What belongs in a spec).

### Acceptance criteria (EARS)

```
- **AC-1** [<pattern>] <EARS sentence> — covers: US-1 · verify: <ring> — <what the check observes>
```

EARS — Easy Approach to Requirements Syntax (Mavin, Wilkinson, Harwood, Novak; IEEE RE'09) —
keeps the condition apart from the system's response. Five patterns:

| Pattern | Use it for | Form | Example |
|---|---|---|---|
| `ubiquitous` | what always holds | The `<system>` shall `<response>`. | The API shall build an order summary without calling a model. |
| `event-driven` | a reaction to an event | WHEN `<trigger>`, the `<system>` shall `<response>`. | WHEN the user opens the Overview tab, the order page shall show the number of items and their total. |
| `state-driven` | behaviour while a state lasts | WHILE `<state>`, the `<system>` shall `<response>`. | WHILE an import is in progress, the import page shall show its elapsed time. |
| `unwanted` | a reaction to an unwanted condition | IF `<condition>`, THEN the `<system>` shall `<response>`. | IF the payment provider does not answer within 10 s, THEN the API shall return the stored order with `stale: true`. |
| `optional` | a feature that can be switched on | WHERE `<feature is enabled>`, the `<system>` shall `<response>`. | WHERE audit logging is enabled, the API shall record the actor of every refund. |

A criterion that needs both a state and a trigger combines the keywords in the order WHERE,
WHILE, WHEN / IF … THEN, and carries both tags: `[state-driven + event-driven]`.

Rules:

- One `shall` per criterion. Two responses are two criteria.
- Name the system — the surface that responds: `the API`, `the order page`, `the CLI`, `the
  worker`. Never "it", "we" or "the user shall".
- The response is observable from outside: a status code, a response field, a visible element,
  a stored value, a log line. A route or a JSON field may be named when it is the contract; a
  file, function, table or component that does not exist yet may not.
- Numbers instead of adjectives: `within 200 ms`, `at most 20 rows`. A number needs a source —
  the user, an existing measurement, a research report; without one it is an open question, not
  an invented threshold.
- None of: `should`, `may`, `might`, `can`, `could`, `etc`, `and/or`, `as appropriate`,
  `as needed`, `properly`, `fast`, `quickly`, `user-friendly`.
- EARS keywords in capitals, so the pattern is readable at a glance.
- `covers:` names the story (or, for a criterion no story owns, the goal) it proves.

`verify:` says which kind of check proves the criterion, then what that check observes. Pick the
lowest ring that can see the response — the project's testing docs (named in `CLAUDE.md` /
`AGENTS.md`) say which suites exist:

| The system the criterion names | `verify:` | Checked by |
|---|---|---|
| A screen or a component | `component` | a component test with the network mocked |
| An API whose response depends on stored rows, SQL or the wiring of a route | `integration` | a test against a real database or the running app in-process |
| An API, library or CLI whose response a pure mapping, a validation rule or an adapter decides | `unit` | a hermetic unit test |
| A journey across screens that no single component shows | `e2e` | a browser or end-to-end suite |
| Nothing a test can observe — a visual judgement, a third-party dashboard | `manual` | the user |

`e2e` and `manual` are the exception: no agent of this plugin writes or runs those checks, so
each one needs a reason, and a criterion that could be proven lower is tagged lower.

### Edge cases

```
- **EC-1** <condition> → <expected behaviour> — covered by: AC-3
- **EC-2** <condition> → <what is undecided> — open: OQ-1
```

Every edge case ends in an acceptance criterion or in an open question; none is left as a remark.

### Non-functional requirements

```
- **NFR-1** [<category>] <measurable statement> — verify: <how it is measured or checked>
```

| Category | What it constrains |
|---|---|
| `performance` | response time, payload size, list caps, what is paginated |
| `cost` | paid calls (model, third-party API) per action — "no model call" is a requirement worth stating |
| `security` | what an untrusted input may reach, secrets, isolation between tenants or workspaces |
| `accessibility` | keyboard path, focus, labels, contrast |
| `i18n` | every visible string from the project's message catalogue, plural and number formats |
| `observability` | the log line, metric or trace field that shows the feature ran |
| `compatibility` | existing API consumers, duplicated contract copies the project keeps, rows that existed before |

A threshold without a source is an open question, never a number the author picked.

### Module interactions

```
Packages: <the packages the feature changes — names from the profile's `packages`, or the areas of a single-package repository; `tooling` for build, CI or harness work>
Surfaces: <screens, routes, commands, tools, jobs the feature adds or changes>

| # | From → To | Channel | Carries | Exists today | If it fails |
|---|---|---|---|---|---|
| MI-1 | web → api | GET /orders/:id/summary | <fields> | new | <what the caller shows or returns> |
```

`Packages:` and `Surfaces:` are always there. When the profile lists `packages`, `Packages:`
takes those names (and `tooling`) and decides where the spec lives. When nothing crosses a
boundary the table is replaced by `None — <why>`.

What crosses a boundary and what each side may rely on — not how either side is built.
`Exists today` is `yes (file:line)`, `changes (file:line)` or `new`. `yes` means the value is
produced today, not merely declared: a field in a contract or a type is not proof that anything
writes it, so follow it to the write path before relying on it.

The exchange may be drawn as a communication diagram, and a contract written out below the
table — the route, the fields with their types, the error cases (§ What belongs in a spec). The
wire format follows the project's existing contracts (casing, envelope, error shape).

### Design review

```
Sources reviewed: IN-2, IN-3        (or: No design source was supplied.)

| # | Kind | Finding | Proposal | Decision |
|---|---|---|---|---|
| DR-1 | missing state | <what the source shows or omits, with a pointer> | <what to do> | accepted → AC-4 |
| DR-2 | ux | <…> | <…> | rejected — <why> |
| DR-3 | corner case | <…> | <…> | open → OQ-2 |
```

Kinds: `missing state` · `corner case` · `inconsistency` · `module` · `ux`. A proposal becomes a
requirement only once the user accepted it; until then it is `open` and no criterion depends on it.

### Inputs and provenance

What the spec was written from, and where each requirement came from.

```
| # | Source | Kind | Used for |
|---|---|---|---|
| IN-1 | task text, 2026-10-04: «<the user's words, in their language>» | user text | Problem, G-1…G-3 |
| IN-2 | design/checkout.png | design export | US-2, DR-1…DR-4 |
| IN-3 | src/orders/routes.ts @ 905cd86 | code | MI-1, EC-2 |
| IN-4 | answers, 2026-10-05 | user answer | AC-4, NG-2 |
| IN-5 | research report, 2026-10-05: <its own source — a URL or file:line> | research | NFR-1 |

| Items | Origin | Source |
|---|---|---|
| G-1…G-3, US-1 | stated | IN-1 |
| NFR-1 | research | IN-5 |
| AC-5 | assumed | OQ-2 |
```

Kinds: `user text` · `user answer` · `design export` (a Figma frame, a screenshot, a PDF) · `code`
· `repository` (a doc, a spec, an insights entry) · `research` (a research report).

Origins: `stated` — the user's own words; `design` — shown in a supplied design; `code` —
behaviour that exists today; `research` — a value a research report established, which backs a
requirement and does not create one; `assumed` — the author's default, always paired with an open
question and marked `[NEEDS CLARIFICATION]` where it stands. Every `G`, `NG`, `US`, `AC`, `EC` and
`NFR` appears in the second table exactly once.

### Untrusted inputs

Data that reaches the feature from outside the system's control. The sources to look for:

- HTTP input — request body, path and query parameters, headers, cookies, webhooks;
- files and archives a user uploads or imports, and their names and paths;
- content of third-party systems — API responses, repositories, issues, emails, feeds;
- text written by other users of the product;
- model output, and anything a model was given that came from the sources above;
- configuration or environment the deploying user does not control.

```
| # | Input | Controlled by | Enters at | Reaches | Rule |
|---|---|---|---|---|---|
| UI-1 | order note | the customer | checkout form | the rendered receipt | escaped as text, never rendered as HTML — AC-6 |
```

`Reaches` is the sink: a model prompt, SQL, rendered HTML, the filesystem, a shell, an outgoing
URL. `Rule` states the handling as behaviour and names the `AC` or `NFR` that makes it checkable.
`None — <why>` only when the feature reads nothing but data the system itself produced.

### Traceability

```
| Goal | Stories | Criteria | Edge cases | NFR |
|---|---|---|---|---|
| G-1 | US-1, US-2 | AC-1…AC-4 | EC-1 | NFR-1 |
| G-2 | US-3 | AC-5, AC-6 | EC-2 | — |
| — | — | — | EC-3 | NFR-2 |
```

One row per goal. Every story and every criterion stands in a goal's row, and a criterion stands
in the same row as the story it covers; the `—` row holds the edge cases and non-functional
requirements that serve no single goal. A criterion that reaches no goal is out of scope — delete
it, or make it an open question.

This table is the forward half: goal → story → criterion. The backward half — where each
requirement came from — is the origin table under Inputs and provenance. Beyond the spec,
`implementation-planner` and `plan-verifier` carry the same IDs into the plan, the code and the
tests.

### Open questions

```
- **OQ-1** [non-blocking] <question> — options: <a / b> — default taken: <a> — affects: AC-5
- **OQ-2** [blocking] <question> — options: <a / b> — affects: US-2, AC-3
```

What a question leaves open is marked at the place it concerns — in the text of the item or in
the table cell — so that an open question is read where it matters, and no answer is made up in
its place:

```
[NEEDS CLARIFICATION: <what is undecided, in a few words> → OQ-n]
```

- A `[blocking]` question has nothing to fall back on. The marker stands where the answer would,
  and no value is written in its place:
  `… the API shall answer [NEEDS CLARIFICATION: which status code → OQ-2]`.
- A `[non-blocking]` question has a default. The default is written and the marker follows it:
  `… at most 20 rows [NEEDS CLARIFICATION: the cap has no source → OQ-1]`.

Every marker names a question of this section, and every question is pointed at from the text: by
a marker, by an edge case's `open: OQ-n`, or by a Design review row's `open → OQ-n`. A marker is
removed together with its question, never before.

A spec with an open `[blocking]` question stays `draft` — `check-spec.mjs --for-approval` fails on
it and `implementation-planner` does not plan it. A fact still to be established is a question
too: say in its options that it goes to research. An answered question is deleted from this
section and its marker from the text: the answer lives in the section it changed, and it is added
to Inputs and provenance as a `user answer` or as `research`.

## What belongs in a spec, and what does not

A spec says what the feature does and what the sides agree on — usually without saying how it is
built. `implementation-planner` takes the approved spec as its input and writes the
Implementation Plan from it; the *how* lives there.

A spec may contain, where it makes the behaviour clearer than prose:

- **A workflow diagram** — the user's or the system's path through the feature, with its branches
  and states: Mermaid `flowchart` or `stateDiagram-v2`, under User stories.
- **A communication diagram** — which service or package calls which, in what order, and what
  comes back: Mermaid `sequenceDiagram`, under Module interactions.
- **Contracts** — what two sides agree on at a boundary: a route and its method, request and
  response fields with their types, error cases and status codes, an event payload, a command's
  arguments and output. A table or a short field list, under Module interactions.

A diagram is optional — it earns its place when prose would make the reader hold more than a few
relationships in their head. At most 20 nodes, every edge labelled, every node a package, a
surface or an outside service the text names — never a file or a class.

A spec usually does not contain implementation detail: files to create, names of functions,
classes, tables or components that do not exist yet, library choices, the order of stages. The
exception is a constraint the user stated — "no new table", "reuse the existing index" — written
as a non-goal or a non-functional requirement with origin `stated`.

Never in a spec:

- A requirement nobody stated or accepted. It is an open question or an `open` proposal.
- An answer nobody gave. The place carries `[NEEDS CLARIFICATION: … → OQ-n]` until the user or a
  research report settles it.
- A changelog, a task log, or the story of how the spec was written.

## Checking a spec

The agents call the plugin's checker by its full path; by hand, from the repository root:

```
node <plugin root>/scripts/check-spec.mjs <spec.md>                  # format, references, coverage
node <plugin root>/scripts/check-spec.mjs --for-approval <spec.md>   # also: no [blocking], Status draft
node <plugin root>/scripts/check-spec.mjs --next-id                  # the next free SPEC-NN
```

The script checks what a machine can: the file name and folder, the header, the sections of the
skeleton, item formats, EARS form (pattern tag, capital keywords, one `shall`, a named system),
the vague words above, every reference, and coverage — story → criterion, the origin table, the
traceability table, `assumed` → question, untrusted input → criterion, a `[NEEDS CLARIFICATION]`
marker → its question and, on a draft, every question → a place in the text and every `assumed`
item → its marker. It warns about repository paths that do not exist, about `e2e` / `manual`
rings, and counts diagrams without rendering them. Whether a response is truly observable,
whether a number has a source and whether a design finding is real stay with the author and the
reader.
