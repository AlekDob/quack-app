---
type: gotcha
project: codetta
created: 2026-07-15
last_verified: 2026-07-15
tags: [claude-code, harness, tokens, cost, system-prompt, performance]
---
# Quack burns CC sessions faster: thoroughness prompts amplify tool loops

## Trigger
When investigating why Quack consumes the Claude Code subscription/session budget
faster than the bare desktop app, or before touching `jackSystemPrompt` /
`quackClaudeCodeEditorPrompt` / the CC send path.

## Finding
Root cause is NOT caching or the size of injected context. It's the **behavioral
instructions** in Quack's injected prompt that make CC run a much deeper tool loop
per user turn, and each round-trip re-bills the full ~200k context.

Culprits (verified in code):
- `src/brainPrompt.ts:21` (`jackSystemPrompt`): "read 5+ relevant files before responding"
- `src/components/AIChatPanel.tsx:3153` (inside-Quack block): "Be thorough and substantive."
- turn-1 packaging: `flattenMessages` in `src/providers/claudeCode.ts:164`
- spawn flags `--effort medium` + `--permission-mode` in `src-tauri/src/claude_code.rs:276`

## Evidence
- Real transcripts (`~/.claude/projects/*codetta*`), Quack-launched vs bare:
  **27.7 vs 5.4 API calls per user turn (~5x)**; cache HIT ~96-97% in BOTH.
- Controlled A/B (same task, model=sonnet, permission=acceptEdits): bare $0.46 / 24
  calls -> quack-prompt $1.26 / 42 calls -> quack+effort $0.71 / 30 calls = **1.5-2.7x**.
- Injected-prefix token weight is negligible (~959 tok turn-1, ~200/resume; median
  real prefix ~43 tok, only 3% of turns). Effort flag is NOT the driver.

## Disproven hypotheses
- "Fresh `-p` spawn causes resume cache-miss" — false, cache hit ~96-97%.
- "Per-turn context injection size is the cost" — false, it's tiny and rare.

## Fix direction (not yet applied)
Soften/remove the "read 5+ files" + "be thorough" directives for the CC orchestrator
prompt; make `--effort` opt-in; re-run the A/B to confirm the multiplier drops.

Full writeup: `documentation/decisions/004-quack-token-consumption.md`.
Repro: `scratchpad/{analyze_usage,measure_inject,calls_per_turn,build_prompts,parse_ab}.mjs`.
