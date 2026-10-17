# SDD profile

Copy this file to `.claude/sdd-profile.md` in your repository and keep only the keys you need —
every key is optional, and an absent key falls back to discovery or the default
(`templates/profile-reference.md` of the `sdd-engineering` plugin). The agents read the first
`yaml` block below; the prose around it is for people.

Your `CLAUDE.md` / `AGENTS.md` still win over anything here when they disagree.

```yaml
# Where specs and plans live.
specs_dir: specs

# The spec template; default: <specs_dir>/TEMPLATE.md, else the plugin's template.
# spec_template: specs/TEMPLATE.md

# The one "does it still hold" command: typecheck, lint and tests in one call.
# {package} is replaced by a directory from `packages`.
check_command: "pnpm --dir {package} run check"

# Package directories of a monorepo. Leave out for a single-package repository.
packages:
  - apps/web
  - services/api

# Insights files read before editing and appended to by engineering-insights.
insights_files:
  - INSIGHTS.md
  - apps/web/INSIGHTS.md
  - services/api/INSIGHTS.md

# Files that state the architecture rules; the planner and the architecture reviewer read them.
architecture_docs:
  - docs/architecture.md
  - services/api/.dependency-cruiser.cjs

# What maps a file to the skills that govern it: a skill id, or a repository file.
skill_routing: engineering-paved-path:skill-routing

# Globs the implementer must not edit, on top of lockfiles, .env*, applied migrations and settings.
protected_paths:
  - infra/**
  - "**/*.generated.ts"
  - services/api/src/vendor/**

# Where /sdd-engineering:workflow-retro writes its ledger entries.
retro_dir: docs/retro/ledger
```
