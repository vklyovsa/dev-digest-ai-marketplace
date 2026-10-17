# L08 lab report — evidence map

Every requirement of the L08 lab ("distribute the AI harness through a marketplace") and
where it is proven. Repository: https://github.com/vklyovsa/dev-digest-ai-marketplace ·
catalog: https://vklyovsa.github.io/dev-digest-ai-marketplace/

## Steps

| Step | What was required | Evidence |
|---|---|---|
| 1 | A separate repository: manifest, plugins, docs, scripts, validation workflow, CODEOWNERS | this repository; [`CONTRIBUTING.md`](../CONTRIBUTING.md), [`SECURITY.md`](SECURITY.md), [`RELEASES.md`](RELEASES.md), [`CODEOWNERS`](../CODEOWNERS), [`validate.yml`](../.github/workflows/validate.yml); ruleset `main protection` (PR + both checks, no force-push) |
| 2 | Portable components separated from DevDigest-specific ones | agents and skills generalised; product facts come from the consumer's `CLAUDE.md` / `AGENTS.md` and `.claude/sdd-profile.md`; `scripts/validate.mjs` fails product paths, absolute paths and secrets |
| 3 | Dependency graph with namespaced references | [`README.md`](../README.md) graph; `plugins/*/.claude-plugin/plugin.json`; `validate.mjs` fails a namespaced reference to a plugin that is not a dependency or to a component it does not ship |
| 4 | `sdd-engineering` assembled: no DevDigest paths, explicit inputs, `${CLAUDE_PLUGIN_ROOT}` / `${CLAUDE_SKILL_DIR}`, documented spec/plan paths and missing-check-command behaviour, COMPATIBILITY ≥ 2.1.110 | [`plugins/sdd-engineering/README.md`](../plugins/sdd-engineering/README.md), [`templates/profile-reference.md`](../plugins/sdd-engineering/templates/profile-reference.md), [`COMPATIBILITY.md`](../plugins/sdd-engineering/COMPATIBILITY.md); guards in `hooks/hooks.json` scoped by `agent_type` (plugin agents ignore `hooks` / `permissionMode`) |
| 5 | Four plugins registered; version only in `plugin.json` | [`.claude-plugin/marketplace.json`](../.claude-plugin/marketplace.json); `claude plugin validate --strict` on the root and each plugin |
| 6 | Static catalog on GitHub Pages: index at build time, search, detail pages, Copy install, DOMPurify, generated files not committed | [`SITE-SPEC.md`](SITE-SPEC.md), [`scripts/build-index.mjs`](../scripts/build-index.mjs), [`site/`](../site), [`pages.yml`](../.github/workflows/pages.yml); PR #2 |
| 7 | Structure validation + behaviour evals, incl. negative ones | CI `validate marketplace` (repo rules, `plugin validate`, guard tables 110/125/152 rows); evals per plugin — see below |
| 8 | Cost baseline and one optimisation, honest result | [`COST-BASELINE.md`](COST-BASELINE.md): dedupe of instructions was cost-neutral ($1.83 → $1.85 median, inside noise), recorded as such; [cost per successful workflow](COST-BASELINE.md#cost-per-successful-workflow) $2.12 → $1.99 under deterministic graders |
| 9 | Release 1.0.0, dependencies first, tags on CI-green commits | tags `engineering-paved-path--v1.0.0`, `research-tools--v1.0.0`, `architecture-review--v1.0.0`, `sdd-engineering--v1.0.0` @ `2a5ccef`; GitHub Releases with evidence |
| 10 | Installed in another existing repository, short workflow without DevDigest files | DevDigest branch [`test/l08-sdd-plugin`](https://github.com/vklyovsa/dev-digest/tree/test/l08-sdd-plugin) (commits `6a3da56` — plugin installed, own SDD copies deleted; `50a7f1f` — `autoUpdate: true` and the run's retro) — [`RELEASES.md` § Consumer verification](RELEASES.md#consumer-verification) |
| 11 | Update to 1.1.0 confirmed by eval; rollback to 1.0.0 rehearsed | PR #5, tag `sdd-engineering--v1.1.0` @ `88fa865`; [`RELEASES.md` § Rollback](RELEASES.md#rollback) with the rehearsal log |

## Final checklist

| Item | Status | Evidence |
|---|---|---|
| Marketplace lives apart from DevDigest | ✅ | separate public repository |
| Contribution, security, releases, cost baseline documented | ✅ | `CONTRIBUTING.md`, `docs/*.md` |
| Four plugins with own boundaries, owners, versions | ✅ | `CODEOWNERS`, `plugin.json`, per-plugin README / CHANGELOG / COMPATIBILITY |
| Dependencies resolve without errors | ✅ | `claude plugin list --json` in the consumer: `errors: []`, dependencies at `1.0.0-2a5ccef6ee8b` (tag-resolved) |
| Pages shows the current catalog with dependencies and README | ✅ | live `index.json` carries the `main` commit |
| architecture-reviewer has no DevDigest paths | ✅ | reads the repository's own architecture docs; `validate.mjs` + grep clean |
| sdd-engineering uses namespaced dependencies | ✅ | `research-tools:researcher`, `architecture-review:architecture-reviewer`, `engineering-paved-path:*` |
| Validation, behaviour and negative evals green | ✅ | table below |
| 1.0.0 installs into another existing project | ✅ | consumer verification |
| Supporting files and scripts survive the plugin cache | ✅ | `workflow-retro` scripts ran from the cache via `${CLAUDE_SKILL_DIR}`; `check-spec.mjs` from `${CLAUDE_PLUGIN_ROOT}` |
| Cost experiment: baseline, quality gate, honest result | ✅ | `COST-BASELINE.md` |
| Cost per successful workflow before and after | ✅ | `COST-BASELINE.md` § Cost per successful workflow: $2.12 → $1.99 (deterministic graders; the LLM-judged $6.37 → $2.99 is judge noise) |
| Catalog update and plugin update checked separately | ✅ | manual `marketplace update` + `plugin update` (1.0.0 → 1.1.0) and auto-update (`research-tools` 1.0.0 → 1.0.1) in `RELEASES.md` |
| 1.1.0 behaviour confirmed by an eval | ✅ | `spec-requires-ac`: story kept + marked open 2/2 on 1.1.0 vs 0/2 on 1.0.0 (1.0.0 deleted it) |
| Stable channel returns 1.0.0, smoke passes | ✅ | rehearsal log |

## Evals (claude-opus-5-5, `--ablation none`, last run of each case)

| Plugin | Case | Result |
|---|---|---|
| engineering-paved-path | `zod-skill-triggers`, `negative-prose` | 1/1, 1/1 |
| research-tools | `delegates-research`, `negative-trivial` | 1/1, 1/1 |
| architecture-review | `finds-layer-violation` | 1/1 |
| sdd-engineering | `smoke-components` | 1/1 |
| sdd-engineering | `negative-unrelated`, `retro-manual-only` | 2/2, 2/2 |
| sdd-engineering | `spec-creator-clarifies` | 2/2 |
| sdd-engineering | `spec-and-plan` (21 graders) | 3/3 — median $1.97, 391 s |
| sdd-engineering | `spec-requires-ac` (1.1.0) | deterministic graders 2/2; its LLM judge split 1/2 |
| sdd-engineering | `run-plan-builds` | 1/1 — implementer → plan-verifier → architecture-reviewer, $0.96 |

Run any suite: `scripts/eval.sh <plugin> --ablation none --trust-plugin --scaffold --allow-tools Bash Write Edit`.

## Known limits

- **Approvals are 0** in the `main` ruleset while there is one owner — `SECURITY.md` says how to raise it.
- **Suites run from a checkout only** — `claude plugin eval` against an installed plugin cannot resolve the cases' `plugins:` paths; installed copies are smoke-checked with a headless session (`RELEASES.md`).
- **The consumer is DevDigest itself** on a test branch with its own SDD copies removed, not an unrelated repository.
- **The one optimisation tried saved nothing measurable**; the next candidate is fewer agent relaunches, which caused every costly outlier.
