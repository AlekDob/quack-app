---
type: gotcha
project: quack-app
created: 2026-05-18
last_verified: 2026-05-18
tags: [codex, external-cli, versioning, spike, capability-matrix, integration]
---
# Gotcha: pin the external CLI version BEFORE claiming any capability or wiring its schema

## Trigger

Any time you (a) state what an external CLI/tool can or cannot do, (b) write
or change code that parses its output schema, or (c) run a "spike" to verify
behavior. Especially: `codex`, `claude`, `gh`, any vendored binary Quack
spawns from `$PATH`.

## What happened (the expensive incident, 2026-05-17→18)

Two full analysis cycles were built on a **stale binary**:

- `codex` on the dev machine was Homebrew **0.42.0**; the current release was
  **0.130.0** (88 minor versions, breaking schema changes).
- A 2026-05-17 "empirical spike" concluded **"Codex subagents are
  Claude-only, confirmed"** and this was written into the diary, the
  `codex-exec-capability-matrix` research doc, and an addendum to
  `decision-quack-abstraction-agent-level-not-model-level`. **All false** —
  an artifact of the dead 0.42 binary + a misconfigured invocation.
- Worse: the entire Codex M1 backend (`codex_backend.rs`, `events.rs`) was
  wired to 0.42's stream (`--experimental-json`, `session.created`,
  `item_type`, rollout-JSONL usage tail) and was **completely broken on
  0.130** (`--json`, `thread.started`/`thread_id`, `item.type`,
  `agent_message`, in-stream `turn.completed.usage`, stdin must be closed).
  It "worked in the GUI" only because the user's binary was also stale.

A single `codex --version` at the start would have prevented all of it.

## Rule

1. **First command of any external-CLI task: `which <bin> && <bin> --version`.**
   Record the exact version in the spike/diary/research note.
2. **Every capability statement is version-scoped.** Write "verified on
   codex-cli 0.130.0", never "Codex does X". A capability matrix without a
   version pin is misinformation waiting to happen.
3. **Check stale-ness explicitly.** Homebrew formulae lag npm/upstream badly
   (codex brew was 88 minors behind). Compare installed vs latest before
   trusting either docs or a spike.
4. **Schema-parsing code must carry the verified version inline** and
   regenerate RAW fixtures from a live run on that version (see
   `src-tauri/src/agents/fixtures/` — captured live from 0.130).
5. **Retract loudly, don't soften.** A wrong "verified" Brain fact is
   actively harmful; correct it with a dated RETRACTION banner (done in
   `codex-exec-capability-matrix.md`), never a quiet edit.

## Reference

- `documentation/research/codex-exec-capability-matrix.md` (version-pinned,
  retraction banner)
- `documentation/decisions/decision-quack-abstraction-agent-level-not-model-level.md`
  (rectified addendum)
- `documentation/diary/2026-05-18.md` [10:05] (full incident)
- Code: `src-tauri/src/agents/{events,codex_backend}.rs` carry inline 0.130
  schema notes; `src-tauri/src/agents/fixtures/` RAW from live 0.130.

## Brain breadcrumb

Code that spawns or parses an external CLI carries
`// Brain: gotcha-external-cli-version-pin` near the version-sensitive logic.
