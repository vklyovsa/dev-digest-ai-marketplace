# Compatibility

## Requires

- Claude Code >= 2.1.110 (version-constrained plugin dependencies)
- Node.js >= 22 — the guard hook and every script; without `node` on `PATH` the hook cannot run and the guards are off
- git — scope, base commit and read-only history for every agent

## Tested

- Claude Code 2.1.295 on Linux.

## Dependencies

Installed automatically with this plugin: `engineering-paved-path` `^1.0.0`, `research-tools` `^1.0.0`,
`architecture-review` `^1.0.0`.

## External tools

None required beyond the above. The check command is whatever your project uses
(`check_command` in `.claude/sdd-profile.md`, or discovered). No script makes a network call.

## Operating systems

Linux and macOS. Windows only through WSL: the guard parses POSIX shell commands.
