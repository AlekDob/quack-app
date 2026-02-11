#!/bin/bash

# =============================================================================
# Quack - Sign All Binaries & Notarize (Post-Build)
# =============================================================================
# Run after `cargo tauri build` to:
# 1. Remove JetBrains plugin (unsigned JARs)
# 2. Sign ALL binaries (dylib, .node, ripgrep, Mach-O) in parallel
# 3. Notarize .app with Apple
# 4. Create DMG with notarized .app
# 5. Sign & notarize DMG
#
# Usage: ./scripts/sign-and-notarize.sh [path-to-Quack.app]
#        If no path given, auto-detects from the latest build output.
# =============================================================================

set -e

# Resolve project root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

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
ENTITLEMENTS="$PROJECT_ROOT/src-tauri/Entitlements.plist"
PARALLEL_JOBS=8

# Auto-detect .app path if not provided
if [ -n "$1" ]; then
    APP_PATH="$1"
else
    # Search for the most recently built Quack.app
    APP_PATH=""
    for candidate in \
        "$PROJECT_ROOT/src-tauri/target/release/bundle/macos/Quack.app" \
        "$PROJECT_ROOT/src-tauri/target/universal-apple-darwin/release/bundle/macos/Quack.app" \
        "$PROJECT_ROOT/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Quack.app" \
        "$PROJECT_ROOT/src-tauri/target/x86_64-apple-darwin/release/bundle/macos/Quack.app"; do
        if [ -d "$candidate" ]; then
            APP_PATH="$candidate"
            break
        fi
    done

    if [ -z "$APP_PATH" ]; then
        echo -e "${RED}ERROR: No Quack.app found. Run 'npm run tauri:build' first.${NC}"
        exit 1
    fi
fi

if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}ERROR: App bundle not found at $APP_PATH${NC}"
    exit 1
fi

echo -e "${BLUE}"
echo "================================================================="
echo "  Quack - Sign & Notarize"
echo "================================================================="
echo -e "${NC}"
echo "  App:      $APP_PATH"
echo "  Identity: $SIGNING_IDENTITY"
echo "  Profile:  $KEYCHAIN_PROFILE"
echo ""

# ==== STEP 1: Remove problematic JetBrains plugin ====
echo -e "${YELLOW}[1/7] Removing JetBrains plugin (unsigned JARs)...${NC}"
JETBRAINS_PATH="$APP_PATH/Contents/Resources/node-sdk/node_modules/@anthropic-ai/claude-agent-sdk/vendor/claude-code-jetbrains-plugin"
if [ -d "$JETBRAINS_PATH" ]; then
    rm -rf "$JETBRAINS_PATH"
    echo -e "${GREEN}  Removed${NC}"
else
    echo -e "${GREEN}  Not present, skipping${NC}"
fi

# ==== STEP 2: Sign all binaries (PARALLEL) ====
echo -e "${YELLOW}[2/7] Signing all binaries (parallel, $PARALLEL_JOBS jobs)...${NC}"

BINARIES_LIST=$(mktemp)

# Collect all signable files
find "$APP_PATH" -type f -name "*.dylib" 2>/dev/null >> "$BINARIES_LIST"
find "$APP_PATH" -type f -name "*.node" 2>/dev/null >> "$BINARIES_LIST"
find "$APP_PATH" -path "*ripgrep*" -type f -name "rg" 2>/dev/null >> "$BINARIES_LIST"
find "$APP_PATH" -type f -perm +111 2>/dev/null | while read -r file; do
    if file "$file" 2>/dev/null | grep -q "Mach-O"; then
        echo "$file"
    fi
done >> "$BINARIES_LIST"

sort -u "$BINARIES_LIST" -o "$BINARIES_LIST"

TOTAL_FILES=$(wc -l < "$BINARIES_LIST" | tr -d ' ')
echo -e "  Found ${CYAN}$TOTAL_FILES${NC} binaries to sign"

# Sign in parallel
echo "  Signing..."
while IFS= read -r file; do
    codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" "$file" 2>/dev/null && echo -n "." &
    while [ $(jobs -r | wc -l) -ge $PARALLEL_JOBS ]; do
        sleep 0.1
    done
done < "$BINARIES_LIST"
wait
echo ""

# Sign node-sidecar with entitlements (if present)
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

rm -f "$BINARIES_LIST"
echo -e "${GREEN}  All binaries signed${NC}"

# ==== STEP 3: Verify signature ====
echo -e "${YELLOW}[3/7] Verifying signature...${NC}"
codesign --verify --deep --strict "$APP_PATH"
echo -e "${GREEN}  Signature verified${NC}"

# ==== STEP 4: Notarize .app ====
echo -e "${YELLOW}[4/7] Notarizing .app...${NC}"

cd "$(dirname "$APP_PATH")"
rm -f Quack.zip
echo "  Creating ZIP..."
ditto -c -k --keepParent Quack.app Quack.zip

echo "  Submitting to Apple (this may take several minutes)..."
xcrun notarytool submit Quack.zip --keychain-profile "$KEYCHAIN_PROFILE" --wait

echo "  Stapling ticket to .app..."
xcrun stapler staple "$APP_PATH"

rm -f Quack.zip
echo -e "${GREEN}  .app notarized and stapled${NC}"

# ==== STEP 5: Create DMG ====
echo -e "${YELLOW}[5/7] Creating DMG...${NC}"

DMG_DIR="$(dirname "$APP_PATH")"
DMG_PATH="$DMG_DIR/Quack.dmg"
rm -f "$DMG_PATH"

if command -v create-dmg &> /dev/null || [ -x /opt/homebrew/bin/create-dmg ]; then
    CREATE_DMG="${CREATE_DMG_PATH:-$(command -v create-dmg || echo /opt/homebrew/bin/create-dmg)}"
    echo "  Creating DMG with branded layout..."
    "$CREATE_DMG" \
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
else
    echo "  create-dmg not found, creating simple DMG with hdiutil..."
    hdiutil create -volname "Quack" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"
fi

if [ ! -f "$DMG_PATH" ]; then
    echo -e "${RED}ERROR: DMG creation failed${NC}"
    exit 1
fi

echo -e "${GREEN}  DMG created${NC}"

# ==== STEP 6: Sign & notarize DMG ====
echo -e "${YELLOW}[6/7] Signing and notarizing DMG...${NC}"

echo "  Signing DMG..."
codesign --force --sign "$SIGNING_IDENTITY" "$DMG_PATH"

echo "  Submitting DMG to Apple..."
xcrun notarytool submit "$DMG_PATH" --keychain-profile "$KEYCHAIN_PROFILE" --wait

echo "  Stapling ticket to DMG..."
xcrun stapler staple "$DMG_PATH"

echo -e "${GREEN}  DMG signed, notarized and stapled${NC}"

# ==== STEP 7: Verify ====
echo -e "${YELLOW}[7/7] Final verification...${NC}"
echo "  .app:"
spctl -a -vvv -t install "$APP_PATH" 2>&1 | head -3 | sed 's/^/    /'
echo "  .dmg:"
spctl -a -vvv -t install "$DMG_PATH" 2>&1 | head -3 | sed 's/^/    /'
echo -e "${GREEN}  Done${NC}"

# ==== DONE ====
DMG_SIZE=$(du -h "$DMG_PATH" | cut -f1)
echo ""
echo -e "${GREEN}=================================================================${NC}"
echo -e "${GREEN}  Release ready!${NC}"
echo -e "${GREEN}=================================================================${NC}"
echo ""
echo "  DMG: $DMG_PATH ($DMG_SIZE)"
echo ""
