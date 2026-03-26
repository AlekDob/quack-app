---
type: decision
project: quack-app
created: 2026-03-24
last_verified: 2026-03-24
tags: [skill, code, coder, code-reviewer, documenter, workflow, droid, brain, breadcrumbs, critical-thinking, scoring]
---
# Decision: /code Skill — Code + Review + Document Workflow

## Context

After successfully using the `code-reviewer` droid during Chat mode implementation, we decided to create a reusable skill that combines writing and reviewing into a single workflow.

## Decision

Created a global skill `/code` at `~/.claude/skills/code/` with a four-phase workflow:

### Architecture
```
~/.claude/skills/code/
├── SKILL.md              # Entry point — orchestrates the workflow
└── agents/
    ├── coder.md          # Phase 1: coding instructions
    ├── code-reviewer.md  # Phase 2: review checklist
    └── documenter.md     # Phase 4: Brain documentation + breadcrumbs
```

### Flow
1. **Phase 1 (Code)**: SKILL.md reads `agents/coder.md` and implements the task following DRY, smart commenting, APATR-D methodology
2. **Phase 2 (Review)**: Spawns code-reviewer subagent with `agents/code-reviewer.md` instructions. Runs validation gates (type-check, lint, tests, security scan), scores code across 6 weighted dimensions (0-10), checks for AI pitfalls, produces scored report with PASSED/NEEDS_FIX status (threshold: 8.0)
3. **Phase 3 (Fix Loop)**: If score < 8.0, fixes CRITICAL issues and re-runs Phase 2. Max 3 review rounds. Stops when score >= 8.0 or plateaus
4. **Phase 4 (Document)**: Conditional — spawns documenter subagent with `agents/documenter.md` instructions. Writes Brain entries, places `// Brain:` breadcrumbs in code (the "Pollicino trail"), updates AST.md/map.md, appends diary. Only activates for non-trivial tasks (bug fixes, new patterns, features, architectural decisions).

### Why This Architecture (vs alternatives)
- **Skill + agents/ subfolder** (chosen): follows skill-creator pattern. The skill itself acts as orchestrator, agents/ contains instructions for subagents. Simple, proven pattern.
- **Two separate droids**: more modular but unnecessary coordination overhead for a sequential workflow.
- **Skill = coder, delegate review only**: simpler but loses the ability to customize coder instructions independently.

### Key Design Choices
- **Global scope** (`~/.claude/skills/`): the coder+reviewer pattern is universal, not project-specific
- **Multi-language**: coder.md supports TS, Rust, Python, Go, Swift with language-specific notes
- **Smart commenting for grep**: comments as search landmarks, not code explanations — `// === SECTION ===`, `// WHY:`, purpose comments on exports, `// Brain:` breadcrumbs
- **APATR-D enforced**: Analyze > Plan > Act > Test > Review > Document
- **Code limits**: functions max 20 lines, files max 300 lines
- **Bundled on all coding agents**: auto-installed via `bundledPlugins` on 9 marketplace agent templates (Alex, Evan, Graydon, Guido, Kelsey, Misko, Neil, Swift, Tim)

### Scored Review (v1.3 — CriticalThink fusion)
The reviewer uses a quantitative scoring system fused from the CriticalThink skill:

**Validation Gates** (objective metrics):
| Gate | Examples | What to Capture |
|------|----------|-----------------|
| Type Check | `tsc --noEmit`, `cargo check`, `mypy` | Error count |
| Lint | `eslint`, `clippy`, `ruff` | Warning count |
| Tests | `npm test`, `cargo test`, `pytest` | Pass/fail, coverage % |
| Security | `npm audit`, `cargo audit`, `bandit` | Vulnerability count |

**6 Weighted Dimensions** (scored 0-10):
| Dimension | Weight | Focus |
|-----------|--------|-------|
| Security | 25% | OWASP top 10, auth, data exposure |
| Correctness | 25% | Logic errors, edge cases, null safety |
| Performance | 15% | N+1, memory leaks, unbounded loops |
| Maintainability | 15% | Naming, DRY, size limits |
| Smart Commenting | 10% | Section headers, WHY, purpose, Brain: |
| Data Integrity | 10% | Validation, type safety |

**AI Pitfall Check**: problem evasion, happy path bias, over-engineering, factual accuracy, stale assumptions.

**Iterative Fix Loop**: if score < 8.0, fix CRITICAL issues and re-review (max 3 rounds). Only CRITICAL between rounds, MINOR stay deferred. Score must show IMPROVING trend or loop stops early.

### Phase 4 Activation Logic
The documenter is conditional to avoid overhead on trivial tasks. It activates when any of:
- Bug fix with non-obvious root cause → gotcha/bug entry
- New reusable pattern → pattern entry
- New feature → diary entry (mandatory) + possibly guide
- Architectural decision → decision entry
- Reviewer found something worth recording

It skips for: typo fixes, cosmetic changes, trivial refactors, config tweaks.

## Alternatives Considered

- Embedding review logic directly in coder.md (rejected: code-reviewer droid already exists and is well-tested)
- Making it project-specific (rejected: applies to all projects)
- Always-on documenter (rejected: overhead on trivial tasks, only useful for non-trivial work)
- Documenter as part of coder.md APATR-D "Document" step (rejected: coder's context window is already full of code; separate agent has fresh context and can focus on documentation quality)
- Qualitative-only review without scoring (rejected: CriticalThink showed that objective metrics from lint/test output prevent the reviewer from self-inflating scores)
- CriticalThink as separate skill (rejected: better to fuse scoring+gates into existing code-reviewer than add another phase)
