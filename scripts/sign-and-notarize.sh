#!/bin/bash

# =============================================================================
# Quack desktop — Sign All Binaries & Notarize (Post-Build)
# =============================================================================
# Run after `cargo tauri build --bundles app` to:
# 1. Sign ALL Mach-O binaries in the .app bundle
# 2. Notarize .app with Apple
# 3. Create DMG with notarized .app
# 4. Sign & notarize DMG
#
# Usage: ./scripts/sign-and-notarize.sh [path-to-Quack.app]
# =============================================================================

set -e

APP_NAME="Quack"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    # shellcheck source=/dev/null
    source "$PROJECT_ROOT/.env"
    set +a
else
    echo -e "${RED}ERROR: .env file not found at $PROJECT_ROOT/.env${NC}"
    echo "Copy .env.example to .env and fill in your certificate details."
    exit 1
fi

SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:?ERROR: APPLE_SIGNING_IDENTITY not set in .env}"
ENTITLEMENTS="$PROJECT_ROOT/src-tauri/Entitlements.plist"
PARALLEL_JOBS=8

if [ -n "${APPLE_KEYCHAIN_PROFILE:-}" ]; then
    NOTARY_ARGS=(--keychain-profile "$APPLE_KEYCHAIN_PROFILE")
else
    NOTARY_APPLE_ID="${APPLE_ID:?ERROR: APPLE_ID not set in .env (or set APPLE_KEYCHAIN_PROFILE)}"
    NOTARY_PASSWORD="${APPLE_PASSWORD:?ERROR: APPLE_PASSWORD not set in .env}"
    NOTARY_TEAM_ID="${APPLE_TEAM_ID:?ERROR: APPLE_TEAM_ID not set in .env}"
    NOTARY_ARGS=(--apple-id "$NOTARY_APPLE_ID" --password "$NOTARY_PASSWORD" --team-id "$NOTARY_TEAM_ID")
fi

notary_submit() {
    xcrun notarytool submit "$1" "${NOTARY_ARGS[@]}" --wait
}

if [ -n "$1" ]; then
    APP_PATH="$1"
else
    APP_PATH=""
    for candidate in \
        "$PROJECT_ROOT/src-tauri/target/release/bundle/macos/${APP_NAME}.app" \
        "$PROJECT_ROOT/src-tauri/target/universal-apple-darwin/release/bundle/macos/${APP_NAME}.app" \
        "$PROJECT_ROOT/src-tauri/target/aarch64-apple-darwin/release/bundle/macos/${APP_NAME}.app" \
        "$PROJECT_ROOT/src-tauri/target/x86_64-apple-darwin/release/bundle/macos/${APP_NAME}.app"; do
        if [ -d "$candidate" ]; then
            APP_PATH="$candidate"
            break
        fi
    done

    if [ -z "$APP_PATH" ]; then
        echo -e "${RED}ERROR: No ${APP_NAME}.app found. Run a release build first.${NC}"
        exit 1
    fi
fi

if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}ERROR: App bundle not found at $APP_PATH${NC}"
    exit 1
fi

if [ ! -f "$ENTITLEMENTS" ]; then
    echo -e "${RED}ERROR: Entitlements file not found at $ENTITLEMENTS${NC}"
    exit 1
fi

echo -e "${BLUE}"
echo "================================================================="
echo "  Quack — Sign & Notarize"
echo "================================================================="
echo -e "${NC}"
echo "  App:      $APP_PATH"
echo "  Identity: $SIGNING_IDENTITY"
echo ""

# ==== STEP 1: Sign all binaries (parallel) ====
echo -e "${YELLOW}[1/6] Signing all binaries (parallel, $PARALLEL_JOBS jobs)...${NC}"

xattr -cr "$APP_PATH"
security unlock-keychain ~/Library/Keychains/login.keychain-db 2>/dev/null || true

BINARIES_LIST=$(mktemp)
find "$APP_PATH" -type f -name "*.dylib" 2>/dev/null >> "$BINARIES_LIST"
find "$APP_PATH" -type f -name "*.node" 2>/dev/null >> "$BINARIES_LIST"
find "$APP_PATH" -type f -perm +111 2>/dev/null | while read -r file; do
    if file "$file" 2>/dev/null | grep -q "Mach-O"; then
        echo "$file"
    fi
done >> "$BINARIES_LIST"
sort -u "$BINARIES_LIST" -o "$BINARIES_LIST"

TOTAL_FILES=$(wc -l < "$BINARIES_LIST" | tr -d ' ')
echo -e "  Found ${CYAN}$TOTAL_FILES${NC} binaries to sign"

while IFS= read -r file; do
    codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" "$file" 2>/dev/null && echo -n "." &
    while [ "$(jobs -r | wc -l | tr -d ' ')" -ge "$PARALLEL_JOBS" ]; do
        sleep 0.1
    done
