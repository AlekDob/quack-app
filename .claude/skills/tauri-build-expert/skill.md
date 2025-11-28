# Tauri Build Expert

Expert guide for building and releasing Tauri desktop applications with focus on understanding Claude Code environment limitations and real-world build processes.

## 🎯 When to Use This Skill

Use this skill when:
- Building Tauri applications for production
- Debugging build failures
- Creating release packages (DMG, App Bundle, etc.)
- Understanding environment differences between Claude Code and local system
- Troubleshooting Rust/Cargo build issues
- Optimizing build performance and bundle size

## ⚠️ CRITICAL: Understanding Build Environments

### Claude Code Environment (Sandbox)
**What Claude Code CAN do:**
- ✅ Execute Node.js/npm commands
- ✅ Run TypeScript compilation
- ✅ Execute Vite build
- ✅ Verify file existence and structure
- ✅ Read build logs and artifacts
- ✅ Analyze bundle sizes

**What Claude Code CANNOT do:**
- ❌ Execute Rust/Cargo commands
- ❌ Install system-level dependencies (brew, apt, etc.)
- ❌ Run Docker commands
- ❌ Execute platform-specific build tools
- ❌ Sign or notarize macOS applications
- ❌ Test the built application

### Local User Environment
**What runs on user's machine:**
- ✅ Full Rust/Cargo toolchain
- ✅ Tauri CLI with all features
- ✅ Platform-specific build tools
- ✅ Code signing and notarization
- ✅ Complete build pipeline

## 🔍 Build Verification Strategy

### STEP 1: Check Existing Build Artifacts
**Before attempting any build, ALWAYS verify existing artifacts:**

```bash
# Check if previous builds exist
ls -la src-tauri/target/release/bundle/

# Check DMG files
ls -lh src-tauri/target/release/bundle/dmg/

# Check macOS app bundles
ls -lh src-tauri/target/release/bundle/macos/
```

**If artifacts exist:** The user likely has Rust installed and working builds.
**If directory doesn't exist:** This is likely the first build attempt.

### STEP 2: Verify Dependencies (Read-Only)
**Check dependency configuration without executing:**

```bash
# Read package.json for build scripts
cat package.json | grep -A 5 '"build'

# Read Cargo.toml for Rust configuration
cat src-tauri/Cargo.toml | head -20

# Check Tauri config
cat src-tauri/tauri.conf.json
```

### STEP 3: Frontend Build (Claude Code CAN Execute)
**This part can be safely executed in Claude Code:**

```bash
# Clean previous artifacts
npm run clean

# Prepare Node SDK (if applicable)
npm run prepare-node-sdk

# Build frontend
npm run build:secure
# or
npm run build
```

**Expected output:**
- TypeScript compilation success
- Vite build completion
- Bundle size reports
- Gzip/Brotli compression stats

### STEP 4: Backend Build (User MUST Execute)
**This part CANNOT be executed by Claude Code - guide user instead:**

```markdown
⚠️ **Action Required in Your Terminal:**

Please run this command in your local terminal:

\`\`\`bash
npm run tauri:build
\`\`\`

or for specific architectures:

\`\`\`bash
# For Apple Silicon (M1/M2/M3)
npm run tauri:build

# For Intel Macs
npm run tauri:build:intel

# For Universal Binary
npm run tauri:build:universal
\`\`\`

**What to expect:**
1. Frontend build (TypeScript + Vite) - ~30 seconds
2. Rust compilation - **5-10 minutes** (first time)
3. Bundle creation - ~1-2 minutes
4. Optimization scripts - ~30 seconds

**Total time:** 7-13 minutes for first build, 2-4 minutes for subsequent builds.
```

## 📊 Build Verification Checklist

After the user completes the build, verify artifacts:

```bash
# 1. Check build directory structure
tree src-tauri/target/release/bundle/ -L 2

# 2. Verify DMG size and creation date
ls -lh src-tauri/target/release/bundle/dmg/*.dmg

# 3. Verify App Bundle
ls -lh src-tauri/target/release/bundle/macos/*.app

# 4. Check binary size
ls -lh src-tauri/target/release/[app-name]

# 5. Verify bundle includes all resources
ls -la src-tauri/target/release/bundle/macos/*.app/Contents/
```

