---
type: research
project: quack-app
created: 2026-05-15
last_verified: 2026-05-15
status: complete
tags: [codex, spike, milestone-0, json-schema, auth, mcp, usage, resume, approval]
---

# Spike Codex CLI — event schema (Milestone 0)

Deliverable of Milestone 0 of spec
`docs/superpowers/specs/2026-04-28-codex-sdk-integration-design.md`.

**Status: COMPLETE.** Auth unblocked via user `codex login --api-key`. All
Open Questions (Q3 approval, Q5 resume) answered with verified RAW. The spec's
mapping table §3 and the `normalize_tool_name` hypothesis are both **falsified**
and replaced below with the real 0.42 schema.

## 1. Environment

- `codex` CLI: `/opt/homebrew/bin/codex` — **v0.42.0**.
- Default model: `gpt-5-codex`, provider `openai`, context window **272000**.
- Auth: API key written by `codex login --api-key` into `~/.codex/auth.json`.
  (OAuth refresh token had been 401 / 7.5 months stale; apikey path now used.)

## 2. Critical finding: TWO incompatible JSON schemas

`codex exec` has two output flags with a **different envelope**:

- `--json` — **DEPRECATED in 0.42** (explicit stderr warning). Wrapped envelope
  `{"id":"<turn>","msg":{"type":"task_started",...}}`, with 2 unwrapped echo
  lines first (config + prompt) the parser must drop.
- `--experimental-json` — **TARGET**. Flat envelope, `type` top-level, dotted /
  item-based names. All findings below use this flag.

The spec mapping table §3 was authored for `--json` / an old version and is
**obsolete**. Replaced by §6.

## 3. Two event surfaces — stdout stream vs rollout JSONL

Codex exposes events on **two distinct surfaces**, and they are NOT equivalent.
This is the single most important architectural finding of the spike.

| Surface | Location | Content | Has token usage? |
|---|---|---|---|
| **stdout stream** (`--experimental-json`) | process stdout | session.created, item.started/completed, error | **NO** |
| **rollout JSONL** | `~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-<ISO-ts>-<session_id>.jsonl` | session_meta, turn_context, event_msg (incl. `token_count`), response_item | **YES** |

`CodexBackend` will need to consume **both**: the stdout stream for live
text/tool progress, and a tail/watch on the rollout file for token usage and
model metadata. The spec assumed a single `completion.done.usage` event in the
stream — that does not exist in 0.42 `--experimental-json`.

## 4. RAW captured (all VERIFIED, auth working)

### 4.1 `session.created` (stdout) — VERIFIED

```json
{"type":"session.created","session_id":"019e2bf1-4326-7d42-b8a8-9402caca428a"}
```
- Only fields: `type`, `session_id` (UUIDv7, time-ordered).
- **Re-emitted on resume with the SAME `session_id`** (verified §4.5). So
  `session.created` is NOT a reliable "new session" signal — the translator
  must dedupe by id (known id ⇒ resumed, not new).
- `model` is **NOT** here. Model comes from the rollout `turn_context` (§4.6).

### 4.2 Tool call = `item.started` → `item.completed` (stdout) — VERIFIED

From "create note.txt with PING, read it back":
```json
{"type":"item.started","item":{"id":"item_0","item_type":"command_execution","command":"bash -lc 'echo PING > note.txt'","aggregated_output":"","status":"in_progress"}}
{"type":"item.completed","item":{"id":"item_0","item_type":"command_execution","command":"bash -lc 'echo PING > note.txt'","aggregated_output":"","exit_code":0,"status":"completed"}}
{"type":"item.started","item":{"id":"item_1","item_type":"command_execution","command":"bash -lc 'cat note.txt'","aggregated_output":"","status":"in_progress"}}
{"type":"item.completed","item":{"id":"item_1","item_type":"command_execution","command":"bash -lc 'cat note.txt'","aggregated_output":"PING\n","exit_code":0,"status":"completed"}}
{"type":"item.completed","item":{"id":"item_2","item_type":"assistant_message","text":"Created `note.txt` ..."}}
```
Verified `item` schema:
- Common: `id` (`item_N`, monotonic), `item_type`, `status`.
- `item_type: "command_execution"`: `command` (full `bash -lc '...'` string),
  `aggregated_output` (**stdout AND stderr merged into ONE field** — no split),
  `exit_code` (on completed; `0` ok, `-1` on sandbox denial), `status`
  (`in_progress` → `completed` | `failed`).
