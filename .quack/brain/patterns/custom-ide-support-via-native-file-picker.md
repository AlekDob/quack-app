---
type: pattern
project: quack-app
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

```typescript
// In IDESettings.tsx
const handleAddCustomIDE = async () => {
  const selected = await open({
    directory: false,
    multiple: false,
    defaultPath: '/Applications',
    filters: [{ name: 'Applications', extensions: ['app'] }]
  });

  if (selected) {
    await ideStore.addCustomIDE(selected as string);
  }
};
```

### 2. Store: Zustand Integration

**Location**: `src/stores/ideStore.ts`

- `addCustomIDE(path)` calls Rust command `register_custom_ide`
- Refreshes IDE list after registration
- Custom IDEs appear seamlessly alongside registry IDEs

### 3. Rust Backend: Name/Icon Extraction + Storage

**Location**: `src-tauri/src/ide_integration.rs`

#### CustomIDE Struct

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomIDE {
    pub id: String,          // custom-{uuid}
    pub name: String,        // Extracted from Info.plist
    pub path: String,        // Full path to .app or .exe
    pub icon_base64: String, // 32x32 PNG, base64 encoded
}
```

#### Name Extraction (macOS)

```rust
// Read Info.plist at {path}/Contents/Info.plist
// Extract CFBundleDisplayName || CFBundleName
// Fallback to filename without .app extension
```

#### Icon Extraction (macOS)

```rust
// Extract icon path from Info.plist: CFBundleIconFile
// Convert .icns to 32x32 PNG via sips:
// sips -s format png -Z 32 input.icns --out output.png
// Read PNG bytes and base64 encode
```

#### Storage

- Custom IDEs saved to `~/.quack/custom-ides.json`
- Format: `Vec<CustomIDE>`
- Loaded on app startup and merged with registry IDEs

#### Commands

```rust
#[tauri::command]
pub async fn register_custom_ide(path: String) -> Result<CustomIDE, String>

#[tauri::command]
pub async fn remove_custom_ide(id: String) -> Result<(), String>
```

### 4. Custom ID Handling

**Convention**: `custom-{uuid}` for custom IDEs vs `vscode`, `cursor` for registry IDEs.

All IDE commands (`ide_open`, `ide_get_context`, etc.) now check:
1. Registry first (by hardcoded ID)
2. Custom IDEs second (by path stored in custom-ides.json)

### 5. Remove Custom IDE

**Location**: `src/components/settings/categories/IDESettings.tsx` + `.css`

- Hover over custom IDE in settings grid shows red **X** button (top-right corner)
- Calls `removeCustomIDE(id)` → Rust command `remove_custom_ide`
- Removes from `custom-ides.json` and refreshes list

```css
/* IDESettings.css */
.ide-card.custom .remove-button {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.ide-card.custom:hover .remove-button {
  opacity: 1;
}
```

### 6. Launch Handling

**macOS**: `open -a "{path}"` (works for both registry and custom .app bundles)

**Windows**: Direct `{path}` execution for .exe files

## Files Changed

| File | Changes |
|------|---------|
| `src-tauri/src/ide_integration.rs` | `CustomIDE` struct, `register_custom_ide`/`remove_custom_ide` commands, name/icon extraction, custom ID handling in all IDE commands |
| `src-tauri/src/lib.rs` | Registered new commands |
| `src/stores/ideStore.ts` | `addCustomIDE` method with file picker dialog |
| `src/components/settings/categories/IDESettings.tsx` | Add Custom IDE button, Remove X button |
| `src/components/settings/categories/IDESettings.css` | Dashed orange button style, red hover X button |

## Verification

✅ Tested on macOS with non-registry editor
✅ Name extracted correctly from Info.plist
✅ Icon rendered at 32x32 resolution
✅ Custom IDE appears in dropdown and settings grid
✅ Remove button works and refreshes UI
✅ Launch via `open -a` succeeds

## Future Considerations

- Windows icon extraction (currently no icon on Windows custom IDEs)
- CLI detection for custom IDEs (currently registry-only CLI paths)
- Export/import custom IDE registry across machines

## Why This Pattern Matters

**Extensibility without updates**: Users can add any editor immediately without waiting for Quack releases.

**Zero backend dependency**: No API calls, no cloud registry. Everything local.

**Seamless UX**: Custom IDEs behave identically to registry IDEs in all UI contexts.

**Reusable pattern**: This "native file picker → metadata extraction → JSON storage → UI integration" workflow can be applied to other extensibility needs (custom tools, custom agents, etc.).
