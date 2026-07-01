---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), plain CSS
created: 2026-07-01
last_verified: 2026-07-01
tags: [model-selector, model-browser, model-picker, favorites, visibility, cursor-cli, opencode-cli, composer, lazy-load, free-models]
---

## Model Selector (composer chip + catalog + visibility)
**Purpose:** Let the user pick an AI model from the composer chip (quick popover), browse the full catalog in a modal, and toggle which models appear in the quick picker — with favorites, free-model badges, and per-provider grouping across Ollama, Claude Code, Cursor CLI, OpenCode, OpenAI, and Anthropic.
**Stack:** React 19 + Zustand (`AIChatPanel`), localStorage prefs, shared CSS shell (`model-browser`).

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/ModelPickerPopover.tsx` | Chip-triggered quick picker; `onOpen` triggers lazy CLI catalog fetch |
| Component | `src/components/ModelPickerRow.tsx` | Row with star toggle + optional `free` tag |
| Component | `src/components/ModelBrowser.tsx` | Full catalog modal; OpenCode group; `free` tag on cards |
| Component | `src/components/ManageModelsModal.tsx` | Toggle model visibility in quick picker (reuses `model-browser` shell) |
| Service | `src/modelPrefs.ts` | Favorites + disabled-model maps in localStorage |
| Service | `src/modelSelectorUtils.ts` | `buildModelGroups`, `filterVisibleGroups`, `splitFavoriteModels`, `modelLabel` |
| Service | `src/providers/index.ts` | `listAllModels` / `listAllCloudModels` — parallel `Promise.all` |
| Component | `src/components/AIChatPanel.tsx` | `refreshLiveCliModels`, `browserOpen` effect, parallel `refresh()` |
| Config | `src/App.css` | `.tag-free`, `.model-picker-star` (always visible, muted until favorited) |
| Design | `documentation/design/model-modal-pattern.md` | Visual/style contract for catalog + manage modals |

### UX map (entry points)
| User action | Surface |
|---|---|
| Click composer model chip (`● opus ▾`) | `ModelPickerPopover` (+ lazy CLI model fetch via `onOpen`) |
| `⋯` menu → Browse models | `ModelBrowser` (+ lazy CLI model fetch on open) |
| `⚙` in popover | `ModelBrowser` (same catalog) |
| **Visibility** in ModelBrowser header | `ManageModelsModal` |
| `+` in popover | Settings (providers) |

### Data Flow
**Startup (lightweight):** `AIChatPanel` mount → `refresh()` parallel → `listAllModels` + `listAllCloudModels` → CLI providers return default row only (no `opencode serve`, no `cursor-agent --list-models`)

**Lazy catalog:** popover `onOpen` or `browserOpen` → `refreshLiveCliModels()` → `refreshOpenCodeModelsLive()` + `refreshCursorModelsLive()` → merge into `allModels` / `allCloudCatalog`

**Pick:** `buildModelGroups()` → popover filters disabled via `isModelEnabled` → `onSelect(qualified)` → chat provider routing

### Key Functions
- `refreshLiveCliModels() → void` — `AIChatPanel`; merges live OpenCode + Cursor lists into state
- `refreshOpenCodeModelsLive() → ProviderModel[]` — see `028-opencode-bridge.md`
- `refreshCursorModelsLive() → ProviderModel[]` — see `026-cursor-cli-bridge.md`
- `buildModelGroups(cloud, ollama, hasKey) → ProviderGroup[]` — ordered provider sections
- `toggleFavoriteModel(qualified) → void` — flip star in popover

### State
- `lcp.modelFavorites`: `Record<string, boolean>` — starred models (global)
- `lcp.modelDisabled`: `Record<string, boolean>` — hidden from quick picker (global)
- `browserOpen` / `manageModelsOpen`: `boolean` — modal visibility (`AIChatPanel`)
- `ProviderModel.isFree`: optional; green `free` badge in picker + browser; OpenCode free models sorted first

### External Dependencies
- Provider catalogs: `src/providers/*` (lazy CLI lists — `026`, `028`)
- Ollama: live `/api/tags` via existing provider layer
- Backdrop/focus: `settings-backdrop`, `useModalFocus`, `settings-close`

### Config
- `lcp.modelFavorites`: favorite qualified model keys (default `{}`)
- `lcp.modelDisabled`: disabled qualified model keys (default `{}`)

### Gotchas
- **Lazy CLI catalogs:** at cold start OpenCode/Cursor show one default model each; full list loads when picker or browser opens (or after first sidecar spawn warms cache).
- **Favorites star visibility:** star is always visible at 40% opacity (`--warn` when favorited) — was `opacity: 0` until hover (looked broken).
- **Free badge:** semantic green via `.tag-free` token; not orange accent.
- **Qualified key format:** `providerId:modelId` via `makeQualifiedModel` / `modelKey`.
- **Parallel refresh:** `refresh()` no longer serializes provider checks — startup latency fix post-OpenCode integration.
