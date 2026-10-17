# research-tools

A read-only `researcher` agent that answers **one concrete question** with evidence —
`file:line`, a commit hash or a URL behind every claim — and says explicitly what it
could not find. It never edits, installs or commits; a plugin hook enforces that.

## When to use it

When a decision needs evidence first:

- "Where is X handled, and is there a second copy?"
- "Why was Y done this way — which commit, which ADR?"
- "Does library Z at the version we use support W?"
- "What changed between v4 and v5 of Fastify that affects us?"

Not for open topics ("look into caching"): the researcher returns a short
**Clarification needed** block with 1–4 questions instead of guessing, and the calling
session asks the user.

## Components

| Component | Type | Role |
|---|---|---|
| `researcher` | agent (`model: sonnet`) | answers the question; tools `Read, Grep, Glob, Bash, WebSearch, WebFetch`; `Write, Edit, NotebookEdit, Agent` disallowed |
| `hooks/hooks.json` → `hooks/readonly-guard.mjs` | PreToolUse hook | read-only guard for this agent only |
| `hooks/guard-cases.tsv` + `scripts/check-guard.mjs` | test table + runner | every guard decision as input → expected exit code |

## The two modes

| Mode | Answers from | Report |
|---|---|---|
| **REPO** | the current repository: code, config, docs, specs, migrations, knowledge files named in `CLAUDE.md` / `AGENTS.md` (e.g. `INSIGHTS.md`, ADRs), git history | `# Research report — REPO`: answer + confidence, findings with `file:line` / commit evidence, inferences, references, **Not found / unverified**, next step |
| **EXTERNAL** | official docs, changelogs and source of the exact version in use, issue trackers, standards; blogs only to corroborate | `# Research report — EXTERNAL`: the same, plus conflicts between sources and relevance to the repository |

A question with both parts gets the EXTERNAL report first, then the REPO one. The answer
is written in the language of the question.

## Delegating to it from another plugin

Declare the dependency and call the agent by its namespaced name:

```json
"dependencies": [{ "name": "research-tools", "version": "^1.0.0" }]
```

```text
Agent(subagent_type: "research-tools:researcher",
      prompt: "REPO: where is the request timeout configured for outbound HTTP calls, and is it the same in every service? Scope: src/**. For: deciding where to add a retry policy.")
```

Give one question, its scope, and what the answer is for. Run several researchers in
parallel for independent questions. Treat a **Clarification needed** reply as questions to
relay to the user, then resend the answer to the same agent.

## The read-only guard

`hooks/readonly-guard.mjs` runs before every `Bash`, `Write`, `Edit`, `MultiEdit` and
`NotebookEdit` call in the session, and acts **only** when the hook input's `agent_type` is
exactly `research-tools:researcher`. The main session and every other agent pass untouched
(exit 0, no output). A bare `researcher` is not matched on purpose: it may be a
repository's own agent with different rules.

For the researcher it blocks (exit 2, reason on stderr):

- the write tools;
- redirects into files (`>`, `>>`, `&>`, `>|`, `>&file`; `/dev/null` and fd duplication are fine);
- file-writing commands: `rm mv cp dd tee touch mkdir ln chmod truncate tar unzip wget …`,
  `sed -i`, `find -delete/-exec`, `sort -o`, awk programs that write or run commands;
- git state changes — only read-only git is allowed (`log show blame diff grep status
  rev-parse ls-files …`, listing `branch` / `tag` / `remote` / `stash list`);
- package installs and runners (`npm/pnpm/yarn` other than `ls why view outdated …`,
  `npx`, `pip install`, `brew`, `apt` …);
- interpreters with inline code (`node -e`, `python -c`, `perl -pi`), `eval`, `sudo`,
  scripts it cannot inspect, `curl` writing a file or sending data, write calls through `gh`.

It reads inside `$( … )`, backticks, `<( … )`, `bash -c '…'`, `xargs`, `env`, `timeout`.
It **fails closed**: unparseable input or a command it cannot read (unbalanced quotes)
exits 2.

Check it without a model:

```bash
node plugins/research-tools/scripts/check-guard.mjs
```

The guard needs Node.js >= 22 on `PATH` (see `COMPATIBILITY.md`). It makes no network
calls and writes nothing.

## Install

```text
/plugin marketplace add vklyovsa/dev-digest-ai-marketplace
/plugin install research-tools@dev-digest-ai-marketplace
```

## Inputs, outputs, configuration

- Reads: the repository (read-only) and, in EXTERNAL mode, the web pages it cites.
- Writes: nothing. The report is the agent's reply.
- Configuration: none. The repository's `CLAUDE.md` / `AGENTS.md` override the agent's
  defaults where they disagree.
- Dependencies: none.
