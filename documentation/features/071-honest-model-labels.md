---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), plain CSS
created: 2026-07-13
last_verified: 2026-07-13
tags: [model-selector, claude-code, composer, usage, anthropic, cursor-style]
---

## Honest model labels (alias vs resolved)
**Purpose:** Split model naming into two honest layers — composer shows the **alias you picked** (`sonnet`); post-turn feedback shows the **concrete model the API billed** (`Sonnet 5`). Eliminates Sonnet ↔ Sonnet 5 flip in the chip when CC label probes refresh.
**Stack:** `src/modelDisplay.ts` + composer picker + usage strip.

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | `src/modelDisplay.ts` | `composerChipLabel`, `pickerRowLabel`, `formatResolvedModel` |
| Service | `src/modelSelectorUtils.ts` | `modelLabel()` → delegates to `composerChipLabel` |
| Component | `src/components/ModelPickerPopover.tsx` | Chip via `modelLabel` |
| Component | `src/components/ModelPickerRow.tsx` | Picker rows via `pickerRowLabel` |
| Component | `src/components/chatPanelChrome.tsx` | `UsageChip` appends resolved model |
| Component | `src/components/AIChatPanel.tsx` | `.ai-usage-strip` tooltip uses `formatResolvedModel` |
| Component | `src/components/UsagePanel.tsx` | Session list model column |
| Provider | `src/providers/claudeCode.ts` | `FALLBACK_MODELS` `displayName` = alias (`sonnet`) |

### Display rules
| Surface | Claude Code | Other providers |
|---|---|---|
| Composer chip | `modelId` alias (`sonnet`, `opus`, `default`) | Catalog `displayName` or `modelId` |
| Picker row | Same alias | `displayName` |
| Usage strip / `UsageChip` | `formatResolvedModel(usage.model)` from stream `result` / `usage` event | Same |
| Usage tab session row | `formatResolvedModel(primary_model)` | Same |
| Model browser cards | Unchanged — still `displayName` for full catalog browse | — |

### Data flow
**Selection:** `onSelect(claude-code:sonnet)` → chip `sonnet` → `--model sonnet` to CLI

**Post-turn:** `ChatStreamEvent kind:usage` with `model: "claude-sonnet-4-…"` → `setLastUsage` → `UsageChip` → `$0.02 · 1.2k in / 567 out · 3.1s · Sonnet 5`

**CC catalog probe (`059`):** Rust still probes `Sonnet 5` into `display_name` on `ProviderModel` — **not** shown in chip/picker; kept for browser search + internal catalog only

### Key functions
- `composerChipLabel(qualified, models?) → string` — chip label
- `pickerRowLabel(model) → string` — picker row primary label
- `formatResolvedModel(raw) → string | null` — API / transcript id → human label

### State
- None — pure formatters; `lastUsage.model` on `AIChatPanel` holds raw resolved id per turn

### Gotchas
- **Not a mapping table** — no alias→version map in TS; resolved name comes only from API `usage.model` at turn end
- **Anthropic BYOK** — chip shows catalog name (`Claude Sonnet 4.6 (balanced)`); resolved feedback from `message_start` usage event
- **Mismatch is OK** — chip `sonnet` + strip `Sonnet 5` is intentional (honest alias vs billed model)
- **Browser unchanged** — `ModelBrowser` cards still use probed `displayName` for discovery

### Related features
- `025-model-selector.md` — picker UX, chip entry point
- `059-claude-code-model-catalog.md` — CLI probe; labels internal to catalog now
- `023-session-usage-panel.md` — `UsageChip` + usage strip
- `022-chat-composer.md` — composer model chip
