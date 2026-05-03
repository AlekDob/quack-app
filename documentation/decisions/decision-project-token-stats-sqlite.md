# Decision: Per-Project Token Stats with SQLite

**Date**: 2026-04-24
**Status**: ✅ Implemented
**Author**: Alek (via Agent Jack)

## Context

Quack tracked token usage **per-session** (on `AgentSession` records) but had no way to aggregate consumption per project. Users needed:

1. Lifetime totals per project (input / output / cache-write / cache-read)
2. Breakdown per provider (anthropic / bedrock / legacy / …) and per model
3. Cross-project dashboard in Settings
4. Preservation of totals when sessions are deleted ("deleted sessions" bucket)

Existing persistence is via Tauri Store (JSON files). No SQLite in use before this change.

## Decision

Introduce **SQLite** (`rusqlite 0.31` with `bundled` feature) as a dedicated store for token event aggregation.

**Schema**: single event-log table `token_events` keyed on `(session_id, message_id)` + meta table `project_stats_meta` for migration flags.

Aggregations are computed lazily via `GROUP BY` queries — no denormalized counters to keep in sync.

## Alternatives Considered

| Option | Why rejected |
|--------|--------------|
| **A. Memoized selector on existing `agentSessions`** | Loses data when sessions are deleted; no historical preservation |
| **B. Denormalized counters in Tauri Store JSON** | Risk of drift, O(N) writes on every token event |
| **C. Append-only JSONL** | Workable, but query-time aggregation would scan full log on each read; no proper indexing |
| **D. SQLite (chosen)** | Indexed, idempotent, ACID, scales to millions of rows |

## Architectural Implications

- **New dependency**: `rusqlite 0.31` (+~1–2MB bundle size)
- **Precedent**: This opens SQLite as an option for future features (e.g. analytics, full-text search on conversations). Future SQLite usage should coordinate through a shared connection manager.
- **Cross-platform**: `bundled` feature compiles SQLite from source — no system dependency on any OS.

## Data Model

```sql
CREATE TABLE token_events (
    session_id            TEXT    NOT NULL,   -- Claude SDK session id
    message_id            TEXT    NOT NULL,   -- Anthropic msg_* (or synthetic for result/migration)
    project_path          TEXT    NOT NULL,   -- normalized (forward slashes, no trailing /)
    project_name          TEXT    NOT NULL,
    provider              TEXT    NOT NULL,   -- anthropic | bedrock | legacy | …
    model                 TEXT    NOT NULL,
    input_tokens          INTEGER NOT NULL,   -- per-step, NOT cumulative
    output_tokens         INTEGER NOT NULL,
    cache_creation_tokens INTEGER NOT NULL,
    cache_read_tokens     INTEGER NOT NULL,
    session_deleted       INTEGER NOT NULL DEFAULT 0,   -- flag, preserves totals
    recorded_at           INTEGER NOT NULL,   -- ms epoch
    PRIMARY KEY (session_id, message_id)
);
CREATE INDEX idx_token_events_project ON token_events(project_path);
CREATE INDEX idx_token_events_session ON token_events(session_id);
```

**Idempotency**: `INSERT OR IGNORE` on `(session_id, message_id)` makes duplicate stream events (retries, reconnects, React StrictMode double-fire) harmless.

**Deletion**: flag flip, never row removal. `lifetime = active + deleted`.

## File Layout

| Layer | File |
|-------|------|
| Rust backend | `src-tauri/src/project_stats.rs` |
| Registration | `src-tauri/src/lib.rs` (mod decl, setup init, invoke_handler entries) |
| TS facade | `src/stores/projectStatsStore.ts` |
| Migration | `src/services/projectStatsMigration.ts` |
| Stream hook | `src/hooks/useClaudeChat.ts` (assistant + result branches, ~line 549) |
| Deletion hook | `src/stores/sessionStore.ts` (deleteSession) |
| Per-project UI | `src/components/project-dashboard/TokenStatsView.tsx` + CSS |
| Dashboard integration | `src/components/project-dashboard/ProjectDashboard.tsx` (internal tab switcher) |
| Settings UI | `src/components/settings/categories/TokenUsageSettings.tsx` + CSS |

## Data Location

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/com.quack.terminal/project-stats.db` |
| Windows | `%APPDATA%/com.quack.terminal/project-stats.db` |
| Linux | `~/.local/share/com.quack.terminal/project-stats.db` |

WAL mode enabled (`PRAGMA journal_mode = WAL`) for concurrent read safety.

## Migration from Existing Sessions

On first `loadSessions()` after feature rollout:

1. Check `project_stats_meta['migration_v1_done']`
2. If absent: synthesize one synthetic event per session with aggregated totals
   - `messageId = 'migration-v1-<AgentSession.id>'` (deterministic, avoids collision with real `msg_*`)
   - `provider = 'legacy'`, `model = 'legacy'` — distinguishable in breakdown
3. Set flag to `'1'`

Non-blocking — a migration failure never breaks session loading.

## Tauri Commands

- `record_token_usage({ payload })` — idempotent insert, skips zero-total
- `get_project_stats({ projectPath })` — lifetime + active + deleted + byProvider + byModel
- `get_all_project_stats()` — cross-project summary for global dashboard
- `mark_session_deleted({ sessionId })` — flag flip
- `bulk_import_token_events({ events })` — transactional batch
- `get_stats_migration_flag` / `set_stats_migration_flag` — meta flags

## Non-Goals (Deliberately Excluded)

- **Cost tracking**: explicitly deferred per stakeholder decision (only token counts now; pricing may come later)
- **Periodo filter** (daily/weekly/monthly): v1 shows lifetime only
- **Export CSV/JSON**: v1 is read-only UI

## Testing

- 7 Rust unit tests in `project_stats::tests` cover: path normalization, idempotency, deletion flagging, SQL injection guard on GROUP BY, zero-filter behavior
- All `cargo test --lib project_stats` pass
- Full `cargo check` + `tsc --noEmit` pass

## Known Limitations

1. **Case sensitivity on Windows/macOS**: paths kept as-is; `C:/Foo` and `C:/foo` would be distinct entries. Accepted as low-risk edge case.
2. **Per-step vs cumulative**: we record per-step usage from `assistant` events. Fallback to `result` only when no per-step usage received (idempotency via synthetic `result-<session>-<anchor>` message id).
3. **Pre-migration provider/model unknown**: historical data bucketed as `legacy`. Users can distinguish from fresh post-rollout data.

## Future Work (Not in Scope)

- Cost calculation (requires model pricing table)
- Date-range filters
- Per-session drill-down from breakdown view
- Export to CSV
- Shared SQLite connection manager (if other features adopt SQLite)
