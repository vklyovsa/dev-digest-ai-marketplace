# notes-api

A tiny HTTP API for personal notes. Node >= 22, no dependencies, `node:http` only.

## Commands

- Run: `npm start` (port 3000)
- Tests: `npm test` — `node --test`, files in `test/*.test.js`

## Layout

- `src/server.js` — HTTP wiring and routing only
- `src/notes.js` — the notes store (in memory) and its rules
- `test/` — one test file per source file

## Rules

- Routing stays in `server.js`; behaviour lives in `notes.js`.
- JSON responses only; errors are `{ "error": "<message>" }` with a 4xx/5xx status.
- Specs live in `specs/`, written before code for anything bigger than a bug fix.
