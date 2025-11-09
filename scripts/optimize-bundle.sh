#!/bin/bash

# Quack Bundle Optimizer 🦆
# Removes unnecessary files from Tauri bundle to reduce size
# Saves ~77MB per build

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🦆 Quack Bundle Optimizer${NC}"
echo ""

# Function to optimize a bundle directory
optimize_bundle() {
    local BUNDLE_DIR=$1
    local ARCH_NAME=$2

    if [ ! -d "$BUNDLE_DIR" ]; then
        echo -e "${YELLOW}⚠️  Bundle directory not found: $BUNDLE_DIR${NC}"
        return
    fi

    echo -e "${GREEN}✓ Optimizing $ARCH_NAME bundle...${NC}"

    # Find the app bundle
    APP_PATH=$(find "$BUNDLE_DIR" -name "*.app" -type d | head -1)

    if [ -z "$APP_PATH" ]; then
        echo -e "${YELLOW}⚠️  No .app bundle found in $BUNDLE_DIR${NC}"
        return
    fi

    RESOURCES_DIR="$APP_PATH/Contents/Resources"

    if [ ! -d "$RESOURCES_DIR" ]; then
        echo -e "${YELLOW}⚠️  Resources directory not found${NC}"
        return
    fi

    # Get initial size
    INITIAL_SIZE=$(du -sh "$APP_PATH" | awk '{print $1}')

    # 1. Remove ripgrep binaries for other platforms
    echo "  → Removing ripgrep for Windows/Linux..."
    RIPGREP_DIR="$RESOURCES_DIR/node-sdk/node_modules/@anthropic-ai/claude-agent-sdk/vendor/ripgrep"
    if [ -d "$RIPGREP_DIR" ]; then
        rm -rf "$RIPGREP_DIR/x64-win32" 2>/dev/null || true
        rm -rf "$RIPGREP_DIR/x64-linux" 2>/dev/null || true
        rm -rf "$RIPGREP_DIR/arm64-linux" 2>/dev/null || true

        # Remove ARM ripgrep if building for Intel, or Intel if building for ARM
        if [[ "$ARCH_NAME" == *"Intel"* ]]; then
            rm -rf "$RIPGREP_DIR/arm64-darwin" 2>/dev/null || true
            echo "    Kept: x64-darwin only"
        elif [[ "$ARCH_NAME" == *"Apple Silicon"* ]] || [[ "$ARCH_NAME" == *"ARM"* ]]; then
            rm -rf "$RIPGREP_DIR/x64-darwin" 2>/dev/null || true
            echo "    Kept: arm64-darwin only"
        fi
    fi

    # 2. Remove JetBrains plugin (not needed for Tauri)
    echo "  → Removing JetBrains plugin..."
    JETBRAINS_DIR="$RESOURCES_DIR/node-sdk/node_modules/@anthropic-ai/claude-agent-sdk/vendor/claude-code-jetbrains-plugin"
    if [ -d "$JETBRAINS_DIR" ]; then
        rm -rf "$JETBRAINS_DIR" 2>/dev/null || true
    fi

    # 3. Remove duplicate images (keep only public/)
    echo "  → Removing duplicate images..."
    DUPLICATE_IMAGES="$RESOURCES_DIR/_up_/images"
    if [ -d "$DUPLICATE_IMAGES" ]; then
        # Keep public/images, remove top-level images
        rm -rf "$DUPLICATE_IMAGES" 2>/dev/null || true
    fi

    # 4. Remove node_modules source maps (optional, saves a few MB)
    echo "  → Removing source maps..."
    find "$RESOURCES_DIR/node-sdk/node_modules" -name "*.map" -type f -delete 2>/dev/null || true

    # Get final size
    FINAL_SIZE=$(du -sh "$APP_PATH" | awk '{print $1}')

    echo -e "${GREEN}✓ Optimization complete!${NC}"
    echo "  Before: $INITIAL_SIZE"
    echo "  After:  $FINAL_SIZE"
    echo ""
}

# Optimize all available bundles
echo "Searching for bundles to optimize..."
echo ""

# Intel build
INTEL_BUNDLE="src-tauri/target/x86_64-apple-darwin/release/bundle/macos"
if [ -d "$INTEL_BUNDLE" ]; then
    optimize_bundle "$INTEL_BUNDLE" "Intel (x86_64)"
fi

# Apple Silicon build
ARM_BUNDLE="src-tauri/target/release/bundle/macos"
if [ -d "$ARM_BUNDLE" ]; then
    optimize_bundle "$ARM_BUNDLE" "Apple Silicon (ARM64)"
fi

# Universal build
UNIVERSAL_BUNDLE="src-tauri/target/universal-apple-darwin/release/bundle/macos"
if [ -d "$UNIVERSAL_BUNDLE" ]; then
    optimize_bundle "$UNIVERSAL_BUNDLE" "Universal (Intel + ARM)"
fi

echo -e "${GREEN}🦆 Quack! All bundles optimized!${NC}"
