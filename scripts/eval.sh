#!/usr/bin/env bash
# Runs a plugin's eval suite from the marketplace root, so a case can load the plugin together
# with its dependencies (case `plugins:` entries must sit under the directory eval runs against).
#   scripts/eval.sh <plugin> [claude plugin eval flags…]
set -euo pipefail
plugin="${1:-}"; shift || true
[[ -n "$plugin" ]] || { echo "usage: scripts/eval.sh <plugin> [flags…]" >&2; exit 2; }
root="$(cd "$(dirname "$0")/.." && pwd)"
[[ -d "$root/plugins/$plugin/evals" ]] || { echo "no evals for $plugin" >&2; exit 2; }
cd "$root"
exec claude plugin eval . --eval-dir "plugins/$plugin/evals" --no-publish "$@"
