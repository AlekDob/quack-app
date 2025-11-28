#!/bin/bash

# =============================================================================
# Quack - Complete macOS Release Script
# =============================================================================
# This script automates the entire release process:
# 1. Build the app with Tauri
# 2. Sign all binaries for notarization
# 3. Create ZIP and submit for notarization
# 4. Wait for Apple approval
# 5. Staple the ticket
# 6. Create signed DMG
#
# Usage: ./scripts/release-macos.sh
# =============================================================================

set -e

# Configuration
PROJECT_ROOT="/Users/alekdob/Desktop/Dev/Personal/quack-app"
APP_PATH="$PROJECT_ROOT/src-tauri/target/release/bundle/macos/Quack.app"
DMG_PATH="$PROJECT_ROOT/src-tauri/target/release/bundle/macos/Quack.dmg"
SIGNING_IDENTITY="Developer ID Application: ALEKSANDAR DOBROHOTOV (FC38UVV3V3)"
ENTITLEMENTS="$PROJECT_ROOT/src-tauri/Entitlements.plist"
KEYCHAIN_PROFILE="QuackNotarization"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                 🦆 Quack macOS Release Script                 ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

cd "$PROJECT_ROOT"

# ==== STEP 1: Build ====
echo -e "${YELLOW}[1/6] Building app with Tauri...${NC}"
npm run tauri:build

if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}ERROR: Build failed - Quack.app not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build completed${NC}"

# ==== STEP 2: Remove problematic JetBrains plugin ====
echo -e "${YELLOW}[2/6] Removing JetBrains plugin (contains unsigned JARs)...${NC}"
JETBRAINS_PATH="$APP_PATH/Contents/Resources/node-sdk/node_modules/@anthropic-ai/claude-agent-sdk/vendor/claude-code-jetbrains-plugin"
if [ -d "$JETBRAINS_PATH" ]; then
    rm -rf "$JETBRAINS_PATH"
    echo -e "${GREEN}✓ JetBrains plugin removed${NC}"
else
    echo -e "${GREEN}✓ JetBrains plugin not present${NC}"
fi

# ==== STEP 3: Sign all binaries ====
echo -e "${YELLOW}[3/6] Signing all binaries...${NC}"

# Unlock keychain
security unlock-keychain ~/Library/Keychains/login.keychain-db 2>/dev/null || true

# Sign function
sign_binary() {
    local file="$1"
    codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" "$file" 2>/dev/null || true
}

# Sign .dylib files
echo "  Signing .dylib files..."
find "$APP_PATH" -type f -name "*.dylib" -exec codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" {} \; 2>/dev/null || true

# Sign .node files
echo "  Signing .node files..."
find "$APP_PATH" -type f -name "*.node" -exec codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" {} \; 2>/dev/null || true

# Sign ripgrep binaries
echo "  Signing ripgrep binaries..."
find "$APP_PATH" -path "*ripgrep*" -type f -name "rg" -exec codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" {} \; 2>/dev/null || true

# Sign all Mach-O executables
echo "  Signing Mach-O executables..."
find "$APP_PATH" -type f -perm +111 2>/dev/null | while read -r file; do
    if file "$file" 2>/dev/null | grep -q "Mach-O"; then
        codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" "$file" 2>/dev/null || true
    fi
done

# Sign node-sidecar with entitlements
if [ -f "$APP_PATH/Contents/MacOS/node-sidecar" ]; then
    echo "  Signing node-sidecar..."
    codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" "$APP_PATH/Contents/MacOS/node-sidecar"
fi

# Sign main executable with entitlements
echo "  Signing main executable..."
codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" "$APP_PATH/Contents/MacOS/Quack"

# Sign the entire app bundle
echo "  Signing app bundle..."
codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" "$APP_PATH"

echo -e "${GREEN}✓ All binaries signed${NC}"

# ==== STEP 4: Verify signature ====
echo -e "${YELLOW}[4/6] Verifying signature...${NC}"
codesign --verify --deep --strict "$APP_PATH"
echo -e "${GREEN}✓ Signature verified${NC}"

# ==== STEP 5: Notarize ====
echo -e "${YELLOW}[5/6] Submitting for notarization (this may take several minutes)...${NC}"

# Create ZIP for notarization
cd "$(dirname "$APP_PATH")"
rm -f Quack.zip
ditto -c -k --keepParent Quack.app Quack.zip

# Submit for notarization
xcrun notarytool submit Quack.zip --keychain-profile "$KEYCHAIN_PROFILE" --wait

# Staple the ticket
echo "  Stapling ticket..."
xcrun stapler staple "$APP_PATH"

rm -f Quack.zip
echo -e "${GREEN}✓ Notarization completed and stapled${NC}"

# ==== STEP 6: Create DMG ====
echo -e "${YELLOW}[6/6] Creating DMG...${NC}"
rm -f "$DMG_PATH"

# Create DMG
hdiutil create -volname "Quack" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"

# Sign DMG
codesign --force --sign "$SIGNING_IDENTITY" "$DMG_PATH"

# Notarize DMG
echo "  Notarizing DMG..."
xcrun notarytool submit "$DMG_PATH" --keychain-profile "$KEYCHAIN_PROFILE" --wait

# Staple DMG
xcrun stapler staple "$DMG_PATH"

echo -e "${GREEN}✓ DMG created and notarized${NC}"

# ==== DONE ====
echo ""
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    🎉 Release Complete!                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo "📦 DMG ready for distribution:"
echo "   $DMG_PATH"
echo ""
echo "📊 File size: $(du -h "$DMG_PATH" | cut -f1)"
echo ""
echo "Next steps:"
echo "  1. Test the DMG on a clean Mac"
echo "  2. Upload to your distribution server"
echo "  3. Update download links"
echo ""
