# Releases

Each plugin is versioned and released on its own. The marketplace itself has no version: a
commit on `main` is the catalog, a tag is a release of one plugin.

## Versioning (SemVer)

| Change | Bump | Example |
|---|---|---|
| Wording fix, typo, a bug fix that keeps behaviour as documented | patch `1.0.x` | fix a broken link in a skill |
| New behaviour that existing users do not have to adapt to: a new skill, a new eval, a stricter check that only blocks what was already documented as wrong | minor `1.x.0` | spec-creator refuses to finish a spec with a requirement that has no AC |
| Renamed / removed component, changed output contract, a new required input, a dependency's major bump | major `x.0.0` | plan format sections renumbered |

`version` lives in `plugins/<name>/.claude-plugin/plugin.json` only. Claude Code detects an
update by that string: a commit without a version bump is **not** delivered to users.

A dependent that requires `^1.0.0` keeps working with any `1.x.y` of the dependency. A major
bump of a dependency is a major-or-minor release of every dependent that adopts it.

## Tags

A release is an annotated git tag `<plugin>--v<version>` on a commit of `main` that passed CI:

```
engineering-paved-path--v1.0.0
research-tools--v1.0.0
architecture-review--v1.0.0
sdd-engineering--v1.0.0
```

Claude Code resolves a dependency range to the highest tag in range. A tag is **never moved
or deleted** — a bad release is fixed by a new patch version.

## Release procedure

Dependencies first, consumers last.

```bash
# 1. On main, after the PR with the version bump and CHANGELOG entry is merged and CI is green
git switch main && git pull --ff-only
node scripts/validate.mjs
claude plugin validate . && claude plugin validate plugins/<name>
scripts/eval.sh <name> --ablation none --trust-plugin --scaffold --allow-tools Bash Write Edit   # paste the summary into the PR / release

# 2. Tag — validates that plugin.json and the marketplace entry agree, refuses a dirty tree
cd plugins/<name>
claude plugin tag --dry-run
claude plugin tag --push                       # or: claude plugin tag && git push origin <name>--v<version>
```

`scripts/release.sh <plugin>` runs the same checks and prints the commands; it never pushes.

Release evidence (in the PR description and the CHANGELOG entry): version, tag, commit SHA,
eval pass rate and cost.

## How users get updates

```bash
claude plugin marketplace update dev-digest-ai-marketplace      # refresh the catalog
claude plugin update sdd-engineering@dev-digest-ai-marketplace   # update one plugin
# then /reload-plugins or a new session
```

Auto-update is **off by default** for third-party marketplaces. A user turns it on in
`/plugin` → Marketplaces → `dev-digest-ai-marketplace` → Enable auto-update, or in settings:

```jsonc
// ~/.claude/settings.json (user) or .claude/settings.json (project)
{
  "extraKnownMarketplaces": {
    "dev-digest-ai-marketplace": {
      "source": { "source": "github", "repo": "vklyovsa/dev-digest-ai-marketplace" },
      "autoUpdate": true
    }
  }
}
```

`DISABLE_AUTOUPDATER=1` / `DISABLE_UPDATES=1` switch the pass off unless
`FORCE_AUTOUPDATE_PLUGINS=1` is also set. An auto-update lands after the first message of a
session; the running session keeps the old version until `/reload-plugins`.

## Release channels

Claude Code has no channel concept; a channel is the same repository added at a git ref:

| Channel | Source | Who |
|---|---|---|
| latest | `vklyovsa/dev-digest-ai-marketplace` (default branch) | everyone |
| stable | `vklyovsa/dev-digest-ai-marketplace#<tag>` — the last release that passed the smoke eval | rollback, conservative teams |

Both channels read the same `marketplace.json`, so they share the name
`dev-digest-ai-marketplace`: a user has one of them at a time.

## Rollback

There is no `plugin rollback` command. Rolling back means switching to the stable channel
pinned to the last good release, then switching back once a fixed version is out.
`scripts/rollback.sh <plugin> <version> [--scope project]` prints this sequence for a given
release.

```bash
# 1. Remove the latest channel (installed plugins from it are uninstalled with it)
claude plugin marketplace remove dev-digest-ai-marketplace

# 2. Add the stable channel pinned to the release tag
claude plugin marketplace add vklyovsa/dev-digest-ai-marketplace#sdd-engineering--v1.0.0 --scope project

# 3. Install from it — dependencies resolve inside the same snapshot
claude plugin install sdd-engineering@dev-digest-ai-marketplace --scope project
claude plugin list --json          # sdd-engineering 1.0.0, no errors

# 4. /reload-plugins (or a new session), then the smoke check — a new session must list the
#    agents of all four plugins and its init trace must show the pinned versions
claude -p "Without launching anything, list every subagent type available to you whose id starts with sdd-engineering:, research-tools: or architecture-review:. Print only the ids." \
  --output-format stream-json --verbose --allowedTools Agent --max-budget-usd 1

# Back to latest once the fix is released
claude plugin marketplace remove dev-digest-ai-marketplace
claude plugin marketplace add vklyovsa/dev-digest-ai-marketplace --scope project
claude plugin install sdd-engineering@dev-digest-ai-marketplace --scope project
```

**Plugin data.** `${CLAUDE_PLUGIN_DATA}` (`~/.claude/plugins/data/<id>/`) is kept across
version updates, but `marketplace remove` uninstalls the marketplace's plugins and "deletes their
saved options, secrets and data where it can". Check first with
`claude plugin list --json --data-size`; none of our plugins stores anything there (`null`), so
the rollback loses nothing. A plugin that starts storing data must document a backup step here.

The suites in `plugins/*/evals` run from a marketplace checkout only (`scripts/eval.sh`): their
`plugins:` paths do not exist inside the installed plugin cache, so an installed copy is
smoke-checked with the headless session above, not with `claude plugin eval <plugin>@<marketplace>`. Its outputs live in the consumer
repository (`specs/`, the retro ledger, `INSIGHTS.md`) and are untouched by a rollback.

**External state.** No plugin here changes anything outside the working tree (no network
writes, no databases, no tickets), so a rollback has no external state to restore. A plugin
that ever does must document its own recovery here.

### Rehearsal log

| date | where | from → to | result |
|---|---|---|---|
| 2026-10-17 | DevDigest, project scope | sdd-engineering 1.1.0 → stable `#sdd-engineering--v1.0.0` → latest | install 1.0.0 + 3 deps, no errors; smoke PASS (init: all four plugins at 1.0.0); back to 1.1.0; `.claude/settings.json` identical to before |
