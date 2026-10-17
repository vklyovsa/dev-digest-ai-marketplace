# Compatibility

## Requires

Claude Code >= 2.1.110

## Tested

| Claude Code | OS | Result |
|---|---|---|
| 2.1.295 | Linux | `claude plugin validate` passes; `node scripts/check-guard.mjs` passes |

## External tools

| Tool | Needed for | When missing |
|---|---|---|
| Node.js >= 22 on `PATH` | the read-only guard hook (`hooks/readonly-guard.mjs`) | the hook command fails and Claude Code treats that as a non-blocking error, so the researcher runs **unguarded** — install Node before relying on the guard |
| `git` | REPO-mode history questions | the researcher reports the history part as "Not found / unverified" |

## OS

Linux and macOS. Windows works through WSL or Git Bash; the guard parses POSIX shell
syntax only.