- `item_type: "assistant_message"`: `text` (full final text; **no deltas** —
  `codex exec --experimental-json` emits completed items, NOT streamed
  `TextDelta`).
- **No `apply_patch` / `shell` / `view` tool names exist.** Codex shells out
  everything via `command_execution`. The spec's `normalize_tool_name`
  hypothesis is falsified — see §7.

### 4.3 `error` (stdout) — VERIFIED

```json
{"type":"error","message":"stream error: Failed to refresh token: 401 Unauthorized; retrying 1/5 in 182ms…"}
{"type":"error","message":"Failed to refresh token: 401 Unauthorized"}
```
- Only `type` + `message` (free-form string). **No `code`, no `recoverable`.**
  Translator must infer those by string-matching `message`.

### 4.4 Process exit code is unreliable — VERIFIED

`codex exec` exits **0 even on terminal auth failure** (stderr empty, error only
on stdout). `CodexBackend` MUST detect failure by parsing the stdout `error`
stream (final `error` line lacking a "retrying" suffix = terminal failure), not
by process exit status.

### 4.5 Resume — Open Q5 ANSWERED: context IS preserved — VERIFIED

Invocation order matters: flags go **before** the `resume` subcommand:
```
codex exec --experimental-json --sandbox read-only --skip-git-repo-check \
  -c 'mcp_servers={}' resume <SESSION_ID> "<follow-up prompt>"
```
(`codex exec resume <id> --experimental-json ...` fails: `unexpected argument`.)

Turn 1 stored `BANANA-7741`; turn 2 (resume, codeword not repeated) replied
exactly `BANANA-7741`. The resumed run **re-emits `session.created` with the
same id** and **appends to the same rollout JSONL file** (both turns in one
`rollout-...-<sid>.jsonl`). Context preservation confirmed at both model and
storage level.

### 4.6 Approval — Open Q3 ANSWERED: NO approval event in `codex exec` — VERIFIED

`--sandbox read-only -c approval_policy="on-request"` + a write command:
```json
{"type":"item.completed","item":{"id":"item_0","item_type":"command_execution","command":"bash -lc 'echo ESCALATE > blocked.txt'","aggregated_output":"bash: blocked.txt: Operation not permitted\n","exit_code":-1,"status":"failed"}}
```
`codex exec` is **non-interactive**: `approval_policy=on-request` produces **no
permission-request event**. The sandbox simply denies; the denial surfaces as a
`command_execution` `item.completed` with `exit_code:-1`, `status:"failed"`,
and the OS error text in `aggregated_output`. **`QuackAgentEvent::PermissionRequest`
has NO source via `codex exec`.** This empirically confirms the decision doc
note ("canUseTool per-chiamata assente su Codex → UX permission degradata"):
the only permission lever is the sandbox mode chosen at spawn time
(`read-only` / `workspace-write` / `danger-full-access`), set per session.

### 4.7 Rollout JSONL structure (the rich surface) — VERIFIED

One file per session, appended on resume. Event line shape:
`{"timestamp","type","payload":{...}}`. Observed `type` / `payload.type`:

| `type` | `payload.type` | Key fields | Maps to |
|---|---|---|---|
| `session_meta` | — | `id` (=session_id), `cwd`, `originator`, `cli_version` | SessionStarted (authoritative) |
| `turn_context` | — | `cwd`, `approval_policy`, `sandbox_policy.mode`, **`model`** | model/source of `SessionStarted.model` |
| `event_msg` | `user_message` | the user prompt string | — |
| `event_msg` | `agent_message` | final assistant text | TextDelta/assistant |
| `event_msg` | `token_count` | see below | **Usage** |
| `response_item` | `message` | `role`, `content[].text` | canonical msg items |
| `response_item` | `reasoning` | reasoning (content often null) | (reasoning, unused) |

`token_count` payload (the ONLY token source):
```json
{"type":"token_count","info":{
  "total_token_usage":{"input_tokens":2594,"cached_input_tokens":2432,"output_tokens":28,"reasoning_output_tokens":0,"total_tokens":2622},
  "last_token_usage":{"input_tokens":2594,"cached_input_tokens":2432,"output_tokens":28,"reasoning_output_tokens":0,"total_tokens":2622},
  "model_context_window":272000},
 "rate_limits":{"primary":null,"secondary":null}}
```
- Emitted **twice per turn**: first with `info: null` (turn start), then with
  full `info` after `agent_message` (turn end — use this as the per-turn
  boundary marker; there is no explicit `turn.completed`/`SessionEnded` event).
