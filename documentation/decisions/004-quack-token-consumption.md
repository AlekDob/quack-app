---
type: decision
project: codetta
created: 2026-07-15
last_verified: 2026-07-20
tags: [claude-code, harness, tokens, cost, performance, system-prompt]
---

# 004 — Why Quack burns Claude Code sessions faster than the desktop app

## Question (Alek)

Using the Claude Code desktop app consumes the 5-hour/weekly session budget far
slower than using the same account through Quack. What in Quack's harness causes it?

## Verdict

**Root cause: Quack's injected system/editor prompt makes Claude Code run a much
deeper autonomous tool loop per user turn.** Not caching, not the size of the
injected text — the *behavioral* instructions ("read 5+ relevant files before
responding", "Be thorough and substantive") push the model to do many more
tool-call round-trips, and every round-trip re-bills the full ~200k-token context.

## What we measured

### 1. Real transcript history (`~/.claude/projects/*codetta*`)

Classifier: a session is "Quack-launched" if any user message carries a Quack
marker (`[Editor context]`, `You are Jack`, `QUACK EDITOR`); else "bare desktop/CLI".

| Per **user turn** | Quack | Bare desktop/CLI | Δ |
|---|--:|--:|--:|
| API calls / message | **27.7** | **5.4** | ~5× |
| output tok | 16,779 | 5,865 | ~3× |
| cache-create tok | 237,991 | 33,438 | ~7× |
| cache-read tok | 6,098,676 | 1,341,217 | ~4.5× |
| weighted-consumption proxy | ~930k | ~184k | ~5× |

Scagionati (disproven) by the same data:
- **Cache-miss from fresh `-p` spawn**: cache HIT ratio ~96–97% in BOTH.
- **Per-turn context injection size**: `[Editor context]` prefix median ~43 tok,
  present in only ~3% of turns; brain-inject almost never fired.
- Per *single call* Quack was even lighter (mostly Sonnet vs bare's 100% Opus).

Caveat: the two buckets are workload-confounded (78 Quack turns, likely heavier
agentic tasks, vs 1017 bare turns incl. many quick Q&A). So the 5× is direction,
not a controlled number — hence the A/B below.

### 2. Controlled A/B (same task, model=sonnet, permission-mode=acceptEdits, same repo)

Task (fixed): *"How does this project spawn and stream a Claude Code session?
Walk me through the flow from the frontend send path to the Rust backend, citing
the specific files and functions."*

- **A — bare**: task only.
- **B — quack-prompt**: task wrapped in Quack's exact turn-1 payload
  (`jackSystemPrompt(true)` + "You are running inside Quack… Be thorough and
  substantive." + `[Editor context]`/`quackClaudeCodeEditorPrompt()` prefix,
  flattened via `flattenMessages`).
- **C — quack-full**: B + `--effort medium` (Quack's default).

| Arm | API calls | tool calls | cost $ | total input tok | duration |
|---|--:|--:|--:|--:|--:|
| A bare | 24 | 11 (7 Bash, 3 Read, 1 Agent) | 0.46 | 1.04M | 17s |
| B quack-prompt | **42** | **35** (17 LSP, 9 Bash, 8 Read, 1 Agent) | **1.26** | 1.80M | 328s |
| C quack-full (+effort) | 30 | 14 (8 Bash, 5 Read, 1 Agent) | 0.71 | 1.26M | 34s |

**Same question, 1.5–2.7× the cost** just by wrapping it in Quack's prompt.
The wrapper's own token weight (~959 tok on turn 1, ~200 tok/resume turn) is
negligible; the damage is the extra tool loops it induces.

`--effort medium` is NOT the driver (C did *fewer* calls than B — variance).

## Mechanism (verified in code)

Injected on Claude Code turns from `src/components/AIChatPanel.tsx`
(`sendUserText`) + `src/brainPrompt.ts` + `src/ccWirePrompt.ts`:

- `jackSystemPrompt` / `quackAgentCorePrompt` (`brainPrompt.ts`): identity + EFFICIENCY
  (the old "read 5+ / be thorough" mandates were removed — see Fix below).
- turn-1 packaging: `flattenMessages` folds the system block into the first user prompt;
  resumed turns send only the latest user message + optional `[Editor context]` prefix.
- **Static wire block cadence (2026-07-20):** QUACK EDITOR + `[Agent identity]` reinject only
  when `planCcWireRefresh` says so (first wire / agent·Plan change / after `/compact`).
  Meta-slashes (`/compact`, `/clear`, …) send **bare** text — prefix broke those commands.
- spawn flags: `--effort` + `--permission-mode` (`src-tauri/src/claude_code.rs`).

The bare desktop app sends just what the user typed; its own system prompt does
not carry these "read many files / be thorough" directives, so it stops sooner.

## Caveats

- A/B is **n=1 per arm**; agentic runs have high variance (see B vs C). Direction
  is consistent and corroborated by the aggregate transcript data — treat the
  *multiplier* as ~1.5–3×, not a precise constant.
- Both evidence lines are same-account, same-repo, so CLAUDE.md / native CC system
  prompt / repo hooks are held constant.

## Fix applied — per-agent prompt redesign (2026-07-15)

The base prompt shared by ALL presets was the culprit, so the fix is global:

- **New `quackAgentCorePrompt(identity, includeBrain)`** (`src/brainPrompt.ts`)
  replaces `jackSystemPrompt`. Persona-aware (identity from the active preset, so
  Nora speaks as Nora — fixes the old "always You are Jack" incoherence), and lean:
  an **EFFICIENCY** block ("match effort to the task; locate before reading; reuse;
  stop when done") replaces the old "read 5+ files". No thoroughness mandate.
- **Removed** the inside-Quack "Be thorough and substantive" block
  (`AIChatPanel.tsx`); `activeDef` resolved once and reused for identity + the
  role-instructions append.
- **Role behavior stays per-preset** (`src/presets/instructions.ts`): Milo gets a
  Ponytail-style "do less" ladder; Nora a 2-hypothesis bound + failure-path-only
  reads; Vera "diff + touched files only, no repo scan"; Lia "no tools unless
  asked". Jack gets a new **Planner** block (`builtins.ts`) holding the Works/
  Planning guidance moved out of the old base.
- **Effort:** Vera lowered `medium → low` (reviewing a diff needs no high effort).
- Turn-1 wrapper shrank 1005 → 837 tok (~17%), but the real win is behavioral.

### Re-measurement (same task/model/permission as the A/B above)

| Arm | API calls | tool calls | cost $ |
|---|--:|--:|--:|
| A bare | 24 | 11 | 0.46 |
| B old-quack-prompt | 42 | 35 | 1.26 |
| **B2 new-quack-prompt** | **16** | **9** | **0.54** |

**Result: −62% cost and −62% API calls vs the old Quack prompt** ($1.26 → $0.54;
42 → 16 calls), landing at rough parity with the bare CLI (even fewer calls than
bare: 16 vs 24). The harness tax is essentially gone. (n=1, high agentic variance —
but the drop is large and consistent with removing the "read 5+ files / be thorough"
directives.)

## Retrieval evaluation (Pinky Brain vs Graphify) — pilot

Alek asked whether Pinky is actually effective and whether Graphify does better.

**Pinky Brain — NOT an efficiency lever as wired today.** `getBrainInjectEnabled`
defaults to **false** (`brainInject.ts` — the `054` doc claiming "default on" is
stale), so it fired in only ~3% of real turns. It's a *passive* pre-turn inject of
3 doc snippets; it does not stop Claude Code from reading files (the real cost
driver), so at worst it's net-negative. Its `savedTokens` is a **heuristic estimate**
(`brainSavings.ts` assumes each hit avoided a grep+read), not a measurement. Engine
is healthy (80 entries, hybrid e5-small). Keep Pinky for *knowledge* (decisions/
gotchas), fix the default + make it retrieval-first, but do not expect it to cut the
burn.

**Graphify — real but bounded.** Built a cross-language (TS+Rust) symbol graph of
codetta in ~5s (4015 nodes / 12597 edges), fully local (tree-sitter, no API key).
`graphify query/explain` return the exact relevant files/symbols in ONE ~$0 local
call, collapsing the discovery loop. Arm D (bare task + graphify-first) cut API
calls **24 → 17**. Caveats: (1) cost did NOT drop below bare — per-turn cost is
dominated by context size (cacheRead), which retrieval only partly reduces; (2) the
AST graph does **not** cross the Tauri IPC boundary (`invoke` TS ↔ Rust command) —
exactly our cross-stack question needed manual bridging; (3) the parallel build
crashes, must force `parallel=False`. Note: Quack's own `codebase-map` isn't even
generated in this repo and is TS-only.

**Recommendation.** The prompt redesign is the dominant lever (arm B tripled cost);
retrieval is secondary. Bake a provider-agnostic "locate before reading" line into
the core (done). Adopt Graphify as an **opt-in** skill for large/exploration-heavy
work with realistic expectations; don't block on it. Fix Pinky's default/wiring for
knowledge reuse but don't treat it as a burn fix.

Repro scripts: `scratchpad/{analyze_usage,measure_inject,calls_per_turn,build_prompts,build_prompts_v2,parse_ab,build_graph.py}`.
