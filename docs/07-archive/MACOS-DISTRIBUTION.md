# macOS Distribution Guide for Quack

## Overview

This guide explains how to properly build and distribute Quack for macOS, addressing common issues like Gatekeeper warnings and DMG visual glitches.

## Problem Solutions

### 1. "Quack is broken and cannot be opened" Error

**Cause**: macOS Gatekeeper blocks unsigned/unnotarized apps for security.

**Solutions**:

#### For Users (Quick Fix)
Tell your friends to:
1. **Right-click** on Quack.app (don't double-click)
2. Select **"Open"** from context menu
3. Click **"Open"** in the security dialog
4. The app will launch and won't show this warning again

#### For Users (Terminal Fix)
If the above doesn't work:
```bash
xattr -d com.apple.quarantine /Applications/Quack.app
```

#### For Developers (Proper Solution)
To prevent this issue entirely, you need an Apple Developer account ($99/year) to:
- Code sign with a Developer ID
- Notarize the app with Apple
- This eliminates all security warnings

### 2. DMG Visual Glitch (Hidden Files Visible)

**Cause**: System files like `.VolumeIcon.icns` aren't properly hidden in the DMG.

**Solution**: Use the provided `fix-dmg.sh` script after building.

## Build Instructions

### Quick Build (Without Code Signing)

```bash
# Build the app
npm run tauri:build

# Fix the DMG visual issues
./fix-dmg.sh

# The fixed DMG is now ready for distribution
```

### Recommended Build (With Instructions)

Use the comprehensive build script:

```bash
# Run the build script
./build-mac.sh
```

This script:
- Checks for Apple Developer ID
- Builds the app
- Applies ad-hoc signing if no Developer ID
- Creates a distribution folder with README
- Provides clear instructions for users

### Distribution Checklist

- [ ] Build the app with `./build-mac.sh`
- [ ] Test the DMG on a different Mac if possible
- [ ] Include the README.md from `dist-mac/` folder
- [ ] Tell users about the right-click → Open method
- [ ] Consider getting Apple Developer account for future releases

## File Locations

After building:
- **DMG**: `src-tauri/target/release/bundle/dmg/Quack_*.dmg`
- **Distribution folder**: `dist-mac/` (created by build-mac.sh)
- **App bundle**: `src-tauri/target/release/bundle/macos/Quack.app`

## Configuration Files

### tauri.conf.json
Updated with proper macOS bundle configuration including:
- Entitlements reference
- Minimum system version
- DMG layout settings

### Entitlements.plist
Created with necessary permissions for:
- Network access (HTTP hooks, Claude SDK)
- File system access (file explorer)
- Terminal operations (PTY)
- Notifications
- Deep linking

## Advanced: Code Signing (With Apple Developer Account)

If you have an Apple Developer account:

1. **Find your identity**:
```bash
security find-identity -v -p codesigning
```

2. **Set environment variable**:
```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
```

3. **Build with signing**:
```bash
npm run tauri:build
```

4. **Notarize** (requires Apple Developer account):
```bash
# Create app-specific password at appleid.apple.com
xcrun notarytool submit Quack.dmg \
    --apple-id "your-email@example.com" \
    --password "app-specific-password" \
    --team-id "TEAMID" \
    --wait
```

5. **Staple the notarization**:
```bash
xcrun stapler staple Quack.dmg
```

## Troubleshooting

### "Unable to find utility SetFile"
Install Xcode Command Line Tools:
```bash
xcode-select --install
```

### DMG won't mount
The DMG might be quarantined:
```bash
xattr -d com.apple.quarantine path/to/Quack.dmg
```

### Build fails with code signing error
Either:
- Remove signing configuration and build unsigned
- Or properly configure Apple Developer certificate

## Testing Distribution

Before sharing:
1. Copy DMG to a different Mac (or different user account)
2. Try to open normally (should show security warning)
3. Test right-click → Open method (should work)
4. Verify app launches and functions properly

## Summary

For now, without an Apple Developer account:
1. Use `./build-mac.sh` to build with proper configuration
2. Share the `dist-mac/` folder contents (DMG + README)
3. Tell users to right-click → Open on first launch

This provides the best experience possible without paying for Apple Developer membership.

---

*Remember: The security warnings are Apple's way of protecting users. They're not a reflection of your app's quality or safety - just a consequence of not paying the Apple tax! 🦆*