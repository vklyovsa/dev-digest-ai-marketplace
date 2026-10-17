# Security policy

A plugin runs with the permissions of the person who installs it: its hooks execute shell
commands, its agents call tools, its skills tell Claude what to run. Treat every change here
as code that will run on a colleague's machine.

## What a plugin must never contain

| Forbidden | Why | Checked by |
|---|---|---|
| Secrets — API keys, tokens, passwords, private keys, `.env` files | anything committed is public forever, even after a revert | `scripts/validate.mjs` (pattern scan) + review |
| Absolute paths (`/home/…`, `/Users/…`, `C:\…`) | they leak a username and break on every other machine | `scripts/validate.mjs` |
| Paths into a product repository (`.claude/agents/scripts/…`, `server/src/…`) | a plugin is installed into repositories that do not have them | `scripts/validate.mjs` + review |
| `$CLAUDE_PROJECT_DIR` pointing at plugin files | plugin files live in the plugin cache, not in the project | `scripts/validate.mjs` |
| Network calls in hooks or scripts that the README does not declare | silent exfiltration path | review |
| Credentials in `plugin.json` / `.mcp.json` | use `userConfig` with `sensitive: true` or an environment variable the user sets | review |

Plugin-internal files are referenced through `${CLAUDE_PLUGIN_ROOT}` (hooks, manifests) or
`${CLAUDE_SKILL_DIR}` (scripts inside a skill).

## Permissions

- **Least privilege per agent.** Every agent declares `tools` and `disallowedTools`. A
  read-only agent has no `Write`, `Edit`, `NotebookEdit`. Only an agent whose job needs the
  web gets `WebSearch` / `WebFetch`.
- **Plugin agents cannot carry `hooks`, `mcpServers` or `permissionMode`** — Claude Code
  ignores them in plugin agents. Hard limits are enforced by the plugin's own
  `hooks/hooks.json`, which scopes each guard to the agent through the `agent_type` field of
  the hook input. A guard fails closed: an unexpected error exits `2`, never `1`.
- **Manual-only skills** (`disable-model-invocation: true`) for anything that writes outside
  the working tree or summarises session transcripts.
- **No auto-commit, no push.** No plugin in this marketplace commits, pushes, tags or opens a
  pull request on the user's behalf.

## Untrusted content

The catalog site renders README and SKILL.md bodies. Markdown goes through `marked` and then
**always** through `DOMPurify` before it reaches the DOM. Repository content is data, never
trusted HTML.

Agents that read pull requests, issues or web pages treat that text as data: an instruction
found inside it is reported, not followed.

## Review before merge

- `CODEOWNERS` assigns every plugin to an owner; the branch ruleset on `main` requires their
  review and the `validate` and `build-site` checks.
- A pull request that adds a hook, a script or a new tool permission says so in its
  description (the PR template has a checkbox for it).

## When an unsafe release went out

1. **Contain.** Open an issue labelled `security` (private advisory if it exposes a secret).
   Tell users to disable the plugin: `claude plugin disable <name>@dev-digest-ai-marketplace`.
2. **Rotate.** If a secret leaked, revoke it first — rewriting history does not un-publish it.
3. **Roll back.** Point users at the last good release (see `docs/RELEASES.md` § Rollback):
   the stable channel pinned to the previous tag.
4. **Fix forward.** Ship a patch release with the fix; never move or delete an existing tag.
5. **Record.** Add a `Security` entry to the plugin's `CHANGELOG.md` naming the affected
   versions.

## Reporting

Report a vulnerability privately to the owners in `CODEOWNERS` (GitHub → Security →
Report a vulnerability). Do not open a public issue for an unfixed problem.
