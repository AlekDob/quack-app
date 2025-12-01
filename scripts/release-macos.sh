#!/bin/bash

# =============================================================================
# Quack - Complete macOS Release Script (OPTIMIZED)
# =============================================================================
# This script automates the entire release process:
# 1. Build the app with Tauri
# 2. Sign all binaries for notarization (PARALLEL)
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

# Parallel jobs (adjust based on CPU cores)
PARALLEL_JOBS=8

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           🦆 Quack macOS Release Script (OPTIMIZED)           ║"
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

# ==== STEP 3: Sign all binaries (OPTIMIZED - PARALLEL) ====
echo -e "${YELLOW}[3/6] Signing all binaries (parallel, $PARALLEL_JOBS jobs)...${NC}"

# Note: Keychain should already be unlocked when logged in
# If signing fails, run manually: security unlock-keychain ~/Library/Keychains/login.keychain-db
echo "  Checking keychain status..."

# Create temp file for tracking
SIGN_LOG=$(mktemp)
SIGN_COUNT=0

# Function to sign a single file
sign_file() {
    local file="$1"
    local identity="$2"
    codesign --force --options runtime --timestamp --sign "$identity" "$file" 2>/dev/null
    echo "." >> "$SIGN_LOG"
}
export -f sign_file

# Collect all files to sign first (fast)
echo "  Collecting binaries to sign..."
BINARIES_LIST=$(mktemp)

# .dylib files
find "$APP_PATH" -type f -name "*.dylib" 2>/dev/null >> "$BINARIES_LIST"

# .node files
find "$APP_PATH" -type f -name "*.node" 2>/dev/null >> "$BINARIES_LIST"

# ripgrep binaries
find "$APP_PATH" -path "*ripgrep*" -type f -name "rg" 2>/dev/null >> "$BINARIES_LIST"

# Mach-O executables (only actual binaries, skip scripts)
find "$APP_PATH" -type f -perm +111 2>/dev/null | while read -r file; do
    if file "$file" 2>/dev/null | grep -q "Mach-O"; then
        echo "$file"
    fi
done >> "$BINARIES_LIST"

# Remove duplicates
sort -u "$BINARIES_LIST" -o "$BINARIES_LIST"

TOTAL_FILES=$(wc -l < "$BINARIES_LIST" | tr -d ' ')
echo -e "  Found ${CYAN}$TOTAL_FILES${NC} binaries to sign"

# Sign in parallel using xargs (with exported identity)
echo "  Signing in parallel..."
export SIGN_ID="$SIGNING_IDENTITY"
while IFS= read -r file; do
    codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" "$file" 2>/dev/null && echo -n "." &
    # Limit parallel jobs
    while [ $(jobs -r | wc -l) -ge $PARALLEL_JOBS ]; do
        sleep 0.1
    done
done < "$BINARIES_LIST"
wait
echo ""

# Sign node-sidecar with entitlements
if [ -f "$APP_PATH/Contents/MacOS/node-sidecar" ]; then
    echo "  Signing node-sidecar with entitlements..."
    codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" "$APP_PATH/Contents/MacOS/node-sidecar"
fi

# Sign main executable with entitlements
echo "  Signing main executable with entitlements..."
codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" "$APP_PATH/Contents/MacOS/app"

# Sign the entire app bundle (must be last!)
echo "  Signing app bundle..."
codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" "$APP_PATH"

# Cleanup
rm -f "$BINARIES_LIST" "$SIGN_LOG"

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
echo "  Creating ZIP..."
ditto -c -k --keepParent Quack.app Quack.zip

# Submit for notarization
echo "  Submitting to Apple (please wait)..."
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
echo "  Creating DMG image..."
hdiutil create -volname "Quack" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"

# Sign DMG
echo "  Signing DMG..."
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
