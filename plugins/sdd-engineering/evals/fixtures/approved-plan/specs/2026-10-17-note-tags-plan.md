# Implementation Plan — Tags on notes
Source: specs/2026-10-17-note-tags.md (SPEC-01, Status: approved) · Base: 3c799a3 · Packages: notes-api (single package, repository root)

## 0. Before the first edit
- Instructions: `AGENTS.md` (root; there is no `CLAUDE.md` and no `.claude/sdd-profile.md`). Rules from it that override the plugin and skill defaults:
  - Routing stays in `src/server.js` and behaviour lives in `src/notes.js` (AGENTS.md:18). The onion layer map is applied as server.js = driving adapter and notes.js = rules + in-memory store.
  - Errors are `{ "error": "<message>" }` with a 4xx/5xx status (AGENTS.md:19). The existing `ValidationError` → 400 mapping in `src/server.js:27` is the project's error taxonomy, and it wins over `onion-architecture` → `rules/errors.md`, which uses 422 and `AppError`.
  - One test file per source file in `test/*.test.js`, run by `node --test` (AGENTS.md:8, :14).
  - No dependencies, `node:http` only, Node >= 22 (AGENTS.md:3). No package is added.
- INSIGHTS: none exist (no `INSIGHTS.md` at the root).
- Read: `specs/2026-10-17-note-tags.md`, `AGENTS.md`, `README.md`, `package.json`, `src/notes.js`, `src/server.js`, `test/notes.test.js`. `docs/` is empty, and no architecture docs or dependency-cruiser config exist, so the onion defaults were mapped onto the two-file layout (onion-architecture → `mapping.md` § "When the repository documents nothing").
- Routing: `engineering-paved-path:skill-routing` (default; no repository override). The Fastify, Zod, Drizzle and TypeScript rows are dropped because the project uses none of them.

## 1. Scope — as the source states it
Goal:
- G-1 A client attaches up to 10 short tags to a note when it creates it, and sees those tags on every note the API returns. — `specs/2026-10-17-note-tags.md:16`
- G-2 A client lists only the notes that carry one given tag with `GET /notes?tag=<tag>`. — `specs/2026-10-17-note-tags.md:17`

Non-goals:
- NG-1 Adding, changing or removing the tags of an existing note — … tags are set when the note is created. — `specs/2026-10-17-note-tags.md:18`
- NG-2 Filtering by more than one tag, or by a prefix or substring of a tag. — `specs/2026-10-17-note-tags.md:19`
- NG-3 An endpoint that lists every tag in use. — `specs/2026-10-17-note-tags.md:20`
- NG-4 Persisting tags across restarts — the store is in memory, and stays so. — `specs/2026-10-17-note-tags.md:21`
- NG-5 Paging or capping `GET /notes`. — `specs/2026-10-17-note-tags.md:22`