## 🚨 Common Build Issues & Solutions

### Issue 1: "cargo: command not found"
**Symptom:** Error when running `npm run tauri:build` in Claude Code

**Root Cause:** Claude Code environment doesn't have Rust/Cargo

**Solution:**
```markdown
✅ **This is NORMAL behavior!**

Claude Code cannot execute Rust/Cargo commands. This error means:
- The command failed in Claude Code's sandbox
- It does NOT mean Rust is missing from your Mac

**Action:** Ask user to run the build command in their terminal instead.
```

### Issue 2: TypeScript Compilation Errors
**Symptom:** `tsc` fails with type errors

**Root Cause:** Usually incorrect prop types or missing dependencies

**Solution:**
```bash
# Read the error carefully
npm run build 2>&1 | grep "error TS"

# Fix the specific TypeScript error
# Example: Remove unsupported props, fix type definitions
```

### Issue 3: Build Artifacts Not Found
**Symptom:** Expected DMG/App not in bundle directory

**Root Cause:** Build failed silently or wrong target directory

**Solution:**
```bash
# Check for build errors in user's terminal output
# Verify target directory
ls -la src-tauri/target/

# Check if release or debug build
ls -la src-tauri/target/release/
ls -la src-tauri/target/debug/
```

### Issue 4: Large Bundle Size
**Symptom:** DMG > 200 MB, slow load times

**Root Cause:** Unoptimized dependencies, included dev dependencies

**Solution:**
```bash
# Analyze bundle composition
npm run build:analyze

# Check stats.html in dist/
open dist/stats.html

# Verify production build settings
cat vite.config.ts | grep -A 10 "build:"
```

## 📦 Build Configuration Best Practices

### package.json Scripts
```json
{
  "scripts": {
    "build": "npm run prepare-node-sdk && tsc -b && vite build",
    "build:secure": "NODE_ENV=production npm run prepare-node-sdk && tsc -b && vite build --minify esbuild",
    "build:analyze": "npm run build && echo 'Bundle analysis at: dist/stats.html'",
    "tauri:build": "npm run build:secure && cargo tauri build && ./scripts/optimize-bundle.sh",
    "tauri:build:intel": "npm run build:secure && cargo tauri build --target x86_64-apple-darwin",
    "tauri:build:universal": "npm run build:secure && cargo tauri build --target universal-apple-darwin"
  }
}
```

### Cargo.toml Release Profile
```toml
[profile.release]
opt-level = "z"        # Optimize for size and performance
lto = true             # Link Time Optimization
codegen-units = 1      # Single codegen unit for better optimization
strip = true           # Strip debug symbols
panic = "abort"        # Smaller panic handler
```

### Vite Build Optimization
```typescript
export default defineConfig({
  build: {
    minify: 'esbuild',
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'xterm': ['@xterm/xterm', '@xterm/addon-fit'],
          'monaco-editor': ['@monaco-editor/react', 'monaco-editor']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});
```

## 🎯 Build Process Communication

### WRONG Approach ❌
```markdown
Let me build the Tauri app...
*executes npm run tauri:build*
Error: cargo: command not found
**Rust is not installed! Please install Rust.**
```

### CORRECT Approach ✅
```markdown
Let me verify the build configuration and guide you through the build process.

*checks for existing build artifacts*
*verifies package.json and Cargo.toml*
*executes frontend build only*

✅ Frontend build completed successfully!

⚠️ **Action Required:**
The Tauri backend build requires Rust/Cargo which must run in your local terminal.

Please execute in your terminal:
\`npm run tauri:build\`

Expected time: 5-10 minutes (first build), 2-4 minutes (subsequent builds)

Let me know when it completes so I can verify the artifacts!
```

## 🔄 Build Workflow Summary

1. **Preparation**
   - Check existing artifacts
   - Verify configuration files
   - Clean previous builds (optional)

