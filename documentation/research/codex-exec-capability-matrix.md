---
type: research
project: quack-app
created: 2026-05-17
last_verified: 2026-05-18
status: complete
tags: [codex, exec, skills, subagents, slash-commands, agents-md, capability-gate, parity, codex-0130]
---
# Codex `exec` capability matrix (codex-cli 0.130)

> **RETRACTION (2026-05-18).** The 2026-05-17 version of this file claimed
> "subagents are absent in `codex exec`, empirically confirmed". **That was
> wrong.** It was tested on a Homebrew-stale `codex 0.42.0` (latest was
> 0.130.0) with a misconfigured spike. Re-verified live on **codex-cli
> 0.130.0** (2026-05-18): **subagents WORK in `codex exec`.** All rows below
> are the corrected, version-pinned truth.

## Why this exists

Before wiring any Claude-harness feature (skills, slash commands, subagents,
personality) for a Codex session, know what `codex exec --json` (the mode
Quack spawns, `codex_backend.rs`) actually honors. Codex moves fast and
breaks schema across versions — **always pin the codex version** when stating
a capability. Triggers: "skills on Codex", "slash command for Codex",
"Codex subagent/team", "AGENTS.md", "Codex parity", "stessa UX su Codex".

## Matrix — verified live on codex-cli 0.130.0 (2026-05-18)

| Capability | `codex exec --json` 0.130 | Evidence |
|---|---|---|
| **AGENTS.md** persona | ✅ read natively from `--cd` root (version-independent) | doc + M1.5 personality→AGENTS.md |
| **Slash commands** native | ❌ not in `exec` (openai/codex#3641) — Quack composes them client-side anyway (`codexPromptComposer`), so Codex sessions get working commands the native CLI lacks | unchanged |
| **Skills** — local `.agents/skills` | ❌ no native discovery; Codex just `cat`s the SKILL.md as a plain file | `fixtures/codex_skill_discovery.jsonl` |
| **Skills** — MCP resources | 🟡 0.130 exposes skills as MCP resources (`list_mcp_resources` → `posthog://skills/...`). Quack's `-c mcp_servers={}` does NOT fully suppress them. | same fixture |
| **Subagents** | ✅ **WORKS** via `~/.codex/agents/` or `.codex/agents/<name>.toml` → stream items `collab_tool_call` (`spawn_agent`, `wait`), child threads, child message returned | `fixtures/codex_subagent.jsonl` (21+21→"42") |

## codex 0.42 → 0.130: the breaking changes (M1 was pinned to 0.42)

M1 was built/tested on the user's stale brew `codex 0.42`. On current Codex it
was fully broken until the 2026-05-18 re-target:

| Area | 0.42 (old M1) | 0.130 (current, re-targeted) |
|---|---|---|
| Flag | `--experimental-json` | **`--json`** (`--experimental-json` removed) |
| stdin | not closed (worked on 0.42) | **must close stdin** (`Stdio::null()`) or `exec` blocks on "Reading additional input from stdin…" |
| Session id | `session.created` / `session_id` | `thread.started` / **`thread_id`** |
| Items | `item_type`, `assistant_message` | **`item.type`**, **`agent_message`**, new `turn.started`/`turn.completed`, `collab_tool_call`, `mcp_tool_call` |
| Usage | rollout-JSONL tail (2 surfaces) | **in-stream** `turn.completed.usage` `{input_tokens, cached_input_tokens, output_tokens, reasoning_output_tokens}` → rollout architecture deleted |
| `--full-auto` | valid | deprecated → use `--sandbox workspace-write` |
| MCP isolation | `-c mcp_servers={}` isolated | no longer fully isolates (posthog MCP resources still surface) |

Re-target landed in `events.rs` (`codex_stream_to_quack` + `codex_tool_identity`
+ `codex_aux_tool_output`, TDD on the 3 RAW 0.130 fixtures) and
`codex_backend.rs` (`--json`, `Stdio::null()`, `thread_id`, rollout removed,
`codex_auth_probe` fixed). `QuackAgentEvent` contract UNCHANGED → zero TS
churn, Claude arm byte-identical (claude_event_tests green).

## Consequences for Quack (agent-level abstraction)

Per `decision-quack-abstraction-agent-level-not-model-level`: gate, don't
reimplement. Updated stance with 0.130 facts:

- **Personality → AGENTS.md**: keep (version-independent). ✅
- **Slash commands**: keep `codexPromptComposer` client-side expansion —
  superior to native (#3641 still open). ✅
- **Skills**: keep the `<available-skills>` index injection for selected
  skills; no native local discovery in exec. Open question for M2: lean into
  the **MCP-resource** skill channel 0.130 exposes.
- **Subagents/team**: **NO LONGER a hard Claude-only gate.** Codex 0.130 has
  native subagents (`collab_tool_call`). Whether to surface Quack team/parallel
  UX on Codex is now a *product* decision, not an impossibility. M1 surfaces
  collab/mcp items as tool calls (additive); deeper team integration = M2.

## Pinned-version discipline (load-bearing)

`codex_backend.rs` spawns bare `codex` from PATH — capability depends on the
user's installed version. Never state a Codex capability without the version.
M2 should add a codex-version probe + minimum-version guard, because 0.42→0.130
proved the schema is not stable across the gap.

## Sources

- Live spikes 2026-05-18, codex-cli 0.130.0 (3 RAW fixtures in `src-tauri/src/agents/fixtures/`)
- https://developers.openai.com/codex/subagents · /codex/skills · /codex/config-reference
- https://github.com/openai/codex/issues/3641 (slash commands not in exec)
- Brain: `decision-quack-abstraction-agent-level-not-model-level`,
  `pattern-backend-capability-gated-ui`, `features/066-codex-backend-multi-agent.md`

## Brain breadcrumb

`src-tauri/src/agents/events.rs` + `codex_backend.rs` carry the 0.130 schema
notes inline. This file is the authoritative capability reference — update
`last_verified` + the version pin on every codex bump.