done < "$BINARIES_LIST"
wait
echo ""

MAIN_EXE=""
for candidate in "$APP_PATH/Contents/MacOS/$APP_NAME" "$APP_PATH/Contents/MacOS/app"; do
    if [ -f "$candidate" ]; then
        MAIN_EXE="$candidate"
        break
    fi
done

if [ -z "$MAIN_EXE" ]; then
    echo -e "${RED}ERROR: Main executable not found in bundle${NC}"
    exit 1
fi

echo "  Signing main executable with entitlements..."
codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" "$MAIN_EXE"

echo "  Signing app bundle..."
codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" "$APP_PATH"

rm -f "$BINARIES_LIST"
echo -e "${GREEN}  All binaries signed${NC}"

# ==== STEP 2: Verify signature ====
echo -e "${YELLOW}[2/6] Verifying signature...${NC}"
codesign --verify --deep --strict "$APP_PATH"
echo -e "${GREEN}  Signature verified${NC}"

# ==== STEP 3: Notarize .app ====
echo -e "${YELLOW}[3/6] Notarizing .app...${NC}"

BUNDLE_DIR="$(dirname "$APP_PATH")"
cd "$BUNDLE_DIR"
rm -f "${APP_NAME}.zip"
ditto -c -k --keepParent "${APP_NAME}.app" "${APP_NAME}.zip"

echo "  Submitting to Apple (this may take several minutes)..."
notary_submit "${APP_NAME}.zip"

echo "  Stapling ticket to .app..."
xcrun stapler staple "$APP_PATH"

rm -f "${APP_NAME}.zip"
echo -e "${GREEN}  .app notarized and stapled${NC}"

# ==== STEP 4: Create DMG ====
echo -e "${YELLOW}[4/6] Creating DMG...${NC}"

DMG_PATH="$BUNDLE_DIR/${APP_NAME}.dmg"
rm -f "$DMG_PATH"
DMG_BG="$PROJECT_ROOT/scripts/dmg-background.png"

if command -v create-dmg &>/dev/null && [ -f "$DMG_BG" ]; then
    CREATE_DMG="$(command -v create-dmg)"
    "$CREATE_DMG" \
        --volname "$APP_NAME" \
        --volicon "$PROJECT_ROOT/src-tauri/icons/icon.icns" \
        --background "$DMG_BG" \
        --window-pos 200 120 \
        --window-size 660 400 \
        --icon-size 100 \
        --icon "${APP_NAME}.app" 180 200 \
        --app-drop-link 480 200 \
        --hide-extension "${APP_NAME}.app" \
        --no-internet-enable \
        "$DMG_PATH" \
        "$APP_PATH" || true
elif command -v create-dmg &>/dev/null; then
    CREATE_DMG="$(command -v create-dmg)"
    "$CREATE_DMG" \
        --volname "$APP_NAME" \
        --volicon "$PROJECT_ROOT/src-tauri/icons/icon.icns" \
        --window-pos 200 120 \
        --window-size 660 400 \
        --icon-size 100 \
        --icon "${APP_NAME}.app" 180 200 \
        --app-drop-link 480 200 \
        --hide-extension "${APP_NAME}.app" \
        --no-internet-enable \
        "$DMG_PATH" \
        "$APP_PATH" || true
else
    echo "  create-dmg not found, creating simple DMG with hdiutil..."
    hdiutil create -volname "$APP_NAME" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"
fi

if [ ! -f "$DMG_PATH" ]; then
    echo -e "${RED}ERROR: DMG creation failed${NC}"
    exit 1
fi

echo -e "${GREEN}  DMG created${NC}"

# ==== STEP 5: Sign & notarize DMG ====
echo -e "${YELLOW}[5/6] Signing and notarizing DMG...${NC}"

codesign --force --sign "$SIGNING_IDENTITY" "$DMG_PATH"
notary_submit "$DMG_PATH"
xcrun stapler staple "$DMG_PATH"

echo -e "${GREEN}  DMG signed, notarized and stapled${NC}"

# ==== STEP 6: Final verification ====
echo -e "${YELLOW}[6/6] Final verification...${NC}"
echo "  .app:"
spctl -a -vvv -t install "$APP_PATH" 2>&1 | head -3 | sed 's/^/    /'
echo "  .dmg:"
spctl -a -vvv -t install "$DMG_PATH" 2>&1 | head -3 | sed 's/^/    /'

DMG_SIZE=$(du -h "$DMG_PATH" | cut -f1)
echo ""
echo -e "${GREEN}=================================================================${NC}"
echo -e "${GREEN}  Release ready!${NC}"
echo -e "${GREEN}=================================================================${NC}"
echo ""
echo "  DMG: $DMG_PATH ($DMG_SIZE)"
echo ""
