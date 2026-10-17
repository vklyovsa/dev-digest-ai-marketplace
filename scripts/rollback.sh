#!/usr/bin/env bash
# Prints the rollback sequence to the stable channel pinned at <plugin>--v<version>. Runs nothing.
set -euo pipefail

plugin="${1:-}"; version="${2:-}"; scope="${4:-project}"
[[ "${3:-}" == "--scope" || -z "${3:-}" ]] || { echo "usage: scripts/rollback.sh <plugin> <version> [--scope user|project|local]" >&2; exit 2; }
[[ -n "$plugin" && -n "$version" ]] || { echo "usage: scripts/rollback.sh <plugin> <version> [--scope user|project|local]" >&2; exit 2; }

repo="vklyovsa/dev-digest-ai-marketplace"
mp="dev-digest-ai-marketplace"
tag="$plugin--v$version"

if git rev-parse -q --verify "refs/tags/$tag" >/dev/null 2>&1; then
  echo "# $tag -> $(git rev-list -n1 "$tag" | cut -c1-12)"
else
  echo "# WARN: tag $tag not found in this checkout — check 'git fetch --tags'"
fi

cat <<CMDS
claude plugin marketplace remove $mp
claude plugin marketplace add $repo#$tag --scope $scope
claude plugin install $plugin@$mp --scope $scope
claude plugin list --json
# /reload-plugins or a new session, then:
claude plugin eval $plugin@$mp --case 'smoke-*' --runs 1 --no-publish

# back to latest:
claude plugin marketplace remove $mp
claude plugin marketplace add $repo --scope $scope
claude plugin install $plugin@$mp --scope $scope
CMDS
