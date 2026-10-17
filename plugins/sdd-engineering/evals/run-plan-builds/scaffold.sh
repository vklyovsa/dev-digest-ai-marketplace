#!/usr/bin/env bash
# notes-api fixture plus an approved spec and its single-agent plan (produced by an earlier spec-and-plan run).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cp -R "$here/../fixtures/notes-api"/. .
cp -R "$here/../fixtures/approved-plan"/. .
git init -q -b main
git -c user.name=eval -c user.email=eval@example.invalid add -A
git -c user.name=eval -c user.email=eval@example.invalid commit -q -m "notes-api with an approved spec and plan"
