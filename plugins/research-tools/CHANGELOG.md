# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow SemVer.

## [1.0.1] - 2026-10-17

### Fixed

- README: an Evals section — what the two cases check and how to run them.

## [1.0.0] - 2026-10-17

### Added

- `researcher` agent: read-only, REPO and EXTERNAL modes, fixed report shape with an
  explicit "Not found / unverified" list.

### Security

- PreToolUse guard (`hooks/readonly-guard.mjs`) scoped to `research-tools:researcher`:
  blocks the write tools and file-writing Bash; fails closed. Cases in
  `hooks/guard-cases.tsv`, checked by `scripts/check-guard.mjs`.
