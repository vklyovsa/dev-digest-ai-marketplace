#!/usr/bin/env bash
# notes-api fixture plus a draft spec in which US-4 has no acceptance criterion and no source says what "done" means for it.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cp -R "$here/../fixtures/notes-api"/. .
cp -R "$here/../fixtures/draft-spec"/. .
git init -q -b main
git -c user.name=eval -c user.email=eval@example.invalid add -A
git -c user.name=eval -c user.email=eval@example.invalid commit -q -m "notes-api with a draft spec"
