#!/usr/bin/env bash
# Pre-release checks for one plugin; prints the tag commands, never pushes.
set -euo pipefail

plugin="${1:-}"
[[ -n "$plugin" ]] || { echo "usage: scripts/release.sh <plugin>" >&2; exit 2; }
root="$(cd "$(dirname "$0")/.." && pwd)"
dir="$root/plugins/$plugin"
[[ -f "$dir/.claude-plugin/plugin.json" ]] || { echo "no such plugin: $plugin" >&2; exit 2; }

version="$(node -p "require('$dir/.claude-plugin/plugin.json').version")"
tag="$plugin--v$version"
cd "$root"

branch="$(git rev-parse --abbrev-ref HEAD)"
[[ "$branch" == "main" ]] || echo "WARN  releasing from '$branch', not main"
[[ -z "$(git status --porcelain)" ]] || { echo "FAIL  working tree is dirty" >&2; exit 1; }
git rev-parse -q --verify "refs/tags/$tag" >/dev/null && { echo "FAIL  $tag already exists — bump the version" >&2; exit 1; }
grep -q "^## \[$version\]" "$dir/CHANGELOG.md" || { echo "FAIL  CHANGELOG.md has no [$version] entry" >&2; exit 1; }

for dep in $(node -p "(require('$dir/.claude-plugin/plugin.json').dependencies||[]).map(d=>typeof d==='string'?d:d.name).join(' ')"); do
  git tag --list "$dep--v*" | grep -q . || echo "WARN  dependency $dep has no release tag yet — release it first"
done

node scripts/validate.mjs >/dev/null && echo "ok    scripts/validate.mjs"
claude plugin validate . >/dev/null && echo "ok    claude plugin validate ."
claude plugin validate "plugins/$plugin" >/dev/null && echo "ok    claude plugin validate plugins/$plugin"
(cd "$dir" && claude plugin tag --dry-run)

cat <<MSG

Release $tag at $(git rev-parse --short HEAD). Next:
  (cd plugins/$plugin && claude plugin tag)      # create the annotated tag
  git push origin $tag                             # publish it
Record version, tag, commit SHA and eval results in the CHANGELOG / PR.
MSG
