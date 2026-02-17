# Node.js Sidecar Fix Summary

## Issue Reported
On Mac Intel without Node.js installed, the application shows:
```
Error: Node.js executable not found. Please install Node.js or ensure it's in your PATH.
```

## Root Cause Analysis

The original implementation had a **critical logic error** in the Node.js path resolution:

1. **Static caching**: The code used a static `Lazy<Option<PathBuf>>` that cached the Node.js path on first use
2. **Wrong fallback logic**: When in production mode, if the sidecar was not found, it fell back to `get_node_executable()` which read from the static cache
3. **The cache didn't check for sidecar**: The cached function `find_node_executable_internal()` only searched for system Node.js, NOT the bundled sidecar
4. **Result**: On Mac Intel without Node.js, the sidecar path was never properly resolved, even though it was bundled in the app

## Fixes Implemented

### 1. Removed Static Caching ❌ → ✅
**Before:**
```rust
static NODE_EXECUTABLE_CACHE: Lazy<Option<PathBuf>> = Lazy::new(|| {
    find_node_executable_internal() // This never checked sidecar!
});
```

**After:**
```rust
// No static cache - resolve path dynamically based on production/dev mode
fn find_system_node_executable() -> Option<PathBuf> {
    // Searches system paths only (fallback)
}
```

### 2. Improved Path Resolution Logic ✅

**New Strategy:**
```rust
let is_production = !cfg!(debug_assertions);

let node_path = if is_production {
    // 1. Try bundled sidecar FIRST
    match app.path().resolve(
        format!("binaries/{}", sidecar_name),
        BaseDirectory::Resource
    ) {
        Ok(sidecar_path) if sidecar_path.exists() => {
            log::info!("[SDK] ✅ Found bundled Node.js sidecar");
            Some(sidecar_path)
        }
        _ => {
            // 2. Fallback to system Node.js if sidecar not found
            log::warn!("[SDK] ⚠️ Sidecar not found, falling back to system");
            find_system_node_executable()
        }
    }
} else {
    // Development mode: Use system Node.js directly (faster)
    find_system_node_executable()
};
```

### 3. Enhanced Logging 📝

Added detailed logging at every step:
- ✅ Mode detection (production vs development)
- ✅ Architecture detection (aarch64 vs x86_64)
- ✅ Sidecar path resolution attempts
- ✅ Fallback triggers
- ✅ Success/failure indicators (✅, ⚠️, ❌)

Example logs:
```
[SDK] Looking for Node.js executable...
[SDK] Mode: production, Architecture: x86_64
[SDK] Looking for sidecar binary: node-sidecar-x86_64-apple-darwin
[SDK] Resolved sidecar path: "/Applications/Quack.app/Contents/Resources/binaries/node-sidecar-x86_64-apple-darwin"
[SDK] ✅ Found bundled Node.js sidecar at: ...
[SDK] Using Node.js at: ...
```

### 4. Better Error Messages 💬

**Production (sidecar should be present):**
```
"Node.js executable not found. The bundled Node.js sidecar could not be located. Please reinstall the application."
```

**Development (system Node.js needed):**
```
"Node.js executable not found. Please install Node.js or ensure it's in your PATH."
```

## Verification Checklist

- ✅ Binaries exist and have correct permissions (`-rwxr-xr-x`)
  - `node-sidecar-aarch64-apple-darwin` (53MB) - Apple Silicon
  - `node-sidecar-x86_64-apple-darwin` (58MB) - Intel Macs
- ✅ Binaries are valid Mach-O executables
  - `node-sidecar-aarch64-apple-darwin: Mach-O 64-bit executable arm64`
  - `node-sidecar-x86_64-apple-darwin: Mach-O 64-bit executable x86_64`
- ✅ `tauri.conf.json` includes binaries in `externalBin`
- ✅ `Entitlements.plist` has correct permissions:
  - `com.apple.security.cs.allow-jit` = true
  - `com.apple.security.cs.disable-library-validation` = true
  - `com.apple.security.app-sandbox` = false
- ✅ Rust code properly resolves architecture-specific binary
- ✅ Logging is comprehensive for debugging
- ✅ Error messages are clear and actionable

## Testing Strategy

### 1. Development Mode Test
```bash
npm run tauri:dev
```
Expected: Uses system Node.js (if available), clear error if not

### 2. Production Build Test
```bash
npm run tauri:build
```
Expected: Creates `.app` bundle with embedded sidecar binaries

### 3. Production Test on Clean Machine
1. Install the `.dmg` on a Mac Intel WITHOUT Node.js
2. Open Quack
3. Try to use the AI Assistant
4. Expected: Should work using bundled sidecar, no error about missing Node.js

### 4. Verify Bundle Contents
```bash
cd src-tauri/target/release/bundle/macos/
ls -la Quack.app/Contents/Resources/binaries/
```
Expected: Should show `node-sidecar-x86_64-apple-darwin` or `node-sidecar-aarch64-apple-darwin`

## Files Modified

1. **`src-tauri/src/claude_cli.rs`**
   - Removed static caching (`NODE_EXECUTABLE_CACHE`)
   - Renamed `find_node_executable_internal()` → `find_system_node_executable()`
   - Completely rewrote sidecar resolution logic in `send_message_via_sdk_streaming()`
   - Added comprehensive logging
   - Improved error messages

2. **`NODE_SIDECAR_IMPLEMENTATION.md`**
   - Updated documentation to reflect new architecture
   - Added notes about removed caching
   - Enhanced error handling section

## Known Issues

1. **Frontend Build Error**: There's a separate Vite build error (`crypto.hash is not a function`) that needs to be addressed independently
2. **Code Signing**: Binaries may need to be signed for distribution on macOS (not blocking for testing)

## Next Steps

1. ✅ **Completed**: Core sidecar implementation and fixes
2. ⏳ **Pending**: Test production build on Mac Intel without Node.js
3. ⏳ **Pending**: Fix frontend build error (separate issue)
4. ⏳ **Pending**: Code signing for production distribution

## Conclusion

The Node.js sidecar integration is now **functionally complete** with proper:
- ✅ Dynamic path resolution (no caching bugs)
- ✅ Production/development mode handling
- ✅ Architecture-specific binary selection
- ✅ Comprehensive logging for debugging
- ✅ Clear, actionable error messages
- ✅ Proper fallback to system Node.js

The implementation should now work correctly on Mac Intel machines without Node.js installed, as long as the production build properly includes the sidecar binaries in the final `.app` bundle.

---

**Generated**: 2024
**Author**: Jack (Quack Agency Product Manager) 🦆
**Status**: Ready for testing
