---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), Monaco, plain CSS
created: 2026-07-03
last_verified: 2026-07-03
tags: [editor, monaco, theme, syntax-highlighting, settings, vscode, color-decorators]
---

## Editor color themes (VS Code bundled themes, per app mode)
**Purpose:** Match the **VS Code / Cursor “Color Theme”** picker: bundled light and dark syntax themes with English labels. Settings → Editor → **Color theme** lists only themes valid for the **currently resolved** app mode (`data-theme` on `<html>`). Each mode remembers its own choice (`lightColorTheme` / `darkColorTheme` in `lcp.editorSettings`).

**Not in scope:** Installing arbitrary `.json` theme extensions from the marketplace.

### Files
| Type | Path | Exports / purpose |
|------|------|-------------------|
| Catalog | `src/editorColorThemes.ts` | Theme lists, `normalizeColorTheme`, `ensureEditorColorThemes`, legacy id aliases |
| Bundles | `src/vscodeThemeBundles.ts` | Hand-crafted VS Code themes (Modern, +/-, Abyss, Kimbie, Red, …) |
| JSON | `src/vscodeThemes/*.json` | Full token rules: Monokai, Solarized light/dark, Tomorrow Night Blue (from [monaco-themes](https://github.com/brijeshb42/monaco-themes), MIT) |
| Hook | `src/useResolvedEditorColorTheme.ts` | Resolves stored id for current light/dark |
| Settings | `src/editorSettings.ts` | Persistence + `setColorThemeForMode` |
| UI | `src/components/SettingsModal.tsx` | Settings → Editor → Color theme `<select>` |
| Surfaces | `EditorPane`, `SimpleMonacoEditor`, `DiffView` | `theme={useResolvedEditorColorTheme()}`, `colorDecorators: true` |

### Theme catalog (matches VS Code bundled set)
**Light** (default: `quack-light-modern` = Light Modern)

| ID | Label |
|----|-------|
| `quack-light-modern` | Light Modern |
| `vs` | Light (Visual Studio) |
| `quack-light-plus` | Light+ |
| `quack-quiet-light` | Quiet Light |
| `quack-solarized-light` | Solarized Light |
| `hc-light` | High Contrast Light |

**Dark** (default: `quack-dark-modern` = Dark Modern)

| ID | Label |
|----|-------|
| `quack-dark-modern` | Dark Modern |
| `quack-abyss` | Abyss |
| `quack-kimbie-dark` | Kimbie Dark |
| `quack-monokai` | Monokai |
| `quack-monokai-dimmed` | Monokai Dimmed |
| `quack-red` | Red |
| `vs-dark` | Dark (Visual Studio) |
| `quack-dark-plus` | Dark+ |
| `quack-solarized-dark` | Solarized Dark |
| `quack-tomorrow-night-blue` | Tomorrow Night Blue |
| `hc-black` | High Contrast Dark |

Built-in Monaco ids (`vs`, `vs-dark`, `hc-*`) need no `defineTheme`. All `quack-*` ids are registered in `ensureEditorColorThemes`.

### Data flow
```
lcp.theme → data-theme light|dark
  → useResolvedEditorColorTheme()
    → lightColorTheme | darkColorTheme (lcp.editorSettings)
    → normalizeColorTheme(id, mode)  // legacy alias + fallback
  → <Editor theme={id} />
```

First Monaco mount calls `ensureEditorColorThemes(monaco)` once.

### Persistence
| Field | Default (new users) |
|-------|---------------------|
| `lightColorTheme` | `quack-light-modern` |
| `darkColorTheme` | `quack-dark-modern` |

**Legacy migration:** First-picker ids (`quack-github-dark`, `quack-dracula`, …) map to nearest VS Code theme via `LEGACY_ALIASES` in `editorColorThemes.ts`. Unknown ids fall back to the mode default.

### VS Code parity notes
- Labels are **English** (product rule); Italian VS Code strings (e.g. “Scuro 2026”) map to **Dark Modern**.
- VS Code shows all themes in one palette grouped by mode; Quack **filters** the dropdown to the active mode only (per original spec).
- `colorDecorators: true` enables CSS hex/named-color swatches in the editor.

### Verification
1. Settings → Editor → dark mode → pick **Abyss** → background `#000c18`.
2. Pick **Monokai** → classic green/pink token colors (full rules from bundled JSON).
3. Switch app theme to Light → dropdown shows only light themes; prior light choice restored.
4. Open `.css` with `#ff0000` → inline color square visible.

### Related
- `documentation/features/027-editor-tab-toolbar.md` — same Monaco surfaces
- `documentation/features/003-design-system.md` — app chrome tokens (independent from Monaco canvas)

### Future
- Command palette “Preferences: Color Theme” with live preview
- Optional unfiltered list (all themes, grouped) like VS Code
