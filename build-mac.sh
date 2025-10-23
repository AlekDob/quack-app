#!/bin/bash

# Quack macOS Build Script
# This script handles the build and distribution of Quack for macOS

set -e

# Add cargo to PATH
export PATH="$HOME/.cargo/bin:$PATH"

echo "🦆 Building Quack for macOS..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we have a code signing identity
IDENTITY=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | awk '{print $2}' 2>/dev/null || echo "")

if [ -z "$IDENTITY" ]; then
    echo -e "${YELLOW}⚠️  No Apple Developer ID found. Building without code signing...${NC}"
    echo -e "${YELLOW}   Users will need to right-click and select 'Open' to run the app.${NC}"
    SIGNING_METHOD="adhoc"
else
    echo -e "${GREEN}✓ Found Apple Developer ID: $IDENTITY${NC}"
    SIGNING_METHOD="identity"
fi

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf src-tauri/target/release/bundle

# Build the app
echo "Building Quack..."
npm run tauri:build

# Post-build processing
if [ -d "src-tauri/target/release/bundle/dmg" ]; then
    DMG_PATH=$(find src-tauri/target/release/bundle/dmg -name "*.dmg" | head -1)

    if [ -n "$DMG_PATH" ]; then
        echo -e "${GREEN}✓ DMG created at: $DMG_PATH${NC}"

        # If no Developer ID, sign with ad-hoc certificate
        if [ "$SIGNING_METHOD" = "adhoc" ]; then
            echo "Applying ad-hoc signature to reduce Gatekeeper warnings..."

            # Mount the DMG
            MOUNT_POINT=$(hdiutil attach "$DMG_PATH" -nobrowse -noverify -noautoopen | grep "/Volumes" | awk '{print $3}')

            if [ -n "$MOUNT_POINT" ]; then
                # Sign the app with ad-hoc certificate
                codesign --force --deep --sign - "$MOUNT_POINT/Quack.app" 2>/dev/null || true

                # Unmount
                hdiutil detach "$MOUNT_POINT" -quiet

                echo -e "${GREEN}✓ Applied ad-hoc signature${NC}"
            fi
        fi

        # Create a distribution folder
        DIST_DIR="dist-mac"
        mkdir -p "$DIST_DIR"
        cp "$DMG_PATH" "$DIST_DIR/"

        # Create README for distribution
        cat > "$DIST_DIR/README.md" << EOF
# Quack Installation Instructions for macOS

## Installation

### First Time Installation

Since Quack is not notarized with Apple, you'll need to bypass Gatekeeper on first launch:

1. **Download** the DMG file
2. **Open** the DMG by double-clicking
3. **Drag** Quack.app to your Applications folder
4. **Important**: Don't double-click to open yet!
5. **Right-click** on Quack.app in Applications
6. Select **"Open"** from the context menu
7. Click **"Open"** in the security dialog
8. Quack will now run, and you won't see this warning again

### Alternative Method (Terminal)

If the above doesn't work, you can remove the quarantine attribute:

\`\`\`bash
xattr -d com.apple.quarantine /Applications/Quack.app
\`\`\`

## Troubleshooting

If you see "Quack is damaged and can't be opened":
- This is a false positive from macOS Gatekeeper
- Use the right-click → Open method described above
- Or use the Terminal command to remove quarantine

## Features

- Multi-terminal emulator with AI integration
- Claude Agent SDK powered assistant
- Git integration
- File explorer
- And much more!

Enjoy using Quack! 🦆
EOF

        echo ""
        echo "════════════════════════════════════════════════════════════"
        echo -e "${GREEN}✓ Build Complete!${NC}"
        echo "════════════════════════════════════════════════════════════"
        echo ""
        echo "📦 Distribution files created in: $DIST_DIR/"
        echo "   - Quack.dmg"
        echo "   - README.md (installation instructions)"
        echo ""

        if [ "$SIGNING_METHOD" = "adhoc" ]; then
            echo -e "${YELLOW}⚠️  Important: Since the app is not notarized:${NC}"
            echo "   Users must right-click and select 'Open' on first launch"
            echo "   Share the README.md with the DMG for installation instructions"
        fi
        echo ""
    else
        echo -e "${RED}✗ DMG not found in expected location${NC}"
        exit 1
    fi
else
    echo -e "${RED}✗ Bundle directory not found${NC}"
    exit 1
fi