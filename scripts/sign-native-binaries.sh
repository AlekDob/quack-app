#!/bin/bash

# =============================================================================
# Sign native binaries inside node-sdk for Apple notarization
# =============================================================================
# Called by Tauri's beforeBundleCommand hook.
# Signs all .dylib, .node, and executable binaries that ship inside
# node-sdk/node_modules so Apple notarization won't reject them.
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env for APPLE_SIGNING_IDENTITY
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
else
    echo "[sign-native] WARNING: .env not found, skipping native binary signing"
    exit 0
fi

SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-}"
if [ -z "$SIGNING_IDENTITY" ]; then
    echo "[sign-native] WARNING: APPLE_SIGNING_IDENTITY not set, skipping"
    exit 0
fi

NODE_SDK="$PROJECT_ROOT/src-tauri/node-sdk"
if [ ! -d "$NODE_SDK" ]; then
    echo "[sign-native] WARNING: node-sdk not found at $NODE_SDK, skipping"
    exit 0
fi

echo "[sign-native] Signing native binaries in node-sdk..."

SIGN_COUNT=0

# Sign a single file with hardened runtime
sign_file() {
    local file="$1"
    codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" "$file" 2>/dev/null
    echo "  Signed: ${file#$NODE_SDK/}"
}

# 1. Sign .dylib files
while IFS= read -r -d '' file; do
    sign_file "$file"
    SIGN_COUNT=$((SIGN_COUNT + 1))
done < <(find "$NODE_SDK" -type f -name "*.dylib" -print0 2>/dev/null)

# 2. Sign .node files
while IFS= read -r -d '' file; do
    sign_file "$file"
    SIGN_COUNT=$((SIGN_COUNT + 1))
done < <(find "$NODE_SDK" -type f -name "*.node" -print0 2>/dev/null)

# 3. Sign ripgrep rg binaries
while IFS= read -r -d '' file; do
    sign_file "$file"
    SIGN_COUNT=$((SIGN_COUNT + 1))
done < <(find "$NODE_SDK" -path "*ripgrep*" -type f -name "rg" -print0 2>/dev/null)

# 4. Sign any other Mach-O executables
while IFS= read -r -d '' file; do
    if file "$file" 2>/dev/null | grep -q "Mach-O"; then
        # Skip files already signed above
        case "$file" in
            *.dylib|*.node) continue ;;
            */rg) continue ;;
        esac
        sign_file "$file"
        SIGN_COUNT=$((SIGN_COUNT + 1))
    fi
done < <(find "$NODE_SDK" -type f -perm +111 -print0 2>/dev/null)

# 5. Remove JetBrains plugin (contains unsigned JARs with native libs)
JETBRAINS_PATH="$NODE_SDK/node_modules/@anthropic-ai/claude-agent-sdk/vendor/claude-code-jetbrains-plugin"
if [ -d "$JETBRAINS_PATH" ]; then
    rm -rf "$JETBRAINS_PATH"
    echo "  Removed: JetBrains plugin (unsigned JARs)"
fi

echo "[sign-native] Done. Signed $SIGN_COUNT binaries."