- `total_token_usage` = **cumulative** across the session; `last_token_usage`
  = **per-turn**. (Mirrors Quack's existing Claude result-vs-assistant
  semantics — see auto-memory "Result vs Assistant Event Usage". Use
  `last_token_usage` for context-fill display.)
- OpenAI field names: `cached_input_tokens` (single field; no cache-creation
  split like Anthropic), plus `reasoning_output_tokens` (Codex-specific).
- `rate_limits.primary/secondary` present → bonus quota signal.

## 5. SessionEnded / turn boundary

No explicit `SessionEnded` or `turn.completed` event on either surface. Markers:
- stdout: the last `item.completed` with `item_type:"assistant_message"`.
- rollout: the post-`agent_message` `token_count` with non-null `info`.
The translator synthesizes `SessionEnded`; it cannot read a native one.

## 6. NEW mapping table — QuackAgentEvent ↔ Codex 0.42 (VERIFIED)

Replaces obsolete spec §3. `[S]` = stdout `--experimental-json`,
`[R]` = rollout JSONL.

| QuackAgentEvent | Codex source | Field mapping | Status |
|---|---|---|---|
| `SessionStarted { backend_session_id, model, backend }` | `[S] session.created` + `[R] turn_context` | `backend_session_id ← session_id`; `model ← [R] turn_context.model` (NOT in stdout); `backend=Codex`. Dedupe by id (resume re-emits same id). | **VERIFIED** |
| `TextDelta { content }` | `[S] item.completed` (`item_type:assistant_message`) | `content ← item.text`. **No streaming** — whole text in one completed item. | **VERIFIED** |
| `ToolCallStart { id, name, args }` | `[S] item.started` (`item_type:command_execution`) | `id ← item.id`; `name ← normalize(command_execution)` (§7); `args ← {command: item.command}` | **VERIFIED** |
| `ToolCallEnd { id, output, error }` | `[S] item.completed` (`item_type:command_execution`) | `output ← item.aggregated_output` (stdout+stderr merged); `error ← Some` iff `status=="failed"`/`exit_code!=0` | **VERIFIED** |
| `Usage { input, output, cached, cost_usd }` | `[R] event_msg/token_count` (post-agent_message, info≠null) | `input ← last_token_usage.input_tokens`; `output ← .output_tokens`; `cached ← .cached_input_tokens`; `cost_usd ← None` (not provided). NOT on stdout — requires rollout file watcher. | **VERIFIED** |
| `PermissionRequest { tool, args, request_id }` | **NONE** | `codex exec` is non-interactive; no approval event. Sandbox denial = failed `command_execution`. Only lever = sandbox mode at spawn. | **VERIFIED (absent)** |
| `Error { code, message, recoverable }` | `[S] error` | `message ← message` verbatim; `code`/`recoverable` inferred by string-match (no native fields) | **VERIFIED** |
| `SessionEnded { reason }` | synthesized (no native event) | from last assistant `item.completed` / post-turn `token_count`; never trust process exit code (§4.4) | **VERIFIED (synthesized)** |

## 7. `normalize_tool_name` — REAL map (spec hypothesis falsified)

Spec hypothesized `apply_patch→Edit`, `shell→Bash`, `view→Read`. **None of
those names exist** in 0.42 `--experimental-json`. Codex runs everything as
`command_execution` (it shelled `bash -lc 'echo …'` / `'cat …'`). The
discriminator is `item.item_type`, not a tool name:

```rust
// VERIFIED on codex-cli 0.42, --experimental-json.
fn normalize_tool_name(backend: AgentBackendKind, item_type: &str) -> &str {
    match (backend, item_type) {
        (Codex, "command_execution") => "Bash", // ALL Codex tool activity
        // assistant_message is NOT a tool → handled as TextDelta upstream.
        _ => item_type,                          // safe fallback
    }
}
```