2. **Frontend Build** (Claude Code executes)
   - Install dependencies
   - TypeScript compilation
   - Vite build
   - Generate optimized bundles

3. **Backend Build** (User executes)
   - Guide user to run `npm run tauri:build`
   - Explain expected duration
   - Describe what to look for in output

4. **Verification** (Claude Code executes)
   - Check artifact existence
   - Verify file sizes
   - Review bundle structure
   - Confirm optimization applied

5. **Testing** (User executes)
   - Guide user to test the .app or .dmg
   - Ask for feedback on functionality
   - Verify all features work

## 📝 Build Success Criteria

A successful build should have:

- ✅ **Frontend artifacts:**
  - `dist/` directory with optimized JS/CSS
  - Gzip/Brotli compressed files
  - stats.html for bundle analysis

- ✅ **Backend artifacts:**
  - DMG file in `src-tauri/target/release/bundle/dmg/`
  - App bundle in `src-tauri/target/release/bundle/macos/`
  - Binary in `src-tauri/target/release/`

- ✅ **Size optimization:**
  - Total bundle < 200 MB (unless heavy dependencies)
  - Gzip reduction > 70%
  - No debug symbols in release

- ✅ **Functional testing:**
  - App launches without errors
  - All features work as expected
  - No console errors
  - Performance is acceptable

## 🎓 Key Learnings

1. **Never assume environment capabilities** - Always verify what can run where
2. **Check artifacts first** - Existing builds indicate working setup
3. **Guide, don't execute** - For Rust/Cargo, guide the user instead of failing
4. **Communicate clearly** - Explain what you can/can't do and why
5. **Verify incrementally** - Check each build stage before proceeding

## 🍎 macOS Code Signing & Notarization

### Overview

Starting with macOS 10.15 (Catalina), apps distributed outside the Mac App Store MUST be:
1. **Code Signed** with a Developer ID Application certificate
2. **Notarized** by Apple (uploaded and scanned)
3. **Stapled** with the notarization ticket

Without this, Gatekeeper will block the app with "cannot be opened because the developer cannot be verified".

### Prerequisites

1. **Apple Developer Account** ($99/year) - Required for Developer ID certificate
2. **Developer ID Application Certificate** - For code signing
3. **App-Specific Password** - For automated notarization submissions
4. **Keychain Access** - To manage certificates

### Step 1: Create Developer ID Certificate

1. Go to [Apple Developer Portal](https://developer.apple.com/account/resources/certificates/list)
2. Click "+" to create new certificate
3. Select **"Developer ID Application"** (NOT Distribution!)
4. Create a CSR (Certificate Signing Request):
   - Open **Keychain Access** on Mac
   - Menu: Keychain Access > Certificate Assistant > Request a Certificate from a Certificate Authority
   - Enter your email, select "Saved to disk"
   - Save the `.certSigningRequest` file
5. Upload CSR to Apple Portal
6. Download and double-click the certificate to install

### Step 2: Create App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign In > App-Specific Passwords > Generate
3. Name it "Tauri Notarization" or similar
4. **SAVE THIS PASSWORD** - You won't see it again!

### Step 3: Configure Environment

Create or update `.env` file (add to `.gitignore`!):

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: YOUR NAME (TEAM_ID)"
export APPLE_ID="your@email.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password
export APPLE_TEAM_ID="FC38UVV3V3"  # Your 10-character Team ID
```

### Step 4: Configure Tauri for Signing

Update `src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "macOS": {
      "entitlements": "Entitlements.plist",
      "signingIdentity": "Developer ID Application: YOUR NAME (TEAM_ID)",
      "hardenedRuntime": true,
      "minimumSystemVersion": "10.15"
    }
  }
}
```

Create `src-tauri/Entitlements.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.automation.apple-events</key>
    <true/>
</dict>
</plist>
```

### Step 5: Sign All Binaries

**CRITICAL:** Apple requires ALL Mach-O binaries to be signed, including:
- `.dylib` files (dynamic libraries)
- `.node` files (Node.js native addons)
- Executables inside the bundle (ripgrep, sidecars)
- Native libraries inside JAR files (if using JVM)

**Sign function with hardened runtime:**
```bash
codesign --force --options runtime --timestamp \
  --sign "Developer ID Application: YOUR NAME (TEAM_ID)" \
  "$BINARY_PATH"
