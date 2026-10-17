# Architecture

Three layers, dependencies point inwards only:

- `src/routes/` — HTTP handlers. May import `src/services/`. **Must not import `src/db/`.**
- `src/services/` — business rules. May import `src/db/`.
- `src/db/` — data access. Imports nothing from the other layers.
