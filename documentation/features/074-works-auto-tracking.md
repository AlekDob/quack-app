---
type: feature-doc
project: codetta
created: 2026-07-15
last_verified: 2026-07-15
tags: [works, claude-code, tokens, efficiency, prompt-injection, agents]
---

# 074 — Works auto-tracking (agent-maintained, token-efficient)

Agents keep Works current so the user files nothing by hand: associate the chat
to an existing story/work, create one when scope warrants, and maintain state —
all via end-of-turn directives Quack applies. The story body is written as an
**agent memory card** (scope / entry points / decisions / acceptance) so the next
session Reads it instead of re-exploring. Pairs with the prompt redesign in
`decisions/004` (which removed the "read 5+ files" pressure that overrode Works).

## Pieces

| Concern | Where |
|---|---|
| Directive parse + apply (link/create/update) | `src/worksAgentDirectives.ts` |
| Efficiency story-body template | `buildEfficiencyBody` (same file) |
| Open-items index (associate hint) | `formatOpenItemsIndex` (same file) |
| Manifest full-once / pointer-after gate | `src/worksManifestGate.ts` (`manifestForTurn`) |
| Manifest `pointer` + "Files in scope" section | `src/worksTurnContext.ts` |
| Flywheel scope from edits (read-only) | `collectStoryScopeFiles` (`AIChatPanel.tsx`) |
| Protocol injected into the CC prompt | `quackClaudeCodeEditorPrompt(worksEnabled)` (`brainPrompt.ts`) |
| Turn-end apply effect + toasts | `AIChatPanel.tsx` (`lastWorksTextRef`/`lastWorksChatRef`) |
| Create / update / link APIs (reused) | `worksCache.ts`, `quackPlanHarness.ts` |

## Directives (agent emits at end of turn)

| Directive | Effect |
|---|---|
| `[Works link] S-014` / `W-007` | Link chat to existing story/work |
| `[Works new-story]` … `[/Works new-story]` | Create story (fields → memory card) + link |
| `[Works new-work]` (needs `story: S-NNN`) | Create work under a story + link |
| `[Works update] S-014` … `[/Works update]` | `status:` / `scope+:` / `acceptance-done:` |

Fields for create: `title`, `scope` (files), `entry` (symbol→path:line),
`decisions`, `acceptance` (`;`-separated). **No delete via directives.**

## Injection economics (decisions/004)

| Turn state | What rides ccTurnContext |
|---|---|
| Linked, first-seen/changed manifest | Full manifest (scope + refs + pending + flywheel files) |
| Linked, unchanged | 1-line pointer `[Works S-014 · scope: … · N pending]` |
| Unlinked, Works on | Open-stories index **once** (gated), + optional Pinky hit |
| Works off | Nothing Works-related |

## Gotchas

- **Baseline per chat** (`lastWorksChatRef`): on chat switch/reload the apply
  effect adopts the current tail as baseline and does NOT re-apply directives
  already in history — otherwise reload duplicates stories.
- Manifest gate keys on block **content**, so a changed manifest (e.g. flywheel
  learned a new file) re-sends full once, then reverts to the pointer.
- `StoryStatus` is only `draft | active | done` (no `in_progress`/`archived`).
- Flywheel is **read-only** — scope is derived from linked-session edits
  (`summarizeEdits`), never written back to `.md` (no silent mutation / disk churn).

## Related

- `decisions/004-quack-token-consumption.md` — the prompt redesign + A/B + why.
- `054-works-layer.md`, `066-works-cycles-stories.md`, `068-quack-plan-harness.md`.
- `049-markdown-renderer.md` (manifest surfaces), `037-project-context-dock.md`.
