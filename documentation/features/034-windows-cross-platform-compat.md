---
type: feature-doc
project: quack-app
stack: React 18 + TypeScript strict + Tauri v2
created: 2026-04-04
last_verified: 2026-04-04
tags: [windows, cross-platform, path-normalization, font-fallback, 024-editor, 026-feature-map]
---

## Windows Cross-Platform Compatibility (024 + 026)
**Purpose:** Fix path separator, font fallback, localStorage key consistency, and macOS-only guards so features 024 (Code Editor) and 026 (Feature Map) work correctly on Windows.
**Stack:** React 18, TypeScript strict, Tauri v2

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Util | `src/utils/platform.ts` | `normalizeToForwardSlash(path)` -- converts `\` to `/` for consistent keys/paths |
| Component | `src/components/editor/EditorHeader.tsx` | `buildBreadcrumb()` splits on `[\\/]` for Windows paths |
| Component | `src/components/editor/EditorEmptyState.tsx` | Platform-aware `Cmd/Ctrl+P` shortcut text |
| Component | `src/components/editor/CodeEditorEngine.tsx` | Font fallback chain: added Cascadia Code, Cascadia Mono, Consolas |
| Component | `src/components/editor/CodeMirrorMergeView.tsx` | Same font fallback chain as CodeEditorEngine |
| Hook | `src/hooks/useCodeEditorTab.ts` | `extractFilename()` splits on `[\\/]` for Windows tab labels |
| Service | `src/services/featureMapService.ts` | `parseFeatureDoc()` filename extraction splits on `[\\/]` |
| Component | `src/components/featureMap/FeatureMapPopover.tsx` | File display splits on `[\\/]`; image path uses `normalizeToForwardSlash` |
| Component | `src/components/featureMap/FeatureMapView.tsx` | localStorage keys + file paths via `normalizeToForwardSlash` |
| Component | `src/components/featureMap/CanvasImage.tsx` | Image loading path via `normalizeToForwardSlash` |
| Component | `src/components/featureMap/FeatureMapMinimap.tsx` | `WebkitBackdropFilter` vendor prefix for older WebView2 |
| Store/State | `src/hooks/useAnnotations.ts` | Annotation localStorage keys via `normalizeToForwardSlash` |
| Store/State | `src/hooks/useFeatureMapData.ts` | Feature doc directory path via `normalizeToForwardSlash` |
| Store/State | `src/stores/ideStore.ts` | Windows `defaultPath: 'C:\Program Files'` for IDE picker dialog |
| Rust | `src-tauri/src/code_intel.rs` | `get_node_sdk_path()` -- `#[cfg]` branches for macOS/Windows/Linux bundle layout |
| Rust | `src-tauri/src/shell_env.rs` | `get_extended_path()` -- Windows PATH dirs (nvm, volta, fnm, pnpm, npm) with `;` separator |

### Fixes Applied

**1. Path separator normalization**
- `EditorHeader.buildBreadcrumb()`: `split('/')` changed to `split(/[\\/]/)`
- `featureMapService.parseFeatureDoc()`: filename extraction uses `split(/[\\/]/)`
- `FeatureMapPopover`: file path display uses `split(/[\\/]/)`
- All localStorage keys use `normalizeToForwardSlash()` to prevent duplicate entries per OS

**2. Font fallback chain (024)**
- `CodeEditorEngine` inline style: `"JetBrains Mono", "Cascadia Code", "Cascadia Mono", "SF Mono", Monaco, Consolas, Inconsolata, "Courier New", monospace`
- Ensures readable monospace on Windows where JetBrains Mono may not be installed

**3. Rust cross-platform (critical)**
- `code_intel.rs`: production path `../Resources/node-sdk` was macOS-only; added `#[cfg]` for Windows (`resources/node-sdk`) and Linux fallback
- `shell_env.rs`: `get_extended_path()` was Unix-only (`:` separator, `/opt/homebrew`, `~/.nvm`); added Windows branch with `;` separator and Windows paths (`%ProgramFiles%\nodejs`, `%APPDATA%\nvm`, `.volta\bin`, `%LOCALAPPDATA%\pnpm`)

**4. Platform-aware UI**
- `EditorEmptyState.tsx`: `Cmd+P` hardcoded -> detects platform and shows `Ctrl+P` on Windows
- `ideStore.ts`: IDE picker dialog `defaultPath` was `undefined` on Windows -> `C:\Program Files`
- `FeatureMapMinimap.tsx`: added `WebkitBackdropFilter` vendor prefix for older WebView2

**5. Path construction for Tauri invokes**
- `FeatureMapView.saveImageFile()`: uses `normalizeToForwardSlash(projectPath)` for path building
- `FeatureMapPopover` image loading: normalizes project path before constructing absolute path
- `CanvasImage`: same normalization for `read_binary_file` invoke
- `useAnnotations`: `load()`/`save()`/`clearAll()` normalize storage keys

### Key Functions
- `normalizeToForwardSlash(path) -> string` -- replaces `\` with `/` for cross-platform consistency
- `buildBreadcrumb(filePath) -> string[]` -- cross-platform path splitting for editor header
- `parseFeatureDoc(raw, filePath) -> FeatureNode | null` -- cross-platform filename extraction

### Data Flow
```
Windows path (C:\Users\...) -> normalizeToForwardSlash() -> forward-slash path -> localStorage key / Tauri invoke path
```

### Config
- Brain breadcrumb: `// Brain: gotcha-windows-path-separators` on affected lines
- Font fallback priority: JetBrains Mono > Cascadia Code > Cascadia Mono > SF Mono > Monaco > Consolas > Inconsolata > Courier New
