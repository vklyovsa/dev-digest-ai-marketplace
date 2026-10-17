---
description: A Zod schema task loads the paved-path zod skill.
tags: [smoke]
plugins: [../..]
runs: 1
max_turns: 6
allowed_tools: [Skill, Read, Glob, Grep]
---

Write a Zod schema for a signup payload: email (valid email), password (min 12 chars), optional display name up to 40 chars. Export the schema and its inferred type. Reply with the TypeScript only.
