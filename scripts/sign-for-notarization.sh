#!/bin/bash

# Complete signing script for Apple notarization
# Signs all native binaries including those inside JAR files

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
    echo "ERROR: .env file not found at $PROJECT_ROOT/.env"
    echo "Copy .env.example to .env and fill in your certificate details."
    exit 1
fi

APP_PATH="$PROJECT_ROOT/src-tauri/target/release/bundle/macos/Quack.app"
SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:?ERROR: APPLE_SIGNING_IDENTITY not set in .env}"
ENTITLEMENTS="$PROJECT_ROOT/src-tauri/Entitlements.plist"

echo "=== Quack Complete Code Signing Script for Notarization ==="
echo "App Path: $APP_PATH"
echo ""

# Unlock keychain
echo "Step 0: Unlocking keychain..."
security unlock-keychain ~/Library/Keychains/login.keychain-db 2>/dev/null || true

# Sign function with hardened runtime
sign_binary() {
    local file="$1"
    echo "  Signing: ${file##*/}"
    codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" "$file" 2>/dev/null || echo "    WARNING: Could not sign $file"
}

# ==== STEP 1: Sign binaries inside JAR files ====
echo ""
echo "=== Step 1: Processing JAR files with native Mac libraries ==="

JANSI_JAR="$APP_PATH/Contents/Resources/node-sdk/node_modules/@anthropic-ai/claude-agent-sdk/vendor/claude-code-jetbrains-plugin/lib/jansi-2.4.1.jar"

if [ -f "$JANSI_JAR" ]; then
    echo "Found jansi JAR, extracting and signing native libraries..."

    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"

    # Extract JAR
    unzip -q "$JANSI_JAR"

    # Sign Mac native libraries
    for arch in arm64 x86 x86_64; do
        NATIVE_LIB="org/fusesource/jansi/internal/native/Mac/$arch/libjansi.jnilib"
        if [ -f "$NATIVE_LIB" ]; then
            echo "  Signing: libjansi.jnilib ($arch)"
            codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" "$NATIVE_LIB"
        fi
    done

    # Recreate JAR using zip (JAR is just a ZIP file)
    rm "$JANSI_JAR"
    zip -q -r "$JANSI_JAR" .
    echo "  JAR recreated with signed natives"

    # Cleanup
    cd /
    rm -rf "$TEMP_DIR"
else
    echo "  jansi JAR not found, skipping"
fi

# ==== STEP 2: Sign .dylib files ====
echo ""
echo "=== Step 2: Signing .dylib files ==="
find "$APP_PATH" -type f -name "*.dylib" | while read -r file; do
    sign_binary "$file"
done

# ==== STEP 3: Sign .node files ====
echo ""
echo "=== Step 3: Signing .node files ==="
find "$APP_PATH" -type f -name "*.node" | while read -r file; do
    sign_binary "$file"
done

# ==== STEP 4: Sign ripgrep binaries ====
echo ""
echo "=== Step 4: Signing ripgrep binaries ==="
find "$APP_PATH" -path "*ripgrep*" -type f \( -name "rg" -o -name "*.node" \) | while read -r file; do
    sign_binary "$file"
done

# ==== STEP 5: Sign all Mach-O executables ====
echo ""
echo "=== Step 5: Signing all Mach-O executables ==="
find "$APP_PATH" -type f -perm +111 2>/dev/null | while read -r file; do
    if file "$file" 2>/dev/null | grep -q "Mach-O"; then
        sign_binary "$file"
    fi
done

# ==== STEP 6: Sign sidecar and main executable with entitlements ====
echo ""
echo "=== Step 6: Signing sidecars and main executable with entitlements ==="

# Sign node-sidecar
if [ -f "$APP_PATH/Contents/MacOS/node-sidecar" ]; then
    echo "  Signing: node-sidecar"
    codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" "$APP_PATH/Contents/MacOS/node-sidecar"
fi

# Sign main executable
if [ -f "$APP_PATH/Contents/MacOS/Quack" ]; then
    echo "  Signing: Quack (main executable)"
    codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" "$APP_PATH/Contents/MacOS/Quack"
fi

if [ -f "$APP_PATH/Contents/MacOS/app" ]; then
    echo "  Signing: app"
    codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" "$APP_PATH/Contents/MacOS/app"
fi

# ==== STEP 7: Sign the app bundle ====
echo ""
echo "=== Step 7: Signing the app bundle ==="
codesign --force --options runtime --timestamp --entitlements "$ENTITLEMENTS" --sign "$SIGNING_IDENTITY" "$APP_PATH"

# ==== STEP 8: Verify ====
echo ""
echo "=== Step 8: Verification ==="
echo "Verifying signature..."
codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>&1 | head -10

echo ""
echo "Checking with spctl..."
spctl -a -vvv -t install "$APP_PATH" 2>&1 | head -5

echo ""
echo "=== Done! ==="
echo ""
echo "Next steps:"
echo "1. Create ZIP: cd $(dirname $APP_PATH) && ditto -c -k --keepParent Quack.app Quack.zip"
echo "2. Submit: xcrun notarytool submit Quack.zip --apple-id \"\$APPLE_ID\" --password \"\$APPLE_PASSWORD\" --team-id \"\$APPLE_TEAM_ID\" --wait"
