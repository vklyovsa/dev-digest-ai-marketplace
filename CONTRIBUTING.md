# Contributing

Everything here is in English: docs, prompts, code comments, commit messages.

## Where things go

| You are adding | Put it in | Read first |
|---|---|---|
| A new plugin | `plugins/<name>/` + an entry in `.claude-plugin/marketplace.json` + a line in `CODEOWNERS` | `docs/PLUGIN-GUIDELINES.md` |
| A skill / agent to an existing plugin | `plugins/<plugin>/skills/<skill>/SKILL.md`, `plugins/<plugin>/agents/<agent>.md` | the plugin's `README.md` |
| A technical skill several plugins need | `plugins/engineering-paved-path/skills/` — never a copy in another plugin | `docs/PLUGIN-GUIDELINES.md` § Dependencies |
| A hook | `plugins/<plugin>/hooks/hooks.json` + the script beside it + rows in its `guard-cases.tsv` | `docs/SECURITY.md` |
| A behaviour eval | `plugins/<plugin>/evals/<case>/{prompt.md,graders/*.md}` | `docs/PLUGIN-GUIDELINES.md` § Evals |
| Catalog site changes | `site/`, `scripts/build-index.mjs` | `docs/SITE-SPEC.md` |

## Plugin manifest fields

`plugins/<name>/.claude-plugin/plugin.json` — `name` (kebab-case, equals the directory and
the marketplace entry), `version` (SemVer, only here), `description`, `author.name`,
`license`, `keywords`, `repository`, `dependencies` (`[{ "name": "...", "version": "^1.0.0" }]`).
Components are discovered from the default folders. The marketplace entry carries `name`,
`source`, `description`, `category` — no `version`.

## Dependency rules

- Depend only on plugins of this marketplace, with a `^` range.
- Reference a dependency's component by its namespaced id (`engineering-paved-path:zod`).
- No cycles; keep the graph in `docs/PLUGIN-GUIDELINES.md` current.
- Raising a dependency's major version is a release of every dependent.

## Checks to run before a pull request

```bash
node scripts/validate.mjs                       # repository rules (names, versions, changelog, paths, secrets, cross-refs)
claude plugin validate .                        # marketplace manifest
claude plugin validate plugins/<name>           # each plugin you touched
node plugins/<name>/scripts/check-guard*.mjs    # hook case tables, if the plugin has hooks
claude plugin eval plugins/<name> --runs 3 --no-publish     # behaviour (costs model calls)
npm run build:index && (cd site && npm ci && npm run build)  # when you touched the catalog or a README
```

Try the plugins without installing them:

```bash
claude --plugin-dir ./plugins/engineering-paved-path \
       --plugin-dir ./plugins/research-tools \
       --plugin-dir ./plugins/architecture-review \
       --plugin-dir ./plugins/sdd-engineering
```

## Pull request checklist

The PR template carries it. In short: version bumped, CHANGELOG entry, checks green, no
secrets or absolute paths, namespaced cross-references, an eval for a behaviour change, hooks
and new permissions called out. CI runs `validate` and `build-site`; `CODEOWNERS` review is
required on `main`.

## Releasing

See `docs/RELEASES.md`. Merging does not release: a tag `<plugin>--v<version>` does.
