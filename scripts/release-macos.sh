#!/bin/bash

# =============================================================================
# Quack - Complete macOS Release Script
# =============================================================================
# This script automates the entire release process:
# 1. Build the app with Tauri (beforeBundleCommand signs native binaries)
# 2. Verify code signature
# 3. Notarize the app
# 4. Create signed + notarized DMG
#
# Native binary signing is handled by beforeBundleCommand in tauri.conf.json
# which calls scripts/sign-native-binaries.sh before Tauri bundles the app.
#
# Usage: ./scripts/release-macos.sh
# =============================================================================

set -e

# Resolve project root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env file
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
else
    echo -e "${RED}ERROR: .env file not found at $PROJECT_ROOT/.env${NC}"
    echo "Copy .env.example to .env and fill in your certificate details."
    exit 1
fi

# Validate required variables
SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:?ERROR: APPLE_SIGNING_IDENTITY not set in .env}"
KEYCHAIN_PROFILE="${APPLE_KEYCHAIN_PROFILE:-QuackNotarization}"

# Configuration (derived from project root)
APP_PATH="$PROJECT_ROOT/src-tauri/target/universal-apple-darwin/release/bundle/macos/Quack.app"
DMG_PATH="$PROJECT_ROOT/src-tauri/target/universal-apple-darwin/release/bundle/macos/Quack.dmg"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              Quack macOS Release Script                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

cd "$PROJECT_ROOT"

# ==== STEP 1: Build (Universal Binary) ====
echo -e "${YELLOW}[1/4] Building universal app with Tauri (arm64 + x86_64)...${NC}"
echo "  Note: beforeBundleCommand will sign native binaries automatically"
# Using --bundles app to skip Tauri's DMG creation (we create our own DMG later)
npm run tauri build -- --target universal-apple-darwin --bundles app

if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}ERROR: Build failed - Quack.app not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build completed (includes native binary signing + Tauri signing + notarization)${NC}"

# ==== STEP 2: Verify signature ====
echo -e "${YELLOW}[2/4] Verifying signature...${NC}"
codesign --verify --deep --strict "$APP_PATH"
echo -e "${GREEN}✓ Signature verified${NC}"

# ==== STEP 3: Staple notarization ticket ====
echo -e "${YELLOW}[3/4] Stapling notarization ticket...${NC}"
xcrun stapler staple "$APP_PATH" 2>/dev/null || {
    echo "  Tauri may have already stapled. Checking..."
    xcrun stapler validate "$APP_PATH" 2>/dev/null && echo -e "${GREEN}✓ Already stapled${NC}" || {
        echo -e "${YELLOW}  Submitting for notarization manually...${NC}"
        cd "$(dirname "$APP_PATH")"
        rm -f Quack.zip
        ditto -c -k --keepParent Quack.app Quack.zip
        xcrun notarytool submit Quack.zip --keychain-profile "$KEYCHAIN_PROFILE" --wait
        xcrun stapler staple "$APP_PATH"
        rm -f Quack.zip
        echo -e "${GREEN}✓ Notarization completed and stapled${NC}"
    }
}

# ==== STEP 4: Create DMG ====
echo -e "${YELLOW}[4/4] Creating professional DMG...${NC}"
rm -f "$DMG_PATH"

# Check for create-dmg
if ! command -v /opt/homebrew/bin/create-dmg &> /dev/null; then
    echo -e "${RED}ERROR: create-dmg not found. Install with: brew install create-dmg${NC}"
    exit 1
fi

# Create professional DMG with branded background
echo "  Creating DMG with branded layout..."
/opt/homebrew/bin/create-dmg \
    --volname "Quack" \
    --volicon "$PROJECT_ROOT/src-tauri/icons/icon.icns" \
    --background "$PROJECT_ROOT/scripts/dmg-background.png" \
    --window-pos 200 120 \
    --window-size 660 400 \
    --icon-size 100 \
    --icon "Quack.app" 180 200 \
    --app-drop-link 480 200 \
    --hide-extension "Quack.app" \
    --no-internet-enable \
    "$DMG_PATH" \
    "$APP_PATH" || true
# Note: create-dmg returns exit code 2 when it can't set the volume icon (non-fatal)

if [ ! -f "$DMG_PATH" ]; then
    echo -e "${RED}ERROR: DMG creation failed${NC}"
    exit 1
fi

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
echo "║                    Release Complete!                         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo "DMG ready for distribution:"
echo "   $DMG_PATH"
echo ""
echo "File size: $(du -h "$DMG_PATH" | cut -f1)"
echo ""
echo "Next steps:"
echo "  1. Test the DMG on a clean Mac"
echo "  2. Upload to your distribution server"
echo "  3. Update download links"
echo ""
