---
description: The plugin and its three dependencies load; their agents are visible under namespaced ids.
tags: [smoke]
runs: 1
plugins: [../../../engineering-paved-path, ../../../research-tools, ../../../architecture-review, ../..]
max_turns: 3
allowed_tools: [Agent]
expected_outcome: Lists the four sdd-engineering agents plus research-tools:researcher and architecture-review:architecture-reviewer.
---

Without launching anything, list every subagent type available to you whose id starts with `sdd-engineering:`, `research-tools:` or `architecture-review:`. Print only the exact ids, one per line, and nothing else.
