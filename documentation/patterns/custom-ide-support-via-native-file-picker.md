---
type: pattern
created: 2026-02-13
tags: [ide-integration, rust, tauri, extensibility, file-picker, custom-registry]
---

# Custom IDE Support via Native File Picker

## Context

The original IDE system used a hardcoded `IDE_REGISTRY` in Rust, forcing users to wait for app updates to add new editors. A user wanted to use **Athas**, a code editor not in our registry, which highlighted the limitation.

## Solution: Full Custom IDE Workflow

Implemented a complete custom IDE registration system that allows users to add any code editor through the native file picker.

### 1. Frontend: Add Custom IDE Button

**Location**: `src/components/settings/categories/IDESettings.tsx` + `.css`

- "Add Custom IDE" button with dashed orange border (brand accent color)
- Opens native file picker via `@tauri-apps/plugin-dialog`
- macOS: filters for `.app` bundles in `/Applications`
- Windows: filters for `.exe` files
- Calls `ideStore.addCustomIDE(path)`

### 2. Store: Zustand Integration

**Location**: `src/stores/ideStore.ts`

- `addCustomIDE(path)` calls Rust command `register_custom_ide`
- Refreshes IDE list after registration

### 3. Rust Backend: Name/Icon Extraction + Storage

**Location**: `src-tauri/src/ide_integration.rs`

- CustomIDE struct with id (`custom-{uuid}`), name, path, icon_base64
- Name extraction: reads Info.plist CFBundleDisplayName/CFBundleName
- Icon extraction: converts .icns to 32x32 PNG via sips
- Storage: `~/.quack/custom-ides.json`

### 4. Custom ID Handling

**Convention**: `custom-{uuid}` for custom IDEs vs `vscode`, `cursor` for registry IDEs.

All IDE commands check registry first, custom IDEs second.

### 5. Launch Handling

**macOS**: `open -a "{path}"` | **Windows**: Direct `{path}` execution

## Why This Pattern Matters

**Extensibility without updates**: Users can add any editor immediately without waiting for Quack releases.

**Reusable pattern**: "native file picker -> metadata extraction -> JSON storage -> UI integration" workflow can be applied to other extensibility needs.
