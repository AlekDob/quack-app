---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), Monaco, plain CSS
created: 2026-07-03
last_verified: 2026-07-10
tags: [editor, monaco, theme, syntax-highlighting, settings, vscode, color-decorators, font]
---

## Editor color themes (VS Code bundled themes, per app mode)
**Purpose:** Match the **VS Code / Cursor “Color Theme”** picker: bundled light and dark syntax themes with English labels. Settings → Editor → **Color theme** lists only themes valid for the **currently resolved** app mode (`data-theme` on `<html>`). Each mode remembers its own choice (`lightColorTheme` / `darkColorTheme` in `lcp.editorSettings`).

**Not in scope:** Installing arbitrary `.json` theme extensions from the marketplace. Color themes do **not** change font family (that is fixed to the design-system mono stack — see below).

### Files
| Type | Path | Exports / purpose |
|------|------|-------------------|
| Catalog | `src/editorColorThemes.ts` | Theme lists, `normalizeColorTheme`, `ensureEditorColorThemes`, `registerMonacoForThemes`, `applyEditorColorTheme`, `pendingThemeId` queue, legacy aliases |
| Bundles | `src/vscodeThemeBundles.ts` | `VS_CODE_THEME_BUNDLES` — hand-crafted themes with `inherit: false` + full Monaco token rules |
| Rules | `src/monacoThemeRules.ts` | `VS_DARK_RULES`, `ABYSS_RULES`, `KIMBIE_RULES`, … — **Monaco tokenizer names**, not VS Code TextMate scopes |
| JSON | `src/vscodeThemes/*.json` | Full token rules: Monokai, Solarized light/dark, Tomorrow Night Blue (from [monaco-themes](https://github.com/brijeshb42/monaco-themes), MIT) |
| Font | `src/editorMonoFont.ts` | `readEditorMonoFont()` — reads `--mono` (JetBrains Mono stack) for Monaco `fontFamily` |
| Hook | `src/useResolvedEditorColorTheme.ts` | Resolves stored id + calls `applyEditorColorTheme` on change |
| Settings | `src/editorSettings.ts` | Persistence + `setColorThemeForMode` |
| UI | `src/components/SettingsModal.tsx` | Settings → Editor → Color theme `<select>` |
| Surfaces | `EditorPane`, `SimpleMonacoEditor`, `DiffView` | `theme`, `beforeMount={ensureEditorColorThemes}`, `fontFamily`, `colorDecorators: true` |

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
    → normalizeColorTheme(id, mode)   // rejects cross-mode ids
    → applyEditorColorTheme(id)       // setTheme now, or queue in pendingThemeId
  → <Editor beforeMount={ensureEditorColorThemes} theme={id} />
```

### Monaco mount lifecycle (order matters)
| Step | When | What |
|------|------|------|
| 1 | `beforeMount` | `ensureEditorColorThemes(monaco)` — `defineTheme` for all `quack-*` bundles **before** Monaco applies `theme` |
| 2 | Monaco init | Applies `theme` prop (`quack-dark-modern`, `vs-dark`, …) |
| 3 | `onMount` | `registerMonacoForThemes(monaco)` — stores Monaco handle; flushes `pendingThemeId` if `applyEditorColorTheme` ran early |
| 4 | Settings / mode change | `useResolvedEditorColorTheme` `useEffect` → `applyEditorColorTheme(id)` |

**All three Monaco surfaces** (`EditorPane`, `SimpleMonacoEditor`, `DiffView`) pass `beforeMount={ensureEditorColorThemes}`. `DiffView` had this from day one; main editor + compose-review surfaces were aligned in 2026-07-10.

### Key functions
| Function | Signature | Purpose |
|----------|-----------|---------|
| `ensureEditorColorThemes` | `(monaco) → void` | One-time `defineTheme` for `VS_CODE_THEME_BUNDLES` |
| `registerMonacoForThemes` | `(monaco) → void` | Store handle + flush `pendingThemeId` |
| `applyEditorColorTheme` | `(themeId) → void` | Live `setTheme`; queues when Monaco not ready |
| `normalizeColorTheme` | `(id, mode) → string` | Mode-scoped id + legacy alias + default fallback |
| `useResolvedEditorColorTheme` | `() → string` | Hook: resolved id + `useEffect` backstop for Settings changes |

On first Monaco mount: `registerMonacoForThemes(monaco)` → `defineTheme` (no-op if `beforeMount` ran) + stores Monaco handle for later `setTheme`.

### Token coloring (why themes looked “all the same” — fixed)
Monaco themes use **Monaco tokenizer token names** (`keyword`, `string`, `comment`, `type`, …). VS Code color themes use **TextMate scopes** (`entity.name.function`, …) which Monaco does **not** apply unless converted.

| Approach | Used for |
|----------|----------|
| `monacoThemeRules.ts` + `inherit: false` | Hand-crafted Quack themes (Modern, +/-, Abyss, Kimbie, Red, Monokai Dimmed, Quiet Light) |
| Bundled JSON (`monaco-themes` format) | Monokai, Solarized, Tomorrow Night Blue — already Monaco-compatible |
| Built-in `vs` / `vs-dark` | Monaco’s own full rule sets |

**Gotcha:** `inherit: true` + a few TextMate scope overrides made every custom theme look like `vs-dark`. Custom bundles now ship complete Monaco rule sets.

**Gotcha:** `@monaco-editor/react` does not always re-apply the `theme` prop when Settings changes — `useResolvedEditorColorTheme` calls `monaco.editor.setTheme` in a `useEffect` as a backstop.

**Gotcha (white editor in dark app mode — fixed 2026-07-10):** Registering custom themes only in `onMount` runs **after** Monaco applies the `theme` prop. Unknown `quack-*` ids fall back to built-in `vs` (white). Symptom: dark chrome + white editor canvas. Light mode looked fine because `vs` is already light. Fix: `beforeMount={ensureEditorColorThemes}` on every surface + `pendingThemeId` queue when `applyEditorColorTheme` fires before `registerMonacoForThemes`.

### Editor font (separate from color theme)
| What | Behavior |
|------|----------|
| **Color theme** | Syntax + editor chrome colors only |
| **Font family** | Always `readEditorMonoFont()` → CSS `--mono` (JetBrains Mono stack). Not user-configurable yet. |
| **Font size** | Settings → Editor → Font size |

Same as VS Code: “Color Theme” ≠ “Font Family”.

### Persistence
| Field | Default (new users) |
|-------|---------------------|
| `lightColorTheme` | `quack-light-modern` |
| `darkColorTheme` | `quack-dark-modern` |

**Legacy migration:** ids from the first picker (`quack-github-dark`, `quack-dracula`, …) map via `LEGACY_ALIASES`. Unknown ids fall back to the mode default.

### VS Code parity notes
- Labels are **English**; Italian VS Code strings (e.g. “Scuro 2026”) → **Dark Modern**.
- Quack **filters** the dropdown to the active mode; VS Code groups all themes in one palette.
- `colorDecorators: true` → CSS hex swatches in the gutter.
- **Dark Modern** vs **Dark (Visual Studio)** are intentionally similar (same in VS Code).

### Verification
1. **Dark app mode** → editor background is **not** white (`quack-dark-modern` default ≈ `#1F1F1F`); matches stored `darkColorTheme`.
2. **Light app mode** → editor uses stored `lightColorTheme` only (no dark theme leak).
3. Dark mode → **Abyss** → blue-tinted text (`#6688cc`) on navy background.
4. **Monokai** → yellow strings, pink keywords (JSON rules).
5. **Red** → `#390000` editor background.
6. Change theme in Settings with a file open → colors update **without** tab switch.
7. Toggle app theme Light ↔ Dark → editor swaps to the remembered theme for that mode.
8. Editor uses JetBrains Mono (not system Consolas).
9. `.css` with `#ff0000` → color decorator square.

### Related
- `documentation/features/027-editor-tab-toolbar.md` — same Monaco surfaces
- `documentation/features/003-design-system.md` — `--mono` token; app chrome independent from Monaco canvas

### Future
- Settings → Editor → **Font family** (VS Code `editor.fontFamily`)
- Command palette “Preferences: Color Theme” with live preview
