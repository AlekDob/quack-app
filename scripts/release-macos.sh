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
NOTARY_APPLE_ID="${APPLE_ID:?ERROR: APPLE_ID not set in .env}"
NOTARY_PASSWORD="${APPLE_PASSWORD:?ERROR: APPLE_PASSWORD not set in .env}"
NOTARY_TEAM_ID="${APPLE_TEAM_ID:?ERROR: APPLE_TEAM_ID not set in .env}"

# Configuration (derived from project root)
APP_PATH="$PROJECT_ROOT/src-tauri/target/universal-apple-darwin/release/bundle/macos/Quack.app"
DMG_PATH="$PROJECT_ROOT/src-tauri/target/universal-apple-darwin/release/bundle/macos/Quack.dmg"
ENTITLEMENTS="$PROJECT_ROOT/src-tauri/Entitlements.plist"

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

# ==== STEP 0: Clean stale node-sdk from previous builds ====
echo -e "${YELLOW}[0] Cleaning stale node-sdk from bundle caches...${NC}"
for target_dir in "$PROJECT_ROOT/src-tauri/target"/*/release/bundle/macos/Quack.app/Contents/Resources/node-sdk \
                  "$PROJECT_ROOT/src-tauri/target/release/bundle/macos/Quack.app/Contents/Resources/node-sdk" \
                  "$PROJECT_ROOT/src-tauri/target/debug/bundle/macos/Quack.app/Contents/Resources/node-sdk"; do
    if [ -d "$target_dir" ]; then
        rm -rf "$target_dir"
        echo -e "  Removed: $target_dir"
    fi
done
echo -e "${GREEN}✓ Bundle caches cleaned${NC}"

# ==== STEP 1: Build (Universal Binary) ====
echo -e "${YELLOW}[1/6] Building universal app with Tauri (arm64 + x86_64)...${NC}"
# --bundles app: skip Tauri's DMG creation (we create our own DMG later)
# Temporarily unset signing env vars so Tauri doesn't auto-sign/notarize
# (we handle signing manually in steps 3-5)
# Temporarily unset Apple signing env vars so Tauri doesn't auto-sign/notarize
_SAVED_APPLE_ID="$APPLE_ID"
_SAVED_APPLE_PASSWORD="$APPLE_PASSWORD"
_SAVED_APPLE_TEAM_ID="$APPLE_TEAM_ID"
_SAVED_APPLE_SIGNING_IDENTITY="$APPLE_SIGNING_IDENTITY"
unset APPLE_SIGNING_IDENTITY APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID
npm run tauri build -- --target universal-apple-darwin --bundles app
# Restore all Apple env vars for manual signing/notarization (steps 3-5)
export APPLE_SIGNING_IDENTITY="$_SAVED_APPLE_SIGNING_IDENTITY"
export APPLE_ID="$_SAVED_APPLE_ID"
export APPLE_PASSWORD="$_SAVED_APPLE_PASSWORD"
export APPLE_TEAM_ID="$_SAVED_APPLE_TEAM_ID"

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

# Strip extended attributes (resource forks, Finder info) that block codesign
echo "  Stripping extended attributes..."
xattr -cr "$APP_PATH"

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
xcrun notarytool submit Quack.zip --apple-id "$NOTARY_APPLE_ID" --password "$NOTARY_PASSWORD" --team-id "$NOTARY_TEAM_ID" --wait

# Staple the ticket
echo "  Stapling ticket..."
xcrun stapler staple "$APP_PATH"

rm -f Quack.zip
echo -e "${GREEN}✓ Notarization completed and stapled${NC}"

# ==== STEP 6: Create DMG ====
echo -e "${YELLOW}[6/6] Creating professional DMG...${NC}"
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
xcrun notarytool submit "$DMG_PATH" --apple-id "$NOTARY_APPLE_ID" --password "$NOTARY_PASSWORD" --team-id "$NOTARY_TEAM_ID" --wait

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
