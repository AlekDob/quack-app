---
type: gotcha
project: codetta
created: 2026-07-15
last_verified: 2026-07-15
tags: [claude-code, harness, tokens, cost, system-prompt, presets, graphify, pinky, fixed]
---
# Quack CC session burn: thoroughness prompts amplify tool loops (FIXED)

## Trigger
When investigating Quack's Claude Code token/session consumption, or before
touching the agent prompt system (`quackAgentCorePrompt`, preset instructions,
the CC send path in `AIChatPanel.sendUserText`).

## Finding (root cause)
Not caching, not injected-context size. The **behavioral** directives in Quack's
base prompt made CC run a much deeper tool loop per user turn; each round-trip
re-bills the full ~200k context. Culprits: `jackSystemPrompt` "read 5+ relevant
files before responding" + the inside-Quack "Be thorough and substantive." block.

## Evidence
- Real transcripts (Quack vs bare desktop): **27.7 vs 5.4 API calls per user turn
  (~5x)**; cache hit ~96-97% in BOTH.
- Controlled A/B (same task, sonnet, acceptEdits): bare $0.46/24 calls vs old-quack
  $1.26/42 calls = harness prompt **tripled** cost.

## Fix (applied 2026-07-15)
Per-agent prompt redesign — the base is shared by ALL presets, so fix it globally:
- New **`quackAgentCorePrompt(identity, includeBrain)`** in `src/brainPrompt.ts`
  replaces `jackSystemPrompt`. Persona-aware (identity from active preset — Nora
  speaks as Nora, fixing the old always-"You are Jack" bug) + a lean EFFICIENCY
  block ("match effort; locate before reading; reuse; stop when done"). No
  thoroughness mandate.
- Removed the "Be thorough and substantive" block in `AIChatPanel.tsx`.
- Role behavior per-preset (`src/presets/instructions.ts`): Milo = Ponytail "do
  less" ladder; Nora = 2-hypothesis bound; Vera = diff-only; Lia = no tools unless
  asked. Jack = new Planner block (`builtins.ts`). Vera effort medium->low.
- **Re-measured: $1.26/42 calls -> $0.54/16 calls (-62%)**, ~parity with bare CLI.

## Retrieval (Pinky vs Graphify) — evaluated
- **Pinky is NOT an efficiency lever as wired**: default OFF (`getBrainInjectEnabled`
  returns false; `054` doc saying "default on" is stale), passive inject, and
  `savedTokens` is a heuristic (`brainSavings.ts`). Keep it for knowledge reuse
  (decisions/gotchas), not for the burn.
- **Graphify** (github.com/safishamsi/graphify): cross-language TS+Rust symbol graph,
  local tree-sitter, ~5s build. `query/explain` collapse discovery to ~$0; arm D cut
  24->17 calls. Caveats: doesn't cross Tauri IPC boundary; parallel build crashes
  (use parallel=False); cost still dominated by context size. Adopt opt-in.

Full writeup: `documentation/decisions/004-quack-token-consumption.md`.
