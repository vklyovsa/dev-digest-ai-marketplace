## What changed

<!-- One line per plugin touched: plugin@new-version — what and why. -->

## Checklist

- [ ] `node scripts/validate.mjs` passes locally
- [ ] `claude plugin validate .` and `claude plugin validate plugins/<name>` pass
- [ ] `version` bumped in `plugins/<name>/.claude-plugin/plugin.json` (SemVer, see `docs/RELEASES.md`)
- [ ] `CHANGELOG.md` of every touched plugin has an entry for the new version
- [ ] No secrets, no absolute paths, no product-repository paths (`docs/SECURITY.md`)
- [ ] Cross-plugin references use the namespace (`engineering-paved-path:zod`, `research-tools:researcher`)
- [ ] Behaviour change → an eval case added or updated under `plugins/<name>/evals/`, and its result is pasted below
- [ ] New hook, script, or tool permission → described here and in the plugin README

## Eval evidence

<!-- `scripts/eval.sh <name> …` summary: pass rate, cost, latency. "n/a — docs only" is fine. -->
