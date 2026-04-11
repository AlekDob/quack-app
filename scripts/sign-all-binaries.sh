#!/bin/bash

# Sign all native binaries for Apple notarization
# This script signs binaries in TWO locations:
# 1. Source resources (src-tauri/node-sdk/) - for beforeBundleCommand (pre-bundle)
# 2. App bundle (Quack.app/) - for post-bundle signing (release-macos.sh)
#
# Usage:
#   beforeBundleCommand (pre-bundle):  bash scripts/sign-all-binaries.sh
#   Post-bundle (explicit path):       bash scripts/sign-all-binaries.sh path/to/Quack.app

set -e

# Skip signing on non-macOS platforms (Linux, Windows)
if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "Skipping code signing (not macOS)"
    exit 0
fi

# Resolve project root from script location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env file
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
else
    echo "ERROR: .env file not found at $PROJECT_ROOT/.env"
    echo "Copy .env.example to .env and fill in your certificate details."
    exit 1
fi

SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:?ERROR: APPLE_SIGNING_IDENTITY not set in .env}"
ENTITLEMENTS="$PROJECT_ROOT/src-tauri/Entitlements.plist"

# Check if entitlements exist
if [ ! -f "$ENTITLEMENTS" ]; then
    echo "ERROR: Entitlements file not found at $ENTITLEMENTS"
    exit 1
fi

# Determine mode: if an app bundle path is passed, sign the bundle.
# Otherwise, sign source resources (beforeBundleCommand mode).
if [ -n "$1" ]; then
    MODE="bundle"
    APP_PATH="$1"
    if [ ! -d "$APP_PATH" ]; then
        echo "ERROR: App bundle not found at $APP_PATH"
        exit 1
    fi
else
    MODE="source"
fi

echo "=== Quack Code Signing Script ==="
echo "Mode: $MODE"
echo "Signing Identity: $SIGNING_IDENTITY"
echo ""

# Unlock keychain
echo "Unlocking keychain..."
security unlock-keychain ~/Library/Keychains/login.keychain-db || true

# Function to sign without entitlements (for third-party binaries)
sign_binary_simple() {
    local file="$1"
    echo "  Signing: $file"
    codesign --force --options runtime --timestamp \
        --sign "$SIGNING_IDENTITY" \
        "$file" || echo "    WARNING: Failed to sign $file"
}

# Function to sign with entitlements (for our own binaries)
sign_binary() {
    local file="$1"
    echo "  Signing (with entitlements): $file"
    codesign --force --options runtime --timestamp \
        --entitlements "$ENTITLEMENTS" \
        --sign "$SIGNING_IDENTITY" \
        "$file" || echo "    WARNING: Failed to sign $file"
}

SIGN_COUNT=0

if [ "$MODE" = "source" ]; then
    # ==== SOURCE MODE: Sign binaries in src-tauri/node-sdk before Tauri copies them ====
    NODE_SDK="$PROJECT_ROOT/src-tauri/node-sdk"

    if [ ! -d "$NODE_SDK" ]; then
        echo "WARNING: node-sdk directory not found at $NODE_SDK, skipping source signing"
        exit 0
    fi

    echo "Signing source resources in: $NODE_SDK"
    echo ""

    echo "=== Step 1: Signing .dylib files ==="
    while IFS= read -r -d '' file; do
        sign_binary_simple "$file"
        SIGN_COUNT=$((SIGN_COUNT + 1))
    done < <(find "$NODE_SDK" -type f -name "*.dylib" -print0 2>/dev/null)

    echo ""
    echo "=== Step 2: Signing .node files ==="
    while IFS= read -r -d '' file; do
        sign_binary_simple "$file"
        SIGN_COUNT=$((SIGN_COUNT + 1))
    done < <(find "$NODE_SDK" -type f -name "*.node" -print0 2>/dev/null)

    echo ""
    echo "=== Step 3: Signing ripgrep (rg) binaries ==="
    while IFS= read -r -d '' file; do
        sign_binary_simple "$file"
        SIGN_COUNT=$((SIGN_COUNT + 1))
    done < <(find "$NODE_SDK" -type f -name "rg" -print0 2>/dev/null)

    echo ""
    echo "=== Step 4: Signing all Mach-O executables ==="
    while IFS= read -r -d '' file; do
        if file "$file" | grep -q "Mach-O"; then
            sign_binary_simple "$file"
            SIGN_COUNT=$((SIGN_COUNT + 1))
        fi
    done < <(find "$NODE_SDK" -type f -perm +111 -print0 2>/dev/null)

    echo ""
    echo "=== Signed $SIGN_COUNT binaries in source resources ==="

else
    # ==== BUNDLE MODE: Sign everything inside the .app bundle ====
    echo "Signing app bundle: $APP_PATH"
    echo ""

    echo "=== Step 1: Signing native libraries (.dylib) ==="
    while IFS= read -r -d '' file; do
        sign_binary_simple "$file"
        SIGN_COUNT=$((SIGN_COUNT + 1))
    done < <(find "$APP_PATH" -type f -name "*.dylib" -print0 2>/dev/null)

    echo ""
    echo "=== Step 2: Signing Node native modules (.node) ==="
    while IFS= read -r -d '' file; do
        sign_binary_simple "$file"
        SIGN_COUNT=$((SIGN_COUNT + 1))
    done < <(find "$APP_PATH" -type f -name "*.node" -print0 2>/dev/null)

    echo ""
    echo "=== Step 3: Signing ripgrep binaries ==="
    while IFS= read -r -d '' file; do
        sign_binary_simple "$file"
        SIGN_COUNT=$((SIGN_COUNT + 1))
    done < <(find "$APP_PATH" -type f -name "rg" -print0 2>/dev/null)

    echo ""
    echo "=== Step 4: Signing all Mach-O executables ==="
    while IFS= read -r -d '' file; do
        if file "$file" | grep -q "Mach-O"; then
            sign_binary_simple "$file"
            SIGN_COUNT=$((SIGN_COUNT + 1))
        fi
    done < <(find "$APP_PATH" -type f -perm +111 -print0 2>/dev/null)

    echo ""
    echo "=== Step 5: Signing frameworks ==="
    while IFS= read -r -d '' framework; do
        echo "  Signing framework: $framework"
        codesign --force --options runtime --timestamp \
            --sign "$SIGNING_IDENTITY" \
            "$framework" || echo "    WARNING: Failed to sign $framework"
    done < <(find "$APP_PATH" -type d -name "*.framework" -print0 2>/dev/null)

    echo ""
    echo "=== Step 6: Signing node-sidecar ==="
    for sidecar in "$APP_PATH/Contents/MacOS/node-sidecar"*; do
        [ -f "$sidecar" ] && sign_binary "$sidecar"
    done

    echo ""
    echo "=== Step 7: Signing main executable ==="
    if [ -f "$APP_PATH/Contents/MacOS/Quack" ]; then
        sign_binary "$APP_PATH/Contents/MacOS/Quack"
    elif [ -f "$APP_PATH/Contents/MacOS/app" ]; then
        sign_binary "$APP_PATH/Contents/MacOS/app"
    fi

    echo ""
    echo "=== Step 8: Signing the app bundle ==="
    codesign --force --options runtime --timestamp \
        --entitlements "$ENTITLEMENTS" \
        --sign "$SIGNING_IDENTITY" \
        "$APP_PATH"

    echo ""
    echo "=== Verification ==="
    echo "Verifying signature..."
    codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>&1 | head -20

    echo ""
    echo "=== Signed $SIGN_COUNT binaries in app bundle ==="
fi

echo ""
echo "=== Done ==="
