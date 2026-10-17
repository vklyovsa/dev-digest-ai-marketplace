# Catalog site

A static catalog of this marketplace on GitHub Pages: search plugins, skills, agents, commands,
hooks and MCP servers, read their docs, see dependencies, copy the install command.
React 19 + TypeScript + Vite, hash routing, MiniSearch, `marked` + DOMPurify. The contract is
[`docs/SITE-SPEC.md`](../docs/SITE-SPEC.md).

## Run locally

Node >= 22.

```bash
npm run build:index            # repo root: writes site/public/*.json and bodies/
cd site && npm ci && npm run dev
```

`npm run dev` and `npm run build` regenerate the index first (`predev` / `prebuild`).
Other scripts: `npm run typecheck`, `npm run preview` (serves `dist/`).

## How the index is built

`scripts/build-index.mjs` (no dependencies) reads `.claude-plugin/marketplace.json` and, for every
plugin, `plugin.json`, `README.md`, `CHANGELOG.md`, `COMPATIBILITY.md`, `agents/*.md`,
`skills/*/SKILL.md`, `commands/*.md`, `hooks/hooks.json` and `.mcp.json`. It writes:

- `site/public/index.json` — plugins and artifacts, plus plain-text bodies for search
- `site/public/releases.json` — CHANGELOG sections joined with `<plugin>--v<version>` git tags
- `site/public/stats.json` — counts for the home tiles
- `site/public/bodies/*.md` — markdown bodies loaded by detail pages

It exits non-zero when a marketplace entry points to a missing plugin or its name differs from
`plugin.json`. Flags: `--root <dir>` (marketplace to index, default the repo root) and
`--out <dir>` (default `site/public`); `MARKETPLACE_ROOT` / `INDEX_OUT` do the same through
`npm run dev` / `npm run build`. All generated files are git-ignored.

## Deploy

`.github/workflows/pages.yml` builds on every push to `main` (and on manual dispatch) and
deploys `site/dist` to <https://vklyovsa.github.io/dev-digest-ai-marketplace/>. Enable it once in
Settings → Pages → Source: GitHub Actions.
