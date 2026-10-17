#!/bin/sh
# Collect the open changes of the current working copy. See collect-diff.mjs for options.
command -v node >/dev/null 2>&1 || { echo "collect-diff.sh: node (>= 22) is required" >&2; exit 69; }
exec node "$(dirname "$0")/collect-diff.mjs" "$@"
