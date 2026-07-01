---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), plain CSS
created: 2026-07-01
last_verified: 2026-07-01
tags: [model-selector, model-browser, model-picker, favorites, visibility, cursor-cli, composer]
---

## Model Selector (composer chip + catalog + visibility)
**Purpose:** Let the user pick an AI model from the composer chip (quick popover), browse the full catalog in a modal, and toggle which models appear in the quick picker — with favorites and per-provider grouping across Ollama, Claude Code, Cursor CLI, OpenAI, and Anthropic.
**Stack:** React 19 + Zustand (`AIChatPanel`), localStorage prefs, shared CSS shell (`model-browser`).

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/ModelPickerPopover.tsx` | Chip-triggered quick picker (search, favorites, groups, `+` → Settings, `⚙` → full browser) |
| Component | `src/components/ModelPickerRow.tsx` | Row with star toggle for favorites |
| Component | `src/components/ModelBrowser.tsx` | Full catalog modal ("Choose a model"); provider pill filter; **Visibility** → manage modal |
| Component | `src/components/ManageModelsModal.tsx` | Toggle model visibility in quick picker (reuses `model-browser` shell) |
| Service | `src/modelPrefs.ts` | Favorites + disabled-model maps in localStorage |
| Service | `src/modelSelectorUtils.ts` | `buildModelGroups`, `filterVisibleGroups`, `splitFavoriteModels`, `modelLabel` |
| Component | `src/components/AIChatPanel.tsx` | Wires chip popover, browser, manage modal; `browserOpen` / `manageModelsOpen` state |
| Config | `src/App.css` | `.model-browser*`, `.model-picker*`, `.manage-models-*`, theme overrides |
| Design | `documentation/design/model-modal-pattern.md` | Visual/style contract for catalog + manage modals |

### UX map (entry points)
| User action | Surface |
|---|---|
| Click composer model chip (`● opus ▾`) | `ModelPickerPopover` |
| `⋯` menu → Browse models | `ModelBrowser` |
| `⚙` in popover | `ModelBrowser` (same catalog) |
| **Visibility** in ModelBrowser header | `ManageModelsModal` |
| `+` in popover | Settings (providers) |

### Data Flow
`AIChatPanel` (cloud + ollama model lists, `hasKey`) → `buildModelGroups()` → popover filters disabled via `isModelEnabled` → user picks → `onSelect(qualified)` → chat provider routing

`ManageModelsModal` toggle → `toggleModelEnabled(qualified)` → `lcp.modelDisabled` → popover re-filters on next `prefsTick`

`ModelPickerRow` star → `toggleFavoriteModel(qualified)` → `lcp.modelFavorites` → favorites section in popover

### Key Functions
- `buildModelGroups(cloud, ollama, hasKey) → ProviderGroup[]` — ordered provider sections
- `filterVisibleGroups(groups, query, isEnabled) → ProviderGroup[]` — search + visibility filter
- `splitFavoriteModels(groups, favorites) → { favorites, groupsNoFav }` — dedupe favs from groups
- `isModelEnabled(qualified) → boolean` — default enabled unless in disabled map
- `toggleModelEnabled(qualified) → void` — flip visibility for quick picker
- `toggleFavoriteModel(qualified) → void` — flip star in popover

### State
- `lcp.modelFavorites`: `Record<string, boolean>` — starred models (global)
- `lcp.modelDisabled`: `Record<string, boolean>` — hidden from quick picker (global)
- `browserOpen` / `manageModelsOpen`: `boolean` — modal visibility (`AIChatPanel`, component)
- `prefsTick`: `number` — forces popover/manage re-render after pref writes (component)

### External Dependencies
- Provider catalogs: `src/providers/*` (incl. dynamic Cursor CLI list — see `026-cursor-cli-bridge.md`)
- Ollama: live `/api/tags` via existing provider layer
- Backdrop/focus: `settings-backdrop`, `useModalFocus`, `settings-close`

### Config
- `lcp.modelFavorites`: favorite qualified model keys (default `{}`)
- `lcp.modelDisabled`: disabled qualified model keys (default `{}`)

### Gotchas
- **⚙ opens catalog, not manage:** gear in popover → `ModelBrowser`; visibility toggles live under **Visibility** in the browser header.
- **Manage modal shares shell:** `ManageModelsModal` uses `model-browser liquid-glass` classes — do not fork a separate modal style (see `design/model-modal-pattern.md`).
- **Qualified key format:** `providerId:modelId` via `makeQualifiedModel` / `modelKey`.
- **Popover vs browser width:** popover 288px (`model-picker-pop`); browser 760px; manage 520px — same visual language, different footprint.