Acceptance criteria:
- AC-1 WHEN a client sends `POST /notes` with a `tags` array of valid tags, the API shall return the created note with `tags` holding each tag trimmed and lowercased, in the order sent. — `specs/2026-10-17-note-tags.md:32` — clear
- AC-2 WHEN a client sends `POST /notes` without a `tags` field, the API shall create the note with `tags` equal to `[]`. — `:33` — clear
- AC-3 WHEN the `tags` of a `POST /notes` request hold the same tag more than once after trimming and lowercasing, the API shall keep only the first occurrence of that tag. — `:34` — clear
- AC-4 IF the `tags` field of a `POST /notes` request is present and is not an array whose elements are all strings, THEN the API shall respond `400` with `{"error": "tags must be an array of strings"}`. — `:35` — clear
- AC-5 IF a tag of a `POST /notes` request, after trimming and lowercasing, is empty, is longer than 32 characters, or holds a character other than `a`–`z`, `0`–`9`, `-` and `_`, THEN the API shall respond `400` with `{"error": "tag is invalid"}`. — `:36` — clear
- AC-6 IF the `tags` of a `POST /notes` request hold more than 10 distinct tags after trimming, lowercasing and removing duplicates, THEN the API shall respond `400` with `{"error": "too many tags"}`. — `:37` — clear
- AC-7 IF a `POST /notes` request is refused for its tags, THEN the API shall store no note. — `:38` — clear
- AC-8 The API shall include a `tags` array in every note it returns from `POST /notes`, `GET /notes` and `GET /notes/:id`. — `:39` — clear
- AC-9 WHEN a client sends `GET /notes?tag=<tag>`, the API shall respond `200` with exactly the notes whose `tags` contain that tag after it is trimmed and lowercased, in the order unfiltered `GET /notes` returns them. — `:40` — clear
- AC-10 WHEN a client sends `GET /notes?tag=<tag>` with a valid tag that no note carries, the API shall respond `200` with `[]`. — `:41` — clear
- AC-11 IF the `tag` query parameter of `GET /notes` is empty or is not a valid tag by the rule of AC-5, THEN the API shall respond `400` with `{"error": "tag is invalid"}`. — `:42` — clear
- AC-12 IF the `tag` query parameter appears more than once in a `GET /notes` request, THEN the API shall respond `400` with `{"error": "only one tag filter is allowed"}`. — `:43` — clear
- AC-13 WHEN a client sends `GET /notes` without a `tag` query parameter, the API shall respond `200` with every note, in the order it returns them today. — `:44` — clear (today's behaviour at `src/server.js:18`, `src/notes.js:4-6`; kept)

Edge cases EC-1…EC-13 (`:48-60`) and NFR-1…NFR-3 (`:64-66`) are planned as stated; each is mapped to a test in section 4.

## 2. Impact map
| Package | Path | New / Modify | Layer or placement | AC |
|---|---|---|---|---|
| notes-api | `src/notes.js` | Modify | rules + in-memory store ("behaviour lives in notes.js", AGENTS.md:18) | AC-1…AC-7, AC-9…AC-12, NFR-1 |
| notes-api | `src/server.js` | Modify | HTTP wiring and routing only (AGENTS.md:12, :18) | AC-8, AC-9, AC-11, AC-12, AC-13 |
| notes-api | `test/notes.test.js` | Modify | unit tests of `src/notes.js` | AC-1, AC-2, AC-3, AC-5, AC-6, AC-7, AC-9, AC-11, AC-12 |
| notes-api | `test/server.test.js` | New | route tests of `src/server.js`, app in-process (one test file per source file, AGENTS.md:14) | AC-4, AC-5, AC-6, AC-8…AC-13, NFR-2, NFR-3 |

Nothing is pre-wired for "tag" anywhere: there is no message catalogue, contracts module, registry or mocks folder in the repository (`git ls-files`: AGENTS.md, README.md, package.json, specs/.gitkeep, src/notes.js, src/server.js, test/notes.test.js).

## 3. Constraints in play
- Layering (AGENTS.md:18; onion-architecture OA-9): every tag rule — normalising, validating, counting, deduplicating, filtering, and refusing a repeated filter — lives in `src/notes.js`. `src/server.js` only extracts `url.searchParams.getAll('tag')` and passes it on. It writes no new error response by hand; it throws nothing new and relies on the existing `catch` (`src/server.js:26-29`).
- Errors (AGENTS.md:19): every new refusal is `throw new ValidationError('<exact spec message>')` in `src/notes.js`. The existing `catch` turns it into `400 { "error": message }`. The four messages are copied verbatim from spec `:84`: `tags must be an array of strings`, `tag is invalid`, `too many tags`, `only one tag filter is allowed`. User-visible strings live in `notes.js` as `ValidationError` messages today (`src/notes.js:10`); that convention is kept.
- Wire contract (spec `:79-84`): `id`, `title`, `body` and `createdAt` keep their names and types (NFR-2); `tags` is added as a `string[]`. There is one copy of the contract (no shared contracts module), so no drift check is needed.
- Input safety (security → `SKILL.md` § Framework Security Quirks, `checklists.md` § Input Validation): the tag rule is a fixed, anchored regex literal, `/^[a-z0-9_-]{1,32}$/`. User input is never compiled into a `RegExp` (no ReDoS), and the filter compares by string equality (`Array.prototype.includes`), never by regex or prefix (EC-7, NG-2). Only the `title`, `body` and `tags` fields are read from the body; the body is never spread into the stored note.
- No migration, no dependency, no protected path is touched.

## 4. Stages

### Stage 1 — Tag rule and tags on create (`src/notes.js`)
Track: main · After: —
Files: `src/notes.js`, `test/notes.test.js`
Read first: `src/notes.js` — the store, `createNote` and `ValidationError` to extend; `test/notes.test.js` — the `node:test` + `assert/strict` + `beforeEach(resetNotes)` pattern to follow; `specs/2026-10-17-note-tags.md:30-60` — the criteria and edge cases with their exact messages.
Steps:
1. In `src/notes.js`, add the module constants `MAX_TAGS = 10` and `TAG_PATTERN = /^[a-z0-9_-]{1,32}$/`. The length bound 1–32 and the character set are both in the pattern, so the empty, too-long and bad-character cases share one check (AC-5).
2. Add the non-exported `normalizeTag(raw)`. It returns `raw.trim().toLowerCase()` when the result matches `TAG_PATTERN`, and otherwise throws `new ValidationError('tag is invalid')`.
3. Add the non-exported `normalizeTags(tags)`:
   - `tags === undefined` → return `[]` (AC-2; JSON cannot carry `undefined`, so a missing field is the only way to get here).
   - `!Array.isArray(tags) || !tags.every((t) => typeof t === 'string')` → throw `new ValidationError('tags must be an array of strings')` (AC-4; this covers `null`, `"work"` and `[1]`).
   - Map each element through `normalizeTag`, in order (AC-1, AC-5).
   - Deduplicate keeping the first occurrence, e.g. `[...new Set(normalized)]`, which keeps insertion order (AC-3).
   - If more than `MAX_TAGS` remain → throw `new ValidationError('too many tags')` (AC-6: the count is taken after normalising and deduplicating).
4. Change `createNote({ title, body })` to `createNote({ title, body, tags })`. Keep the title check first, as today. Then call `const noteTags = normalizeTags(tags)`. Only after both checks pass, take `nextId++` and build the note `{ id, title, body, createdAt, tags: noteTags }`. A refused request stores nothing and consumes no id (AC-7). Field names and types for `id`, `title`, `body` and `createdAt` stay unchanged (NFR-2).
5. Keep `resetNotes`, `getNote` and `ValidationError` as they are. `getNote` returns the stored note, which now carries `tags`.
Skills: `engineering-paved-path:onion-architecture` → `rules/errors.md` (the use case decides the failure; translation stays in the one existing handler — applied with the project's 400 + `{ error }` shape, § 0) and `rules/layers.md` / `SKILL.md` OA-9 (business rules live in the rules module, not the route) · `engineering-paved-path:security` → `checklists.md` § Input Validation (type, length and format checked server-side) and `SKILL.md` § Framework Security Quirks (no `RegExp` built from input).
Tests to add: `test/notes.test.js`
- `["  Work ", "home"]` → `tags` is `["work", "home"]`, and `getNote(id).tags` matches (AC-1).
- No `tags` → `tags` is `[]`; `tags: []` → `[]` (AC-2, EC-1).
- `["a", " A ", "b", "a"]` → `["a", "b"]` (AC-3, EC-3).
- `"x".repeat(32)` is accepted; `"x".repeat(33)`, `""`, `"   "`, `"my tag"` and `"café"` each throw `ValidationError` with message `tag is invalid` (AC-5, EC-5, EC-6).
- 11 distinct tags throw `too many tags`; 10 distinct tags, and 12 tags of which 10 are distinct, are accepted (AC-6, EC-4).
- `tags: null`, `"work"` and `[1]` throw `tags must be an array of strings` (AC-4, unit-level).
- For a refused create, `listNotes().length` is the same before and after (AC-7, EC-12).
Done when: `npm test` passes, and the three existing tests in `test/notes.test.js` still pass unchanged.

### Stage 2 — Filter by one tag in `listNotes` (`src/notes.js`)
Track: main · After: 1
Files: `src/notes.js`, `test/notes.test.js`
Read first: `src/notes.js` (as left by stage 1) — `listNotes` and `normalizeTag`; `test/notes.test.js` — the tests from stage 1.
Steps:
1. Change `listNotes()` to `listNotes(tagValues = [])`, where `tagValues` is the array of raw `tag` query values. The existing call `listNotes()` (test/notes.test.js:20) keeps working.
   - `tagValues.length === 0` → return `[...notes.values()]` as today (AC-13).
   - `tagValues.length > 1` → throw `new ValidationError('only one tag filter is allowed')` (AC-12). This is checked before validity, so `?tag=&tag=b` gets this error.
   - Exactly one value → `const tag = normalizeTag(tagValues[0])`; this throws `tag is invalid` for an empty or invalid tag (AC-11, EC-9). Return `[...notes.values()].filter((n) => n.tags.includes(tag))`. That is a whole-tag equality match that keeps store order (AC-9, EC-7, EC-8), and returns `[]` when no note matches (AC-10).
Skills: `engineering-paved-path:onion-architecture` → `SKILL.md` OA-9 (the filter rule is testable without HTTP) · `engineering-paved-path:security` → `SKILL.md` § Framework Security Quirks (equality match, no regex from input).
Tests to add: `test/notes.test.js`
- With notes tagged `work`, `work-log` and none, `listNotes(['WORK'])` and `listNotes([' work '])` return only the `work` note (AC-9, EC-7, EC-8).
- Order is kept: two `work` notes are returned in creation order (AC-9).
- `listNotes(['unused'])` → `[]` (AC-10).
- `listNotes([''])` and `listNotes(['my tag'])` throw `tag is invalid` (AC-11).
- `listNotes(['a', 'b'])` throws `only one tag filter is allowed` (AC-12).
- `listNotes([])` returns all notes, tagged and untagged (AC-13).
Done when: `npm test` passes.

### Stage 3 — Route wiring and route tests (`src/server.js`, new `test/server.test.js`)
Track: main · After: 2
Files: `src/server.js`, `test/server.test.js` (New)
Read first: `src/server.js` — routing at :18-25, the error mapping at :26-29, the guarded `listen` at :32; `src/notes.js` — the `listNotes(tagValues)` and `createNote({ title, body, tags })` signatures from stages 1–2; `test/notes.test.js` — the test style to mirror.
Steps:
1. In `src/server.js:18`, replace `listNotes()` with `listNotes(url.searchParams.getAll('tag'))`. Other query parameters stay ignored (EC-11). Nothing else in `server.js` changes:
   - `POST /notes` already passes the parsed body to `createNote`, so `tags` arrives through it (AC-1…AC-7).
   - `GET /notes/:id` returns the stored note, now with `tags` (AC-8).
   - The `catch` at :27 already maps `ValidationError` to `400 { error }` (NFR-3).
2. Create `test/server.test.js`:
   - Import `server` from `../src/server.js` and `resetNotes` from `../src/notes.js`.
   - In `before`, call `await new Promise((r) => server.listen(0, '127.0.0.1', r))` and build the base URL from `server.address().port`.
   - In `after`, call `await new Promise((r) => server.close(r))`. If the run hangs on keep-alive sockets, call `server.closeAllConnections()` before `close`.
   - In `beforeEach`, call `resetNotes()`.
   - Make requests with the global `fetch`. Write small helpers `post(body)` → `{ status, json }` and `get(path)` → `{ status, json }`. Send JSON bodies with `content-type: application/json`.
   - Importing `server.js` does not start port 3000: the guard at `src/server.js:32` only listens when it is the entry script.
Skills: `engineering-paved-path:onion-architecture` → `rules/testing.md` (driving adapters are tested through the HTTP surface; no doubles needed, since the store is in-memory) and `SKILL.md` OA-2/OA-9 (the route calls one rules-module function and holds no rule) · `engineering-paved-path:security` → `checklists.md` § Input Validation (query parameter validated before use).
Tests to add: `test/server.test.js`
- AC-4 / EC-2: `POST /notes` with `{ title: 't', tags: 'work' }`, `tags: null` and `tags: [1]` → `400`, `{ error: 'tags must be an array of strings' }`.
- AC-5 / EC-5 / EC-6: tags `[""]`, `["   "]`, a 33-character tag, `["my tag"]` and `["café"]` → `400`, `{ error: 'tag is invalid' }`; a 32-character tag → `201`.
- AC-6 / EC-4: 11 distinct tags → `400`, `{ error: 'too many tags' }`; 10 distinct, and 12 with 10 distinct → `201`.
- AC-7 / EC-12 (route level): after a refused POST, `GET /notes` returns `[]`.
- AC-8: `tags` is an array on the `POST /notes` response, on every item of `GET /notes`, and on `GET /notes/:id`.
- AC-9 / EC-7 / EC-8: with notes tagged `work`, `work-log` and none, `GET /notes?tag=WORK` and `?tag=%20work%20` → `200` with only the `work` note.
- AC-10: `?tag=unused` → `200`, `[]`.
- AC-11 / EC-9: `?tag=` and `?tag=my%20tag` → `400`, `{ error: 'tag is invalid' }`.
- AC-12 / EC-10: `?tag=a&tag=b` → `400`, `{ error: 'only one tag filter is allowed' }`.
- AC-13 / EC-11: `GET /notes` and `GET /notes?foo=bar` → `200` with all tagged and untagged notes in creation order.
- NFR-2: `POST /notes` with `{ title: 'Hello', body: 'x' }` (no `tags`) → `201`; `id` is a number, `title` is `'Hello'`, `body` is `'x'`, `createdAt` is a string that `Date.parse` accepts, and `tags` is `[]`.
- NFR-3: covered by the error-body assertions above (every new error is `{ error: <string> }` with status 400).
Done when: `npm test` passes, and runs both `test/notes.test.js` and `test/server.test.js` (both appear in the TAP output).

## 5. Skills matrix
| Stage | engineering-paved-path:onion-architecture | engineering-paved-path:security |
|---|---|---|
| 1 | `rules/errors.md`, `rules/layers.md` (OA-9) | `checklists.md` § Input Validation; `SKILL.md` § Framework Security Quirks |
| 2 | `SKILL.md` (OA-9) | `SKILL.md` § Framework Security Quirks |
| 3 | `rules/testing.md`; `SKILL.md` (OA-2, OA-9) | `checklists.md` § Input Validation |

## 6. Verification
| Package | Command (from the repository root) | Proves |
|---|---|---|
| notes-api | `npm test` | `node --test` runs `test/notes.test.js` (unit: AC-1, AC-2, AC-3, AC-5, AC-6, AC-7, AC-9…AC-13) and `test/server.test.js` (route: AC-4…AC-13, NFR-2, NFR-3); the existing three tests guard today's behaviour |

There is no typecheck or lint script (`package.json:6-9`); `npm test` is the whole check (AGENTS.md:8).

## 7. Risks and open questions
- [non-blocking] Execution mode: single-agent — stated by the user in the task. No question stands.
- [non-blocking] Precedence when one request breaks several rules. The spec gives each refusal alone and says nothing about combinations; decided under the user's standing instruction:
  - `POST /notes`: title (as today), then the `tags` type (AC-4), then each tag in the order sent (AC-5, first invalid tag wins), then the count after deduplication (AC-6).
  - `GET /notes`: a repeated `tag` (AC-12) before validity (AC-11).
  - Every single-fault case in the spec gives the same result under any order.
- [non-blocking] A refused create consumes no id (validation runs before `nextId++`). The spec only requires that no note be stored (AC-7); this choice keeps ids contiguous. Decided under the standing instruction.
- [non-blocking] Unicode case mapping: `String.prototype.toLowerCase` maps a few non-ASCII letters onto ASCII (e.g. KELVIN SIGN U+212A → `k`), so such input is accepted as the ASCII tag. This follows AC-5's "after trimming and lowercasing" wording, and the stored value still satisfies NFR-1. No action.
- [non-blocking] Pre-existing bug, out of scope: `POST /notes` with JSON body `null` makes `createNote` throw a `TypeError` while destructuring (`src/notes.js:8`), which ends as 500 (`src/server.js:28`). This plan does not touch it (see REC1).
- [non-blocking] Not checked here (the read-only guard refused `node --version`): Node >= 22 provides global `fetch`, `node --test` with no arguments discovers `test/*.test.js`, and `server.close()` closes idle keep-alive connections. Stage 3 names the `closeAllConnections()` fallback.

## 8. Handoff to reviewers
- Architecture: no new module, port or cross-module edge. Check that `src/server.js` gains only the `getAll('tag')` argument and no tag rule, and that every new refusal is a `ValidationError` thrown from `src/notes.js`.
- Security: there are two new untrusted inputs: UI-1 (`tags` in the POST body) and UI-2 (the `tag` query parameter).
  - Check that the tag pattern is a fixed, anchored literal.
  - Check that the filter is an equality match.
  - Check that at most 10 tags of at most 32 `[a-z0-9_-]` characters reach the store (NFR-1).
  - Check that no body field other than `title`, `body` and `tags` is copied into a note.

## 9. Execution
Mode: single-agent — stated in the task ("Execution mode: single-agent", answer relayed by the calling session).
Recommended: single-agent — one package; three stages that chain (2 extends 1's `normalizeTag`, 3 depends on both signatures); stages 1–2 share `src/notes.js` and `test/notes.test.js`.
| Track | Stages | Write set | After | Runs |
|---|---|---|---|---|
| main | 1–3 | `src/notes.js`, `test/notes.test.js`, `src/server.js`, `test/server.test.js` | — | alone |
Briefs — one or two stages each, a fresh `implementer` per brief, in order inside a track:
- main · stages 1–2 → "Execute stages 1–2 of specs/2026-10-17-note-tags-plan.md (track main). Write only inside: src/notes.js, test/notes.test.js. Check with: npm test."
- main · stage 3 → "Execute stage 3 of specs/2026-10-17-note-tags-plan.md (track main). Write only inside: src/server.js, test/server.test.js. Check with: npm test."
single-agent: the same briefs, one after another, 1 → 2; the Runs column is not used.

## 10. Recommendations — not applied
- REC1 [scope] Fix the pre-existing `POST /notes` with body `null` → 500 as a separate bug fix, not in this change. Have `createNote` (or `readJson`) refuse a non-object body with `400`. — why: `src/notes.js:8` destructures the argument, and `src/server.js:12` passes `JSON.parse('null')` straight through; the spec authoring notes put it out of scope. — would change: nothing in this plan; it would be a one-line fix with its own test after this lands.
- REC2 [requirements] Add a line to `AGENTS.md` § Layout naming `test/server.test.js` as the route-test file that starts the server in-process. — why: AGENTS.md:14 says one test file per source file, but no route test existed until now. — would change: one doc line; no stage.
