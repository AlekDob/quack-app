# Quack - macOS Guide

Complete guide for developing, building, and distributing Quack on macOS.

## System Requirements

- macOS 11 (Big Sur) or later
- Apple Silicon (M1/M2/M3/M4) or Intel (x86_64)
- Xcode Command Line Tools

## Prerequisites

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Install Tauri CLI
cargo install tauri-cli

# Install npm dependencies
npm install
cd src-tauri/node-sdk && npm install --production && cd ../..
```

### Cross-Architecture Targets (optional)

To build for Intel from Apple Silicon (or vice versa):

```bash
rustup target add x86_64-apple-darwin
rustup target add universal-apple-darwin
```

## Development

```bash
npm run dev:mac
```

This starts the Tauri dev server with hot reload on `http://localhost:5174`.

## Build Commands

### Standard Build (current architecture)

```bash
npm run build:mac
```

Builds for the architecture of your current Mac. Output in `src-tauri/target/release/bundle/`.

### Intel Only (x86_64)

```bash
npm run build:mac:intel
```

For Intel Macs (2017-2020). Requires `rustup target add x86_64-apple-darwin`.

Output in `src-tauri/target/x86_64-apple-darwin/release/bundle/`.

### Universal (Intel + Apple Silicon)

```bash
npm run build:mac:universal
```

Single binary for all Macs. Requires both cross-architecture targets installed.

Output in `src-tauri/target/universal-apple-darwin/release/bundle/`.

### Debug Build

```bash
npm run build:mac:debug
```

Faster compilation, larger binary, includes debug symbols.

### Release Build (with signing and notarization)

```bash
npm run build:mac:release
npm run build:mac:release:universal
```

Builds, signs, and notarizes the app. Requires Apple Developer account.

## Build Comparison

| Build | Time | .dmg Size | .app Size | Compatibility |
|-------|------|-----------|-----------|---------------|
| Standard | ~5-8 min | ~98 MB | ~123 MB | Current arch only |
| Intel | ~5-8 min | ~98 MB | ~126 MB | Intel only |
| Universal | ~10-15 min | ~180-200 MB | ~250 MB | Intel + Apple Silicon |
| Debug | ~2-3 min | N/A | ~300 MB | Current arch only |

All sizes are after automatic bundle optimization.

## Bundle Optimization

All build commands automatically run `scripts/optimize-bundle.sh`, which removes:

- Ripgrep binaries for other platforms (~43 MB)
- JetBrains plugin (~12 MB)
- Duplicate images (~22 MB)
- Source maps (~10 MB)

Total savings: ~97 MB per build.

To run manually:

```bash
npm run optimize-bundle:mac
```

## Release Workflow

```bash
# Prepare release (merge main into production)
npm run release:mac:prepare

# Publish (push production branch, triggers GitHub Actions)
npm run release:mac:publish
```

## Distribution

### Installing (End Users)

1. Download the `.dmg` file
2. Open the DMG and drag Quack to the Applications folder
3. On first launch, macOS may show a security warning

### Gatekeeper Warning

If macOS shows "Quack cannot be opened because the developer cannot be verified":

**Option 1 (recommended):**
1. Right-click Quack.app
2. Select "Open" from the context menu
3. Click "Open" in the dialog
4. The app is remembered as safe for future launches

**Option 2 (terminal):**
```bash
xattr -d com.apple.quarantine /Applications/Quack.app
```

### Code Signing (Developer)

With an Apple Developer account ($99/year):

```bash
# Find your signing identity
security find-identity -v -p codesigning

# Set environment variable
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"

# Build with signing and notarization
npm run build:mac:release
```

## Troubleshooting

### "target not found"

```bash
rustup target add x86_64-apple-darwin
```

### Slow builds

First build downloads and compiles all Rust dependencies (~15-20 min). Subsequent builds are much faster. Use `npm run build:mac:debug` for faster iteration.

### Clean cache

```bash
npm run clean       # Remove dist and Vite cache
npm run clean:all   # Remove everything including Rust target
```

### "Unable to find utility SetFile"

```bash
xcode-select --install
```

### DMG won't mount

```bash
xattr -d com.apple.quarantine path/to/Quack.dmg
```

## npm Scripts Reference

| Script | Description |
|--------|-------------|
| `dev:mac` | Start dev server with hot reload |
| `build:mac` | Production build (current arch) |
| `build:mac:intel` | Production build (Intel) |
| `build:mac:universal` | Production build (Universal) |
| `build:mac:debug` | Debug build |
| `build:mac:release` | Signed + notarized release |
| `build:mac:release:universal` | Signed + notarized universal release |
| `optimize-bundle:mac` | Optimize bundle size |
| `release:mac:prepare` | Prepare release branch |
| `release:mac:publish` | Push to trigger CI/CD |
