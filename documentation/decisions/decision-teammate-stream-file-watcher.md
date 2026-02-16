---
type: decision
created: 2026-02-11
tags: [teammate, streaming, file-watcher, architecture]
---

# Decision: Teammate Stream via JSONL File Watching

## Context

When a Claude Agent SDK teammate is spawned, users see only a "Working on task..." widget with no visibility into what the teammate is doing. All visible tool calls belong to the team lead (parent session). Users need a way to "drill down" into teammate activity.

## Options Considered

1. **SDK stdout parsing** — Parse the parent process stdout for teammate events
   - Rejected: Teammate sessions are internal subprocesses; their events do NOT appear in parent stdout

2. **SDK API modification** — Modify Claude Agent SDK to expose teammate streams
   - Rejected: External dependency, high risk, maintenance burden

3. **JSONL file watching** (chosen) — Watch `~/.claude/projects/{project}/{sessionId}.jsonl` files
   - The SDK already writes these logs for every session
   - `notify` crate already available (used by git_watcher.rs and kanban_watcher.rs)
   - Real-time via 200ms debounced file watcher
   - No SDK modifications required

## Decision

Use JSONL file watching with the `notify` crate. Parse as `serde_json::Value` to avoid schema coupling with the SDK's internal event format.

## Consequences

- Feature works without any SDK changes (biggest win)
- ~200ms latency between teammate action and UI update
- Byte position tracking avoids re-parsing on each file change
- Must handle case where JSONL file doesn't exist yet at teammate start
- Adding new event types in the SDK requires no backend changes (Value parsing)
