---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), plain CSS
created: 2026-07-13
last_verified: 2026-07-17
tags: [model-selector, claude-code, composer, usage, display-names]
---

## Claude Code model display labels (Codetta-style)

**Purpose:** Show stable, human model names in the composer and catalog —
Title Case **aliases** (`Sonnet`, `Opus`, `Haiku`, `Fable`) — without a static
version map (`Sonnet 5` / `Opus 4.8`) and without flipping the chip when Rust
CLI probes refresh.

**Stack:** `claudeCode.ts` (`ccStableDisplayName` + `FALLBACK_MODELS`) +
`modelLabel` in `modelSelectorUtils.ts` + picker/usage surfaces.

### Files

| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Provider | `src/providers/claudeCode.ts` | `FALLBACK_MODELS` Title Case; `ccStableDisplayName`; maps live CLI rows |
| Service | `src/modelSelectorUtils.ts` | `modelLabel(models, qualified)` → `displayName \|\| modelId` |
| Component | `src/components/ModelPickerPopover.tsx` | Chip text via `modelLabel` |
| Component | `src/components/ModelPickerRow.tsx` | Row name = `displayName \|\| modelId` |
| Component | `src/components/ModelBrowser.tsx` | Cards use catalog `displayName` (same stable titles for CC) |
| Component | `src/components/chatPanelChrome.tsx` | `UsageChip` — cost / tokens / cache / duration **only** |
| Component | `src/components/UsagePanel.tsx` | Session row: `shortModelFamily` (family only) |
| Component | `src/components/AIChatPanel.tsx` | Usage-strip tooltip = raw `lastUsage.model` when present |
| Rust | `src-tauri/src/claude_models.rs` | Still probes version labels for CLI catalog — **not** used as UI `displayName` |

### Display rules

| Surface | What the user sees |
|---|---|
| Composer chip | Catalog `displayName` — e.g. `Sonnet`, `Default · …` |
| Picker row / Model Browser (CC) | Same stable Title Case alias |
| Usage strip (`UsageChip`) | `$cost · tokens · cache% · duration` — **no** model name |
| Usage strip tooltip | Raw API / transcript id when known (`claude-sonnet-…`) |
| Usage tab session row | Family only: `sonnet` / `opus` / `haiku` / … (`shortModelFamily`) |

Other providers (Anthropic BYOK, Cursor CLI, Ollama): unchanged — chip/picker
still use each row’s catalog `displayName`.

### Data flow

```
FALLBACK_MODELS (instant)
  displayName: "Sonnet" | "Opus" | …

claude_code_list_models (Rust)
  id + probed display_name ("Sonnet 5", …)
       │
       ▼
ccStableDisplayName(id, fromCli, isDefault)
  default row → keep CLI "Default · …"
  else        → Title Case alias (ignore probe version)
       │
       ▼
ProviderModel.displayName → modelLabel / picker / browser
```

Selection still sends the **alias id** to the CLI (`--model sonnet`), not the
pretty label.

### Key functions

- `ccStableDisplayName(id, fromCli, isDefault) → string` — UI label for CC rows
- `CC_ALIAS_TITLE` — alias → Title Case map (`sonnet` → `Sonnet`, …); unknown
  aliases title-case the id
- `modelLabel(models, qualified) → string` — chip lookup by qualified key
- `shortModelFamily(raw) → string` — Usage tab: first matching family substring,
  else first two `-`-segments of the id

### State

- None for labels — pure formatters over catalog / usage payloads
- Rust `LABEL_CACHE` (1h) still holds probed version names for the CLI list
  command; TS discards them for `displayName` on non-default rows

### Gotchas

- **Probes ≠ chip** — Rust may still resolve `Sonnet 5`; UI must not bind the
  chip to `e.display_name` or the Sonnet ↔ Sonnet 5 flip returns
- **No version regex table** — do not reintroduce `RESOLVED_LABELS` /
  `formatResolvedModel` for Anthropic version strings; they rot every release
- **Default row is special** — `is_default` keeps the CLI string
  (`Default · Sonnet 5`) so the user still sees which model “default” is
- **`[1m]` aliases** — `sonnet[1m]` → `Sonnet (1M context)` via recursive
  `ccStableDisplayName`
- **Deleted** — `src/modelDisplay.ts` (honest-labels dual layer, 2026-07-13 →
  reverted 2026-07-17)

### History

| Date | Change |
|---|---|
| 2026-07-13 | `071` “honest labels”: chip = raw alias (`sonnet`); usage strip appended billed model via static `RESOLVED_LABELS` |
| 2026-07-17 | Reverted to Codetta-style Title Case `displayName`; dropped `modelDisplay.ts` and version map |

### Related features

- `025-model-selector.md` — picker / browser / favorites
- `059-claude-code-model-catalog.md` — CLI `/model` probe + instant fallbacks
- `023-session-usage-panel.md` — UsageChip + Usage tab
- `022-chat-composer.md` — composer model chip chrome
- `031-model-discovery-cache.md` — shared catalog hydrate