```

**Sign with entitlements (for main executable and sidecars):**
```bash
codesign --force --options runtime --timestamp \
  --entitlements "Entitlements.plist" \
  --sign "Developer ID Application: YOUR NAME (TEAM_ID)" \
  "$APP_PATH/Contents/MacOS/YourApp"
```

### Step 6: Submit for Notarization

```bash
# Create ZIP for submission
cd src-tauri/target/release/bundle/macos
ditto -c -k --keepParent YourApp.app YourApp.zip

# Submit and wait
xcrun notarytool submit YourApp.zip \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait
```

### Step 7: Staple the Ticket

After notarization succeeds:
```bash
xcrun stapler staple YourApp.app
```

### Step 8: Verify

```bash
# Verify signature
codesign --verify --deep --strict --verbose=2 YourApp.app

# Verify Gatekeeper acceptance
spctl -a -vvv -t install YourApp.app
```

Expected output: `YourApp.app: accepted source=Notarized Developer ID`

### Step 9: Create Notarized DMG

```bash
# Create DMG
hdiutil create -volname "YourApp" -srcfolder YourApp.app \
  -ov -format UDZO YourApp.dmg

# Sign DMG
codesign --force --sign "Developer ID Application: YOUR NAME (TEAM_ID)" YourApp.dmg

# Submit DMG for notarization
xcrun notarytool submit YourApp.dmg \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID" \
  --wait

