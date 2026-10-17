# Changelog

All notable changes to this plugin are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow SemVer.

## [Unreleased]

### Added

- README: an Evals section. Documentation only — no version bump.

## [1.0.0] - 2026-10-17

### Added

- `architecture-reviewer` agent: reviews a diff against the repository's own architecture
  docs and boundary configs, falls back to the `engineering-paved-path` rulebooks.
- `review-rubric` skill (not user-invocable): severity rubric, finding contract, recheck
  protocol and `collect-diff.sh`.

### Security

- PreToolUse guard (`hooks/readonly-guard.mjs`) scoped to
  `architecture-review:architecture-reviewer`: blocks the write tools and allows only
  allowlisted read-only Bash; fails closed. Cases in `hooks/guard-cases.tsv`, checked by
  `scripts/check-guard.mjs`.