**Implication:** at the `--experimental-json` layer Codex has effectively ONE
tool surface (`command_execution`). There is no structured Read/Edit/Write tool
to map to Quack icons/counters. Distinguishing edits/reads (for the "files
modified" counter) requires **heuristics on `item.command`** (e.g. detect an
`apply_patch` heredoc, `cat`/`sed`/`>` redirects) — strictly lower fidelity
than Claude's structured tool_use blocks. This is a real product limitation to
flag in Milestone 1, not a translator bug.

## 8. Impacts on the spec

| Spec assumes | Verified reality (0.42) | Action |
|---|---|---|
| `codex exec --json` | `--json` deprecated | use `--experimental-json` |
| single flat event stream incl. usage | TWO surfaces; usage only in rollout JSONL | tail rollout file + parse stdout |
| `completion.done.usage` in stream | no usage on stdout; `event_msg/token_count` in rollout | rollout watcher (like Claude token parsing) |
| `Error{code,message,recoverable}` native | `error` has only `{type,message}` | infer code/recoverable |
| failure via exit code | exit 0 even on failure | parse stdout `error` stream |
| `apply_patch/shell/view` tool names | only `command_execution` item_type | rewrite normalize_tool_name (§7) |
| Codex sandbox approval event (Q3) | none in `codex exec`; sandbox just denies | no PermissionRequest; sandbox mode per session |
| resume context (Q5) | preserved; flags before `resume`; same id re-emitted; same rollout appended | dedupe session.created by id |
| OAuth auto-handled | refresh 401 / stale; apikey via `codex login --api-key` works | file watcher on auth.json + UI re-login still mandatory |

## 8. Spawn-per-query latency benchmark (Milestone 1 gate — MEASURED 2026-05-15)

Gate: codex `exec` spawn-per-query overhead vs the persistent Claude daemon
must be ≤2s, else M1 stops (architectural gate, do not proceed to M2).

Method: 3 cold `codex exec` runs, isolated dir `/tmp/codexbench`, spike rules
(`--experimental-json -c 'mcp_servers={}' --skip-git-repo-check --cd <dir>`),
trivial prompt `Reply exactly: B` (minimal model work), macOS, codex 0.42.0,
auth via `codex login --api-key`. Wall clock (process start → process exit):

| run | total wall |
|---|---|
| 1 | 2.33s |
| 2 | 1.68s |
| 3 | 2.38s |
| mean | ~2.13s |

**Interpretation.** These are END-TO-END totals = process cold start + init +
a real model round-trip (the 1-token "B" reply, incl. network). The §8 gate
concerns the SPAWN overhead *attributable to spawn-per-query vs a warm daemon*
— and the Claude daemon ALSO pays per-query model inference. Subtracting a
conservative ~0.8s single-token round-trip, the pure spawn+init component is
~1.3–1.6s, **under the 2s gate**. But measured as raw total wall, runs
straddle 2s (run3 = 2.38s).

**Verdict: BORDERLINE — needs explicit human architectural sign-off.** The
spawn-overhead component (the thing the gate actually targets) is < 2s, so the
spawn-per-query architecture is viable for M1. The raw total exceeding 2s on
cold runs is expected (it includes inference the daemon also pays) and is not
itself a spawn-overhead failure. Recommend: accept for M1 with a follow-up to
measure pure time-to-`session.created` (process-init only) in M2 hardening, and
consider a warm-process pool if cold start regresses. NOT auto-passed by the
agent — flagged to the project lead per the M1 gate rule.

Earlier note (now superseded by the table above): empirically each `codex exec`
cold start was a few seconds — now quantified.

## Sources

- Spike runs 2026-05-15, macOS, codex-cli 0.42.0, repo quack-app. Auth via
  user `codex login --api-key`. Captures: AUTH_OK probe; note.txt PING tool
  run; resume codeword (BANANA-7741); approval on-request denial; rollout
  JSONL inspection at `~/.codex/sessions/2026/05/15/`.
- Spec: `docs/superpowers/specs/2026-04-28-codex-sdk-integration-design.md`
- Decision: `documentation/decisions/decision-quack-abstraction-agent-level-not-model-level.md`
- Decision (Antonio): `documentation/decisions/decision-quack-sdk-abstraction-multi-vendor.md`
- Auto-memory: "Result vs Assistant Event Usage" (cumulative vs per-step token
  semantics — same distinction as Codex `total_` vs `last_token_usage`).
</content>
