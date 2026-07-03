---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), Monaco, plain CSS
created: 2026-07-03
last_verified: 2026-07-03
tags: [editor, monaco, theme, syntax-highlighting, settings, color-decorators]
---

## Editor color themes (Monaco syntax themes per app mode)
**Purpose:** Let users pick a Monaco syntax-highlighting theme the way VS Code does — but scoped to **light** vs **dark** app mode. The Settings dropdown only lists themes valid for the **currently resolved** mode (`data-theme` on `<html>`). Each mode remembers its own choice; switching Light ↔ Dark restores the editor theme you last picked for that mode.

**Not in scope:** Importing arbitrary VS Code `.json` theme extensions, or decoupling editor theme from app chrome (the Quack UI still follows `lcp.theme`; only Monaco's canvas changes).

### Files
| Type | Path | Exports / purpose |
|------|------|-------------------|
| Catalog | `src/editorColorThemes.ts` | Theme lists per mode, `normalizeColorTheme`, `ensureEditorColorThemes`, `themesForMode` |
| Hook | `src/useResolvedEditorColorTheme.ts` | `useResolvedEditorColorTheme()` — resolves stored id for current light/dark |
| Settings | `src/editorSettings.ts` | `lightColorTheme`, `darkColorTheme`, `setColorThemeForMode` |
| UI | `src/components/SettingsModal.tsx` | Settings → Editor → **Color theme** `<select>` |
| Editor | `src/components/EditorPane.tsx` | Main tab Monaco — `theme={colorTheme}`, `colorDecorators: true` |
| Editor | `src/components/SimpleMonacoEditor.tsx` | Modal/lightweight Monaco — same theme hook |
| Diff | `src/components/DiffView.tsx` | `DiffEditor` — same theme + `beforeMount` registration |
| App theme | `src/theme.ts` | `useResolvedTheme()` drives which stored key is active |

### Available themes
| Mode | ID | Label | Source |
|------|-----|-------|--------|
| light | `vs` | Visual Studio Light | Monaco built-in (default) |
| light | `hc-light` | High Contrast Light | Monaco built-in |
| light | `quack-github-light` | GitHub Light | `defineTheme` (`inherit: vs`) |
| light | `quack-solarized-light` | Solarized Light | `defineTheme` |
| light | `quack-quiet-light` | Quiet Light | `defineTheme` (near Quack `--bg`) |
| dark | `vs-dark` | Visual Studio Dark | Monaco built-in (default) |
| dark | `hc-black` | High Contrast Dark | Monaco built-in |
| dark | `quack-github-dark` | GitHub Dark | `defineTheme` (`inherit: vs-dark`) |
| dark | `quack-monokai` | Monokai | `defineTheme` |
| dark | `quack-dracula` | Dracula | `defineTheme` |
| dark | `quack-one-dark` | One Dark | `defineTheme` |

Custom themes override **editor chrome colors** (background, foreground, line numbers, selection, indent guides) and `inherit: true` keeps Monaco's token rules from the base (`vs` / `vs-dark`). IDs prefixed `quack-` avoid collisions with built-ins.

### Data flow
```
lcp.theme (system|light|dark)
    → resolve → data-theme light|dark
        → useResolvedEditorColorTheme()
            → read lightColorTheme OR darkColorTheme from lcp.editorSettings
            → normalizeColorTheme(id, mode)  // fallback if stale id
        → <Editor theme={id} />
```

On first Monaco mount (`EditorPane.onMount`, `SimpleMonacoEditor.onMount`, `DiffView.beforeMount`):
`ensureEditorColorThemes(monaco)` registers custom themes once (module-level `registered` flag).

### State / persistence
Stored inside `lcp.editorSettings` (same blob as font size, minimap, etc.):

| Field | Type | Default |
|-------|------|---------|
| `lightColorTheme` | `string` | `vs` |
| `darkColorTheme` | `string` | `vs-dark` |

`normalizeColorTheme` on read/write prevents persisting a dark-only id while in light mode (and vice versa) — unknown ids fall back to the mode default.

**UX contract:** Changing **Appearance → Theme** does not reset your per-mode editor picks. Toggling app theme swaps Monaco to the other stored id automatically via `useResolvedEditorColorTheme`.

### Settings UI
- **Location:** Settings → Editor → **Color theme** (top of section).
- **Options:** `themesForMode(useResolvedTheme())` — list filtered live; if user has Settings open and toggles app theme, the dropdown repopulates.
- **Note row:** Explains separate light/dark memory.

### Monaco options
All three Monaco surfaces enable `colorDecorators: true` so CSS/SCSS hex and named colors show inline swatches (VS Code parity for `globals.css`-style files).

### Before this feature
Monaco used a hard-coded mapping: `resolvedTheme === "dark" ? "vs-dark" : "vs"`. No user override.

### Extension points (future)
- Command palette: "Preferences: Color Theme" + quick-pick cycle (mirror VS Code).
- Load `.json` VS Code themes from a user folder (`monaco-vscode-textmate` or manual `defineTheme` conversion).
- Per-workspace theme override (probably unnecessary — keep global).

### Related docs
- `documentation/features/027-editor-tab-toolbar.md` — same Monaco surfaces (`EditorPane`, `DiffView`, `SimpleMonacoEditor`)
- `documentation/features/003-design-system.md` — app chrome tokens (`--bg`, `--fg`); independent from Monaco canvas
- `src/theme.ts` — app Light/Dark/System (not the syntax theme)

### Verification
1. Settings → Editor → pick **Monokai** in dark mode → editor background goes `#272822`.
2. Switch Appearance → Light → editor switches to your **light** stored theme (default VS Light), dropdown shows only light themes.
3. Pick **Solarized Light**, switch back to Dark → Monokai returns.
4. Open a `.css` file with `#ff0000` — color decorator square appears in the gutter area of the value.
