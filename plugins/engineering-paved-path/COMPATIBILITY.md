# Compatibility

## Requires

Claude Code >= 2.1.110

## Tested

| Claude Code | OS | Result |
|---|---|---|
| 2.1.295 | Linux | `claude plugin validate` passes; skills load |

## External tools

None. The skills are instructions and reference files only; they ship no scripts and no
hooks. Commands they mention (`depcruise`, `tsc`, `drizzle-kit`, test runners) are the
consumer repository's own tools and are run only where that repository allows it.
