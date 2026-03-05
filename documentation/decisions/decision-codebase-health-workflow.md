---
type: decision
project: quack-app
created: 2026-03-05
last_verified: 2026-03-05
tags: [tooling, code-quality, knip, droid, cleanup]
---

# Decision: Codebase Health Workflow (Doctor → Knip → Cleaner)

## Context

Quack-app accumulated significant tech debt (score: D). Needed a repeatable, automated workflow to detect and fix dead code, performance issues, and code smells.

## Decision

Three-tool pipeline:

1. **Knip** (`npx knip`) — Deterministic dead code/deps detection (TypeScript/JS only). Most precise for unused files (285 found vs doctor's 35), exports (68 vs 27), dependencies (17 vs 5). Use `--fix` for auto-removal.

2. **codebase-doctor** (`.claude/agents/codebase-doctor.md`) — AI-powered analysis for performance issues, code smells, React patterns, memory leaks. Outputs `documentation/codebase-health.md` with A-F score. Can run 3 instances in parallel (dead-code, performance, smells). Multi-language.

3. **codebase-cleaner** (`~/.claude/agents/codebase-cleaner.md`) — Global droid that reads health report and executes recommended actions. Supports `dryRun`, `scope` (dead-code/debug/hardcoded/deps), `priority` (1/2/3). Multi-language.

## Workflow

```
npx knip              → dead code/deps (precise, fast)
codebase-doctor       → performance + smells (pattern analysis)
codebase-cleaner      → execute fixes from health report
```

## Rationale

- Knip is deterministic and catches things AI misses (mutual recursion dead code, test-only deps)
- Doctor catches what Knip can't: performance patterns, React anti-patterns, memory leaks, code smells
- Cleaner is separate from doctor to allow dry runs and selective execution
- All three are reusable across projects (cleaner is global, doctor/knip are language-aware)

## Notes

- Knip needs `knip.json` config for non-standard entry points (Tauri multi-entry: `brain-main.tsx`, `browser-main.tsx`, etc.)
- Doctor's dead code count is less precise than Knip — use Knip for authoritative dead code, doctor for everything else
- Cleaner currently available as `general-purpose` subagent type (global agents not yet registered as subagent types)
