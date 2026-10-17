# Compatibility

## Requires

Claude Code >= 2.1.110

## Tested

| Claude Code | OS | Result |
|---|---|---|
| 2.1.295 | Linux | `claude plugin validate` passes; `node scripts/check-guard.mjs` passes |

## Plugins

`engineering-paved-path` `^1.0.0` — installed automatically as a dependency (the
fallback rulebooks and the skill-routing table).

## External tools

| Tool | Needed for | When missing |
|---|---|---|
| Node.js >= 22 on `PATH` | the read-only guard hook and `collect-diff.sh` | the guard does not run (Claude Code treats a failed hook command as non-blocking) and `collect-diff.sh` exits `69`; the reviewer then works from an inline diff only |
| `git` | collecting the diff | the reviewer asks for an inline diff |
| `dependency-cruiser` / ESLint in the consumer repository | deterministic boundary checks | the reviewer falls back to targeted greps and lists the check under "Not checked" |

## OS

Linux and macOS. Windows works through WSL or Git Bash; the guard parses POSIX shell
syntax only.
