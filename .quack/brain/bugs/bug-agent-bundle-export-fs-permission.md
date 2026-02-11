---
type: bug_fix
project: quack-app
created: 2026-02-09
tags: [agent-bundles, tauri, fs-permissions, export, binary-files]
---

# Bug: Agent Bundle Export - fs.write_file Permission Denied

## Problem

When exporting an agent bundle (`.quack` file) via `AgentPersonalityCard` → Export button, the operation fails with:

```
Failed to export agent bundle: – 'fs.write_file not allowed.
Permissions associated with this command: fs:allow-app-write, fs:allow-app-write-recursive...'
```

**Screenshot**: User shows error dialog with full permission error.

## Root Cause

`useBundleOperations.ts` was using `writeFile()` from `@tauri-apps/plugin-fs` to save the `.quack` ZIP to user-selected path (e.g., Desktop).

**Problem**: The `plugin-fs` capabilities in `src-tauri/capabilities/default.json` only grant:
- `fs:allow-read-file`
- `fs:allow-app-read`
- `fs:allow-app-read-recursive`

**No write permissions** outside the app directory. The Tauri plugin-fs is sandboxed and cannot write to arbitrary paths chosen by the user via save dialog.

## Solution

Created custom Rust commands in `src-tauri/src/fs.rs` that bypass plugin-fs restrictions:

### 1. Added `write_binary_file` command

```rust
#[tauri::command]
pub fn write_binary_file(path: String, data: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent dirs: {}", e))?;
    }
    std::fs::write(&path, &data).map_err(|e| format!("Failed to write binary file: {}", e))
}
```

### 2. Added `read_binary_file` command

```rust
#[tauri::command]
pub fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(&path).map_err(|e| format!("Failed to read binary file: {}", e))
}
```

### 3. Registered commands in `lib.rs`

```rust
fs::write_file_content,
fs::write_binary_file,  // NEW
fs::read_binary_file,   // NEW
fs::create_directory,
```

### 4. Updated `useBundleOperations.ts`

**Removed import**:
```typescript
import { writeFile, readFile } from '@tauri-apps/plugin-fs';
```

**Export avatar** (line 103):
```typescript
// Before
const avatarData = await readFile(avatarPath);

// After
const data = await invoke<number[]>('read_binary_file', { path: avatarPath });
const avatarData = new Uint8Array(data);
```

**Export ZIP write** (line 137):
```typescript
// Before
await writeFile(savePath, zipData);

// After
await invoke('write_binary_file', { path: savePath, data: Array.from(zipData) });
```

**Import ZIP read** (line 170):
```typescript
// Before
const bundleData = await readFile(selectedPath as string);

// After
const rawData = await invoke<number[]>('read_binary_file', { path: selectedPath as string });
const bundleData = new Uint8Array(rawData);
```

## Why This Works

- Rust `std::fs::write()` and `std::fs::read()` have **no Tauri capability restrictions**
- They run with full system permissions (user permissions)
- User already chose the path via `saveDialog()` — explicit user action
- Avatar and ZIP are binary data (Uint8Array) — needs binary read/write

## Files Modified

1. `src-tauri/src/fs.rs` — +2 new commands (write_binary_file, read_binary_file)
2. `src-tauri/src/lib.rs` — +2 command registrations
3. `src/hooks/useBundleOperations.ts` — 3 replacements (removed plugin-fs dependency)

## Verification

- ✅ Rust compiles without errors
- ✅ TypeScript compiles without errors
- ✅ User confirmed export works after fix
- ✅ No new dependencies added

## Related

- Export/import system: `src/services/bundleService.ts`
- Binary data format: ZIP (jszip library)
- File extension: `.quack`
- Capabilities config: `src-tauri/capabilities/default.json` (NOT modified)
