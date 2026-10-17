# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow SemVer.

## [1.0.1] - 2026-10-17

### Removed

- Upstream packaging leftovers: `fastify-best-practices/tile.json` (registry manifest) and `zod/assets/templates/_template.md` (authoring template).

### Added

- README: an Evals section.

## [1.0.0] - 2026-10-17

### Added

- Twelve engineering skills: `react-best-practices`, `react-testing-library`,
  `next-best-practices`, `fastify-best-practices`, `frontend-ui-architecture`,
  `onion-architecture`, `drizzle-orm-patterns`, `postgresql-table-design`, `zod`,
  `typescript-expert`, `security`, `mermaid-diagram`.
- `skill-routing` (not user-invocable): file-pattern → skill table for planners and
  reviewers, overridable by a repository routing file.
- `mapping.md` in `onion-architecture` and `frontend-ui-architecture`: how to map the
  layers and placement rules onto any repository from its own architecture docs.
