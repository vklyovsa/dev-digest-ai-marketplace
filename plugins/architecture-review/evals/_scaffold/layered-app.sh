#!/usr/bin/env bash
# Stages the layered-app fixture, commits it, then leaves an uncommitted change that breaks the layering rule.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
cp -R "$here/../fixtures/layered-app"/. .
git init -q -b main
git -c user.name=eval -c user.email=eval@example.invalid add -A
git -c user.name=eval -c user.email=eval@example.invalid commit -q -m baseline
cat > src/routes/admin.js <<'JS'
import { findUser } from '../db/users.js';
export const handleAdminUser = (req) => ({ ...findUser(Number(req.params.id)), admin: true });
JS
git add src/routes/admin.js
