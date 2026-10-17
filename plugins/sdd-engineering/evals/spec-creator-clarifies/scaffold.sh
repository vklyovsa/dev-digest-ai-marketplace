#!/usr/bin/env bash
# Stages the notes-api fixture as a git repository in the eval workspace (cwd).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
fixture="$here/../fixtures/notes-api"
cp -R "$fixture"/. .
git init -q -b main
git -c user.name=eval -c user.email=eval@example.invalid add -A
git -c user.name=eval -c user.email=eval@example.invalid commit -q -m "notes-api baseline"
