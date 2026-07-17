---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), plain CSS
created: 2026-07-11
last_verified: 2026-07-17
tags: [claude-code, model-selector, model-catalog, composer, rust, performance, lazy-load]
---

## Claude Code dynamic model catalog
**Purpose:** Probe live version names from the CLI (`Sonnet 5`, `Opus 4.8`, `Fable 5`) into the Rust catalog while keeping the picker **instant** — one fast `/model` probe, version labels refreshed in background (1h cache). **UI chip/picker use stable Title Case aliases** (`Sonnet`) via `ccStableDisplayName` — probed names are not shown in the composer (Codetta-style; see `071` revert).
**Stack:** Rust `claude_models.rs` + `claude_print_text` helper; TS `claudeCode.ts` stale-while-revalidate; shared discovery store (`031`).

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Rust | `src-tauri/src/claude_models.rs` | `claude_code_list_models` — parse `/model`, probe labels, dedupe |
| Rust | `src-tauri/src/claude_code.rs` | `claude_print_text(prompt)` — shared `-p` text helper for probes |
| Provider | `src/providers/claudeCode.ts` | `claudeCodePickerModels()`, `refreshClaudeCodeModelsLive()`, `ccStableDisplayName`, `FALLBACK_MODELS` |
| Store | `src/modelDiscoveryStore.ts` | `listFastModels` + merge CC live list (`ccCliInflight`) |
| Picker | `src/components/ModelPickerPopover.tsx` | Chip via `modelLabel` → `displayName`; instant hydrate skeleton |
| Config | `src/App.css` | `.model-picker-pop.is-hydrating` |

### Tauri command
| Command | Role |
|---|---|
| `claude_code_list_models` | One `claude -p "/model"` → `{ id, display_name, is_default }[]` |

### Data flow
**Cold / instant:** `listFastModels()` → `claudeCodePickerModels()` (no CLI spawn) → picker shows Default + Sonnet/Opus/Haiku/Fable fallbacks immediately

**Popover open:** `refreshClaudeCodeModelsLive()` → `claude_code_list_models` (foreground, ~1s) → merge into discovery cache → notify all panels

**Background labels:** Rust spawns parallel `/model {alias}` probes per alias → `LABEL_CACHE` (1h TTL) → next list call uses Sonnet 5 / Opus 4.8 / … without blocking the picker

**Stale-while-revalidate:** if in-memory cache is warm but TTL expired, return cached rows immediately and refresh in background (`fetchAndCacheModels` fire-and-forget)

### Display rules
| Rule | Layer | Why |
|---|---|---|
| `display_label()` prefers probed name when `is_sane_probe_label` | Rust CLI list | Rejects junk like "plan mode" from bad probes |
| `[1m]` aliases append `(1M context)` when probe omits it | Rust | e.g. `Fable 5 (1M context)` not duplicate "Fable 5" rows |
| `dedupe_display_names()` collapses same display name | Rust | `best` alias sometimes resolves to same label as `fable` |
| `PICKER_ORDER` | Rust | default → sonnet → opus → haiku → fable → best → `[1m]` variants → opusplan |
| Default row | Rust → TS passthrough | `Default · {current short name}` when CLI reports current model |
| **UI `displayName`** | TS `ccStableDisplayName` | Non-default rows → Title Case alias (`Sonnet`), **ignore** probed version — `071` |

### Key functions
- `claude_print_text(prompt) → String` — `-p` stdout for `/model` and per-alias probes
- `parse_available_aliases(catalog) → Vec<String>` — strip "or a full model id" tail
- `probe_alias_labels(available) → HashMap` — parallel thread-per-alias background refresh
- `claudeCodePickerModels() → ProviderModel[]` — zero-spawn instant slice for discovery
- `refreshClaudeCodeModelsLive(force?) → ProviderModel[]` — full catalog + SWR
- `ccStableDisplayName(id, fromCli, isDefault) → string` — UI label (see `071`)

### State
- `LABEL_CACHE`: in-process 1h map alias → probed display name (Rust)
- `modelsCache`: TS 60s TTL in `claudeCode.ts`
- `lcp.modelDiscovery.v1`: disk snapshot for instant reopen (`031`)

### External dependencies
- Local `claude` binary on PATH (same as bridge `014`)
- Composer chip + browser: `025-model-selector.md`

### Gotchas
- **Effort is separate** — CC effort uses `EffortPopover` + `--effort` (`022`); catalog rows are model aliases only.
- **Not Cursor** — Cursor CLI lists effort/speed tiers as distinct models via `--list-models` (`026`); no Quack effort knob there.
- **Chip label** — composer shows stable Title Case alias (`Sonnet`), not probed `Sonnet 5` — `ccStableDisplayName` in `claudeCode.ts` (`071`).
- **First open skeleton** — popover sets `sessionLoad` + `is-hydrating` until live CLI catalogs finish; no partial stale list + tail shimmer.
- **Force refresh** — `invalidateClaudeCodeCache()` clears TS cache; Rust label cache survives until TTL (acceptable — aliases rarely change mid-hour).

### Related features
- `014-claude-code-bridge.md` — spawn/stream; shares `claude_print_text`
- `025-model-selector.md` — picker UX, platform pin filter
- `031-model-discovery-cache.md` — disk hydrate + `listFastModels`
- `071-honest-model-labels.md` — UI Title Case aliases via `ccStableDisplayName` (probes stay in Rust)
