---
description: A question that needs evidence from official docs is delegated to the researcher, which answers with sources.
tags: [smoke]
plugins: [../..]
runs: 1
max_turns: 15
timeout_seconds: 600
allowed_tools: [Agent, Read, Glob, Grep, WebSearch, WebFetch]
---

Use the research-tools researcher: does Node.js 22 ship a built-in test runner, and which CLI flag runs it? Give me the answer with the source URL.
