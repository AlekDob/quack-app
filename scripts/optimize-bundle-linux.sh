#!/bin/bash

# Quack Bundle Optimizer for Linux
# Removes unnecessary files from node-sdk to reduce bundle size
# Run BEFORE cargo tauri build to optimize the final package

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Quack Bundle Optimizer (Linux)${NC}"
echo ""

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Node SDK directory
NODE_SDK_DIR="$PROJECT_ROOT/src-tauri/node-sdk"

if [ ! -d "$NODE_SDK_DIR" ]; then
    echo -e "${YELLOW}Node SDK directory not found: $NODE_SDK_DIR${NC}"
    exit 0
fi

# Get initial size
INITIAL_SIZE=$(du -sh "$NODE_SDK_DIR" 2>/dev/null | awk '{print $1}')
echo "Initial node-sdk size: $INITIAL_SIZE"
echo ""

# Function to safely remove files
safe_rm() {
    if [ -e "$1" ] || [ -d "$1" ]; then
        rm -rf "$1" 2>/dev/null || true
    fi
}

# 1. Remove ripgrep binaries for other platforms (keep only Linux)
echo "  Removing ripgrep for Windows/Mac..."
RIPGREP_DIR="$NODE_SDK_DIR/node_modules/@anthropic-ai/claude-agent-sdk/vendor/ripgrep"
if [ -d "$RIPGREP_DIR" ]; then
    safe_rm "$RIPGREP_DIR/x64-win32"
    safe_rm "$RIPGREP_DIR/x64-darwin"
    safe_rm "$RIPGREP_DIR/arm64-darwin"

    # Detect architecture and keep only the relevant Linux binary
    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
        safe_rm "$RIPGREP_DIR/arm64-linux"
        echo "    Kept: x64-linux only"
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        safe_rm "$RIPGREP_DIR/x64-linux"
        echo "    Kept: arm64-linux only"
    fi
fi

# 2. Remove JetBrains plugin (not needed for Tauri)
echo "  Removing JetBrains plugin..."
JETBRAINS_DIR="$NODE_SDK_DIR/node_modules/@anthropic-ai/claude-agent-sdk/vendor/claude-code-jetbrains-plugin"
safe_rm "$JETBRAINS_DIR"

# 3. Remove @img/sharp-* unused platform binaries
echo "  Removing unused sharp binaries..."
SHARP_DIR="$NODE_SDK_DIR/node_modules/@img"
if [ -d "$SHARP_DIR" ]; then
    ARCH=$(uname -m)
    # Remove all non-Linux binaries
    find "$SHARP_DIR" -type d -name "sharp-darwin-*" -exec rm -rf {} + 2>/dev/null || true
    find "$SHARP_DIR" -type d -name "sharp-win32-*" -exec rm -rf {} + 2>/dev/null || true

    # Remove musl binaries (Ubuntu/Debian use glibc, not musl)
    find "$SHARP_DIR" -maxdepth 1 -type d -name "*linuxmusl*" -exec rm -rf {} + 2>/dev/null || true

    # Remove wrong architecture
    if [ "$ARCH" = "x86_64" ]; then
        find "$SHARP_DIR" -type d -name "sharp-linux-arm64" -exec rm -rf {} + 2>/dev/null || true
        find "$SHARP_DIR" -type d -name "sharp-linux-arm" -exec rm -rf {} + 2>/dev/null || true
    elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
        find "$SHARP_DIR" -type d -name "sharp-linux-x64" -exec rm -rf {} + 2>/dev/null || true
    fi
fi

# 4. Remove source maps (saves several MB)
echo "  Removing source maps..."
find "$NODE_SDK_DIR/node_modules" -name "*.map" -type f -delete 2>/dev/null || true

# 5. Remove TypeScript definition files (not needed in production)
echo "  Removing TypeScript definitions..."
find "$NODE_SDK_DIR/node_modules" -name "*.d.ts" -type f -delete 2>/dev/null || true
find "$NODE_SDK_DIR/node_modules" -name "*.d.ts.map" -type f -delete 2>/dev/null || true

# 6. Remove @types packages (not needed in production)
echo "  Removing @types packages..."
safe_rm "$NODE_SDK_DIR/node_modules/@types"

# 7. Remove documentation files
echo "  Removing documentation..."
find "$NODE_SDK_DIR/node_modules" -name "README.md" -type f -delete 2>/dev/null || true
find "$NODE_SDK_DIR/node_modules" -name "CHANGELOG.md" -type f -delete 2>/dev/null || true
find "$NODE_SDK_DIR/node_modules" -name "HISTORY.md" -type f -delete 2>/dev/null || true
find "$NODE_SDK_DIR/node_modules" -name "LICENSE" -type f -delete 2>/dev/null || true
find "$NODE_SDK_DIR/node_modules" -name "LICENSE.md" -type f -delete 2>/dev/null || true
find "$NODE_SDK_DIR/node_modules" -name "*.markdown" -type f -delete 2>/dev/null || true

# 8. Remove test files
echo "  Removing test files..."
find "$NODE_SDK_DIR/node_modules" -type d -name "__tests__" -exec rm -rf {} + 2>/dev/null || true
find "$NODE_SDK_DIR/node_modules" -type d -name "test" -exec rm -rf {} + 2>/dev/null || true
find "$NODE_SDK_DIR/node_modules" -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find "$NODE_SDK_DIR/node_modules" -name "*.test.js" -type f -delete 2>/dev/null || true
find "$NODE_SDK_DIR/node_modules" -name "*.spec.js" -type f -delete 2>/dev/null || true

# 9. Remove example files
echo "  Removing example files..."
find "$NODE_SDK_DIR/node_modules" -type d -name "example" -exec rm -rf {} + 2>/dev/null || true
find "$NODE_SDK_DIR/node_modules" -type d -name "examples" -exec rm -rf {} + 2>/dev/null || true

# 10. Remove .github, .vscode, etc.
echo "  Removing config directories..."
find "$NODE_SDK_DIR/node_modules" -type d -name ".github" -exec rm -rf {} + 2>/dev/null || true
find "$NODE_SDK_DIR/node_modules" -type d -name ".vscode" -exec rm -rf {} + 2>/dev/null || true
find "$NODE_SDK_DIR/node_modules" -name ".eslintrc*" -type f -delete 2>/dev/null || true
find "$NODE_SDK_DIR/node_modules" -name ".prettierrc*" -type f -delete 2>/dev/null || true
find "$NODE_SDK_DIR/node_modules" -name "tsconfig*.json" -type f -delete 2>/dev/null || true

# Get final size
FINAL_SIZE=$(du -sh "$NODE_SDK_DIR" 2>/dev/null | awk '{print $1}')

echo ""
echo -e "${GREEN}Optimization complete!${NC}"
echo "  Before: $INITIAL_SIZE"
echo "  After:  $FINAL_SIZE"
echo ""