# Staple DMG
xcrun stapler staple YourApp.dmg
```

## ⏱️ Notarization Timing

| Scenario | Expected Time |
|----------|---------------|
| **First-time notarization** | 1-4 hours (Apple deep analysis) |
| **Subsequent releases** | 5-15 minutes |
| **During Apple outages** | Can be much longer |

**Check Apple System Status:** [developer.apple.com/system-status](https://developer.apple.com/system-status/)

## 🚨 Common Signing/Notarization Issues

### Issue: "errSecInternalComponent" when signing
**Cause:** Keychain is locked

**Solution:**
```bash
security unlock-keychain ~/Library/Keychains/login.keychain-db
```

### Issue: Notarization returns "Invalid"
**Cause:** Unsigned binaries in the bundle

**Solution:**
1. Get the full log:
```bash
xcrun notarytool log <submission-id> \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"
```
2. Sign ALL binaries listed in the log
3. Common culprits:
   - `.dylib` files from native Node modules (sharp, libvips)
   - `.node` files (native addons)
   - Binaries inside JAR files (JetBrains plugins with jansi)
   - Ripgrep binaries (`rg`, `ripgrep.node`)

### Issue: JAR files contain unsigned native libraries
**Cause:** Java libraries like jansi include native `.jnilib` files

**Solution:** Either remove the JAR or extract, sign, and repackage:
```bash
# Extract
unzip jansi.jar -d temp/
# Sign native libs
codesign --force --options runtime --timestamp \
  --sign "$SIGNING_IDENTITY" temp/org/fusesource/jansi/internal/native/Mac/*/libjansi.jnilib
# Repackage
cd temp && zip -r ../jansi.jar . && cd ..
```

### Issue: Notarization stuck "In Progress" for hours
**Cause:** First-time submissions from new developer accounts take longer

**Solution:** Wait. Apple performs deeper analysis on first submissions. Check status with:
```bash
xcrun notarytool info <submission-id> \
  --apple-id "$APPLE_ID" \
  --password "$APPLE_PASSWORD" \
  --team-id "$APPLE_TEAM_ID"
```

## 🤖 Automated Release Script

For production releases, use the automated script at `scripts/release-macos.sh`:

```bash
#!/bin/bash
# Complete macOS release automation

set -e
source .env

APP_NAME="YourApp"
APP_PATH="src-tauri/target/release/bundle/macos/$APP_NAME.app"

echo "=== Step 1: Build ==="
npm run tauri:build

echo "=== Step 2: Remove problematic plugins ==="
# Remove JetBrains plugin (contains unsigned JAR natives)
rm -rf "$APP_PATH/Contents/Resources/node-sdk/node_modules/@anthropic-ai/claude-agent-sdk/vendor/claude-code-jetbrains-plugin"

echo "=== Step 3: Sign all binaries ==="
# Sign .dylib files
find "$APP_PATH" -type f -name "*.dylib" -exec codesign --force --options runtime --timestamp --sign "$APPLE_SIGNING_IDENTITY" {} \;

# Sign .node files
find "$APP_PATH" -type f -name "*.node" -exec codesign --force --options runtime --timestamp --sign "$APPLE_SIGNING_IDENTITY" {} \;

# Sign ripgrep
find "$APP_PATH" -path "*ripgrep*" -type f \( -name "rg" -o -name "*.node" \) -exec codesign --force --options runtime --timestamp --sign "$APPLE_SIGNING_IDENTITY" {} \;

# Sign all Mach-O executables
find "$APP_PATH" -type f -perm +111 | while read -r file; do
    if file "$file" 2>/dev/null | grep -q "Mach-O"; then
        codesign --force --options runtime --timestamp --sign "$APPLE_SIGNING_IDENTITY" "$file" 2>/dev/null || true
    fi
done

# Sign sidecars with entitlements
codesign --force --options runtime --timestamp --entitlements src-tauri/Entitlements.plist --sign "$APPLE_SIGNING_IDENTITY" "$APP_PATH/Contents/MacOS/node-sidecar" 2>/dev/null || true
codesign --force --options runtime --timestamp --entitlements src-tauri/Entitlements.plist --sign "$APPLE_SIGNING_IDENTITY" "$APP_PATH/Contents/MacOS/$APP_NAME"

# Sign app bundle
codesign --force --options runtime --timestamp --entitlements src-tauri/Entitlements.plist --sign "$APPLE_SIGNING_IDENTITY" "$APP_PATH"

echo "=== Step 4: Verify ==="
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
spctl -a -vvv -t install "$APP_PATH"

echo "=== Step 5: Submit for notarization ==="
cd "$(dirname "$APP_PATH")"
ditto -c -k --keepParent "$APP_NAME.app" "$APP_NAME.zip"
xcrun notarytool submit "$APP_NAME.zip" --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait

echo "=== Step 6: Staple ==="
xcrun stapler staple "$APP_NAME.app"

echo "=== Step 7: Create DMG ==="
hdiutil create -volname "$APP_NAME" -srcfolder "$APP_NAME.app" -ov -format UDZO "$APP_NAME.dmg"
codesign --force --sign "$APPLE_SIGNING_IDENTITY" "$APP_NAME.dmg"
xcrun notarytool submit "$APP_NAME.dmg" --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" --team-id "$APPLE_TEAM_ID" --wait
xcrun stapler staple "$APP_NAME.dmg"

echo "=== Done! ==="
echo "Notarized DMG ready at: $(pwd)/$APP_NAME.dmg"
```

## 📋 Release Checklist

Before each release:
- [ ] Update version in `package.json` and `tauri.conf.json`
- [ ] Run `npm run tauri:build`
- [ ] Remove problematic plugins (JetBrains, etc.)
- [ ] Sign ALL binaries (dylib, node, Mach-O)
- [ ] Sign main executable with entitlements
- [ ] Sign app bundle
- [ ] Verify signature: `codesign --verify --deep --strict`
- [ ] Submit for notarization
- [ ] Wait for "Accepted" status
- [ ] Staple ticket to app
- [ ] Create and notarize DMG
- [ ] Test on clean Mac (without developer tools)

## 📚 Related Skills

- `/frontend-dev-guidelines` - Frontend build optimization
- `/claude-agent-sdk-expert` - Agent SDK integration in Tauri
- `/ui-styling` - Component styling and theming
- `/xterm-terminal-expert` - Terminal integration troubleshooting

---

**Remember:** Claude Code is a powerful assistant but has limitations. Understanding these limitations and working WITH them (not against them) leads to better collaboration and successful builds!
