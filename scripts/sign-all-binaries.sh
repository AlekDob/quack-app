#!/bin/bash

# Sign all binaries recursively for Apple notarization
# This script signs all executable binaries, dylibs, frameworks, and native modules

set -e

APP_PATH="${1:-src-tauri/target/release/bundle/macos/Quack.app}"
SIGNING_IDENTITY="Developer ID Application: ALEKSANDAR DOBROHOTOV (FC38UVV3V3)"
ENTITLEMENTS="src-tauri/Entitlements.plist"

echo "=== Quack Deep Code Signing Script ==="
echo "App Path: $APP_PATH"
echo "Signing Identity: $SIGNING_IDENTITY"
echo ""

# Check if app exists
if [ ! -d "$APP_PATH" ]; then
    echo "ERROR: App bundle not found at $APP_PATH"
    exit 1
fi

# Check if entitlements exist
if [ ! -f "$ENTITLEMENTS" ]; then
    echo "ERROR: Entitlements file not found at $ENTITLEMENTS"
    exit 1
fi

# Unlock keychain (may prompt for password)
echo "Unlocking keychain..."
security unlock-keychain ~/Library/Keychains/login.keychain-db || true

# Function to sign a binary
sign_binary() {
    local file="$1"
    echo "  Signing: ${file#$APP_PATH/}"
    codesign --force --options runtime --timestamp \
        --entitlements "$ENTITLEMENTS" \
        --sign "$SIGNING_IDENTITY" \
        "$file" 2>/dev/null || echo "    WARNING: Failed to sign $file"
}

# Function to sign without entitlements (for third-party binaries)
sign_binary_simple() {
    local file="$1"
    echo "  Signing: ${file#$APP_PATH/}"
    codesign --force --options runtime --timestamp \
        --sign "$SIGNING_IDENTITY" \
        "$file" 2>/dev/null || echo "    WARNING: Failed to sign $file"
}

echo ""
echo "=== Step 1: Signing native libraries (.dylib) ==="
find "$APP_PATH" -type f -name "*.dylib" | while read -r file; do
    sign_binary_simple "$file"
done

echo ""
echo "=== Step 2: Signing Node native modules (.node) ==="
find "$APP_PATH" -type f -name "*.node" | while read -r file; do
    sign_binary_simple "$file"
done

echo ""
echo "=== Step 3: Signing shared objects (.so) ==="
find "$APP_PATH" -type f -name "*.so" | while read -r file; do
    sign_binary_simple "$file"
done

echo ""
echo "=== Step 4: Signing JAR native libraries ==="
# Find and sign native libs inside JAR files (jansi)
find "$APP_PATH" -type f \( -name "libjansi.jnilib" -o -name "libjansi.dylib" \) | while read -r file; do
    sign_binary_simple "$file"
done

echo ""
echo "=== Step 5: Signing ripgrep binaries ==="
find "$APP_PATH" -type f -name "rg" | while read -r file; do
    sign_binary_simple "$file"
done

echo ""
echo "=== Step 6: Signing all Mach-O executables ==="
# Find all Mach-O binaries (executables)
find "$APP_PATH" -type f -perm +111 | while read -r file; do
    # Check if it's a Mach-O binary
    if file "$file" | grep -q "Mach-O"; then
        sign_binary_simple "$file"
    fi
done

echo ""
echo "=== Step 7: Signing frameworks ==="
find "$APP_PATH" -type d -name "*.framework" | while read -r framework; do
    echo "  Signing framework: ${framework#$APP_PATH/}"
    codesign --force --options runtime --timestamp \
        --sign "$SIGNING_IDENTITY" \
        "$framework" 2>/dev/null || echo "    WARNING: Failed to sign $framework"
done

echo ""
echo "=== Step 8: Signing node-sidecar ==="
if [ -f "$APP_PATH/Contents/MacOS/node-sidecar-aarch64-apple-darwin" ]; then
    sign_binary "$APP_PATH/Contents/MacOS/node-sidecar-aarch64-apple-darwin"
fi
if [ -f "$APP_PATH/Contents/MacOS/node-sidecar-x86_64-apple-darwin" ]; then
    sign_binary "$APP_PATH/Contents/MacOS/node-sidecar-x86_64-apple-darwin"
fi

echo ""
echo "=== Step 9: Signing main executable ==="
sign_binary "$APP_PATH/Contents/MacOS/Quack"

echo ""
echo "=== Step 10: Signing the app bundle ==="
codesign --force --options runtime --timestamp \
    --entitlements "$ENTITLEMENTS" \
    --sign "$SIGNING_IDENTITY" \
    "$APP_PATH"

echo ""
echo "=== Verification ==="
echo "Verifying signature..."
codesign --verify --deep --strict --verbose=2 "$APP_PATH" 2>&1 | head -20

echo ""
echo "Checking for unsigned binaries..."
UNSIGNED=$(find "$APP_PATH" -type f -perm +111 -exec sh -c 'file "{}" | grep -q "Mach-O" && codesign -v "{}" 2>&1 | grep -q "not signed" && echo "{}"' \; 2>/dev/null || true)

if [ -n "$UNSIGNED" ]; then
    echo "WARNING: Found unsigned binaries:"
    echo "$UNSIGNED"
else
    echo "All Mach-O binaries are signed!"
fi

echo ""
echo "=== Done ==="
echo "App bundle signed. Ready for notarization."
