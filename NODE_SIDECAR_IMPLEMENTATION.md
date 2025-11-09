# Node.js Sidecar Implementation for Quack

## Problem Solved
The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) requires Node.js to be installed on the user's system. When users install the Tauri app (.dmg) on a machine without Node.js, the AI Assistant fails with an error. This implementation bundles Node.js as a Tauri sidecar binary, making the app completely self-contained.

## Implementation Details

### 1. Node.js Sidecar Binary Creation

#### Structure:
```
node-sidecar/
├── index.js       # Wrapper script that executes the actual SDK script
├── package.json   # Build configuration with pkg
└── (binaries generated in src-tauri/binaries/)
```

#### Wrapper Script (`node-sidecar/index.js`):
- Simple Node.js script that acts as a proxy
- Receives the path to `stream-claude.js` as first argument
- Spawns a child process with proper environment setup
- Forwards all stdio and exit codes

#### Build Process:
Using `@yao-pkg/pkg` to compile Node.js into standalone executables:

```bash
cd node-sidecar
npm install
npm run build:all  # Builds both architectures
```

This creates:
- `src-tauri/binaries/node-sidecar-aarch64-apple-darwin` (~53MB) - Apple Silicon
- `src-tauri/binaries/node-sidecar-x86_64-apple-darwin` (~58MB) - Intel Macs

### 2. Tauri Configuration

#### `tauri.conf.json`:
```json
{
  "bundle": {
    "externalBin": [
      "binaries/node-sidecar"
    ],
    "resources": [
      "../images",
      "../public",
      "node-sdk"  // Still needed for stream-claude.js
    ]
  }
}
```

#### `capabilities/default.json`:
```json
{
  "permissions": [
    "shell:default",
    "shell:allow-execute",
    "shell:allow-spawn",
    {
      "identifier": "shell:allow-execute",
      "allow": [{
        "name": "binaries/node-sidecar",
        "sidecar": true,
        "args": true
      }]
    }
  ]
}
```

### 3. Rust Backend Integration

#### Modified `claude_cli.rs`:
- **Removed static caching** to ensure proper sidecar detection on each invocation
- Added conditional logic for development vs production
- In development: Uses system Node.js (for faster iteration)
- In production: Prioritizes bundled sidecar, then falls back to system Node.js if not found
- **Enhanced logging** with detailed architecture and mode information for debugging
- **Better error messages** that differentiate between production and development failures

Key changes:
```rust
// Production mode: Try bundled sidecar first
let is_production = !cfg!(debug_assertions);
let sidecar_name = if cfg!(target_arch = "aarch64") {
    "node-sidecar-aarch64-apple-darwin"
} else if cfg!(target_arch = "x86_64") {
    "node-sidecar-x86_64-apple-darwin"
} else {
    "node-sidecar" // Fallback
};

let node_path = if is_production {
    // Try to resolve sidecar from app resources
    match app.path().resolve(
        format!("binaries/{}", sidecar_name),
        BaseDirectory::Resource
    ) {
        Ok(sidecar_path) if sidecar_path.exists() => {
            log::info!("[SDK] ✅ Found bundled Node.js sidecar at: {:?}", sidecar_path);
            Some(sidecar_path)
        }
        _ => {
            log::warn!("[SDK] ⚠️ Sidecar not found, falling back to system Node.js");
            find_system_node_executable()
        }
    }
} else {
    // Dev mode - use system Node.js directly
    find_system_node_executable()
};
```

#### Enhanced Error Handling:
- **Production errors** suggest reinstalling the app if sidecar is missing
- **Development errors** suggest installing Node.js or adding it to PATH
- Detailed logging at every step for troubleshooting
- Architecture-specific error messages (aarch64 vs x86_64)

## Build and Deployment

### Development Mode:
```bash
npm run tauri:dev
```
- Uses system Node.js for faster development
- No sidecar overhead
- Hot reload enabled

### Production Build:
```bash
npm run tauri:build
```
- Includes Node.js sidecar binaries
- Fully self-contained .dmg
- Works on any macOS system without Node.js

### File Size Impact:
- Each architecture adds ~50-60MB to the bundle
- Universal build would include both binaries (~110MB total)
- Acceptable tradeoff for zero external dependencies

## Testing

### To test sidecar in production build:
1. Build the app: `npm run tauri:build`
2. Install the .dmg on a clean machine without Node.js
3. Open Quack and test the AI Assistant feature
4. Should work without requiring Node.js installation

### Verification Steps:
1. Check bundle contents:
   ```bash
   cd src-tauri/target/release/bundle/macos/
   ls -la Quack.app/Contents/Resources/binaries/
   ```
   Should show the appropriate `node-sidecar-*` binary

2. Test on clean system:
   - Use a VM or test Mac without Node.js
   - Install and run Quack
   - AI Assistant should work immediately

## Future Improvements

1. **Binary Size Optimization**:
   - Investigate using smaller Node.js builds
   - Consider using Deno or Bun as alternatives
   - Implement compression for the sidecar

2. **Cross-Platform Support**:
   - Add Windows binaries: `node-sidecar-x86_64-pc-windows-msvc.exe`
   - Add Linux binaries: `node-sidecar-x86_64-unknown-linux-gnu`

3. **Update Mechanism**:
   - Separate update channel for Node.js sidecar
   - Allow updating sidecar without full app update

4. **Performance**:
   - Cache sidecar process for reuse
   - Implement connection pooling for multiple SDK calls

## Troubleshooting

### Common Issues:

1. **"Sidecar not found" in production**:
   - Ensure binaries are in `src-tauri/binaries/`
   - Check that binary names match architecture
   - Verify `externalBin` in `tauri.conf.json`

2. **Permission errors**:
   - Ensure shell permissions in `capabilities/default.json`
   - Check binary has execute permissions: `chmod +x node-sidecar-*`

3. **SDK script not found**:
   - Verify `node-sdk` is in resources
   - Check `stream-claude.js` path resolution

4. **Memory/CPU usage**:
   - Each sidecar spawn uses ~50MB RAM
   - Consider implementing process pooling for heavy usage

## Architecture Decision Record (ADR)

### Decision:
Bundle Node.js as a Tauri sidecar binary using pkg

### Alternatives Considered:
1. **WebAssembly Node.js**: Too experimental, performance concerns
2. **Rewrite SDK in Rust**: Too much maintenance, loses SDK updates
3. **Require Node.js installation**: Poor user experience
4. **Embed V8 directly**: Complex, large binary size

### Outcome:
- ✅ Zero external dependencies
- ✅ Works on any macOS system
- ✅ Maintains compatibility with Claude Agent SDK
- ✅ Easy to update independently
- ⚠️ Increases bundle size by ~50-60MB per architecture
- ⚠️ Slight startup overhead for sidecar process

### Conclusion:
The sidecar approach provides the best balance of user experience, maintainability, and compatibility. The increased bundle size is acceptable for a desktop application that aims to be truly self-contained.