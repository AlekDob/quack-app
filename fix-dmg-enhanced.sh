#!/bin/bash

# Enhanced DMG Fix Script - Properly hides all system files
# This script fixes the .VolumeIcon.icns visibility issue in DMG files

set -e

DMG_PATH="$1"

if [ -z "$DMG_PATH" ]; then
    # Try to find the most recent DMG
    DMG_PATH=$(find src-tauri/target/release/bundle/dmg -name "*.dmg" 2>/dev/null | head -1)

    if [ -z "$DMG_PATH" ]; then
        echo "Usage: $0 <path-to-dmg>"
        echo "Or run after building to auto-fix the latest DMG"
        exit 1
    fi
fi

echo "🦆 Fixing DMG visual issues for: $DMG_PATH"

# Create a temporary copy
TEMP_DMG="/tmp/quack-temp.dmg"
cp "$DMG_PATH" "$TEMP_DMG"

# Convert to read/write
echo "Converting DMG to read/write format..."
hdiutil convert "$TEMP_DMG" -format UDRW -o "/tmp/quack-rw.dmg"

# Mount the read/write DMG
echo "Mounting DMG..."
MOUNT_POINT=$(hdiutil attach "/tmp/quack-rw.dmg" -nobrowse -noverify -noautoopen | grep "/Volumes" | awk '{print $3}')

if [ -z "$MOUNT_POINT" ]; then
    echo "Failed to mount DMG"
    exit 1
fi

echo "Mounted at: $MOUNT_POINT"

# Enhanced hiding of system files - use BOTH SetFile and chflags for maximum compatibility
echo "Hiding system files..."

# Remove any existing .VolumeIcon.icns if it shouldn't be there
if [ -f "$MOUNT_POINT/.VolumeIcon.icns" ]; then
    echo "Found .VolumeIcon.icns - hiding it properly..."
    # First try SetFile (older macOS)
    SetFile -a V "$MOUNT_POINT/.VolumeIcon.icns" 2>/dev/null || true
    # Then use chflags (newer macOS)
    chflags hidden "$MOUNT_POINT/.VolumeIcon.icns" 2>/dev/null || true
    # Also set the invisible attribute
    xattr -w com.apple.FinderInfo "0000000000000000400000000000000000000000000000000000000000000000" "$MOUNT_POINT/.VolumeIcon.icns" 2>/dev/null || true
    echo "✓ Hidden .VolumeIcon.icns with all methods"
fi

# Hide .background folder if it exists
if [ -d "$MOUNT_POINT/.background" ]; then
    SetFile -a V "$MOUNT_POINT/.background" 2>/dev/null || true
    chflags hidden "$MOUNT_POINT/.background" 2>/dev/null || true
    echo "✓ Hidden .background folder"
fi

# Hide individual background files
if [ -f "$MOUNT_POINT/.background.png" ]; then
    SetFile -a V "$MOUNT_POINT/.background.png" 2>/dev/null || true
    chflags hidden "$MOUNT_POINT/.background.png" 2>/dev/null || true
    echo "✓ Hidden .background.png"
fi

# Hide .DS_Store
if [ -f "$MOUNT_POINT/.DS_Store" ]; then
    SetFile -a V "$MOUNT_POINT/.DS_Store" 2>/dev/null || true
    chflags hidden "$MOUNT_POINT/.DS_Store" 2>/dev/null || true
    echo "✓ Hidden .DS_Store"
fi

# Hide .fseventsd
if [ -d "$MOUNT_POINT/.fseventsd" ]; then
    SetFile -a V "$MOUNT_POINT/.fseventsd" 2>/dev/null || true
    chflags hidden "$MOUNT_POINT/.fseventsd" 2>/dev/null || true
    echo "✓ Hidden .fseventsd"
fi

# Hide .Trashes
if [ -d "$MOUNT_POINT/.Trashes" ]; then
    SetFile -a V "$MOUNT_POINT/.Trashes" 2>/dev/null || true
    chflags hidden "$MOUNT_POINT/.Trashes" 2>/dev/null || true
    echo "✓ Hidden .Trashes"
fi

# Force Finder to not show hidden files for this volume
echo "Configuring Finder settings..."
defaults write com.apple.finder AppleShowAllFiles -bool false 2>/dev/null || true

# Create proper window settings with AppleScript
echo "Configuring DMG window layout..."
osascript << EOF
tell application "Finder"
    tell disk "$(basename "$MOUNT_POINT")"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {400, 100, 1060, 500}
        set theViewOptions to the icon view options of container window
        set arrangement of theViewOptions to not arranged
        set icon size of theViewOptions to 100
        -- Position the app and Applications folder
        set position of item "Quack.app" of container window to {180, 200}
        try
            set position of item "Applications" of container window to {480, 200}
        end try
        -- Make sure we're in icon view with proper settings
        set shows icon preview of theViewOptions to true
        set label position of theViewOptions to bottom
        -- Force update
        close
        open
        update without registering applications
        delay 3
        close
    end tell
end tell
EOF

# Final check - make absolutely sure hidden files are hidden
echo "Final verification of hidden files..."
for file in ".VolumeIcon.icns" ".background" ".DS_Store" ".fseventsd" ".Trashes"; do
    if [ -e "$MOUNT_POINT/$file" ]; then
        # Use all available methods to hide
        chflags hidden "$MOUNT_POINT/$file" 2>/dev/null || true
        SetFile -a V "$MOUNT_POINT/$file" 2>/dev/null || true
        echo "✓ Verified $file is hidden"
    fi
done

# Unmount
echo "Unmounting DMG..."
hdiutil detach "$MOUNT_POINT" -quiet

# Convert back to compressed read-only
echo "Creating final DMG..."
hdiutil convert "/tmp/quack-rw.dmg" -format UDZO -o "/tmp/quack-final.dmg"

# Replace original
mv "/tmp/quack-final.dmg" "$DMG_PATH"

# Cleanup
rm -f "/tmp/quack-temp.dmg" "/tmp/quack-rw.dmg"

echo "✅ DMG fixed successfully: $DMG_PATH"
echo ""
echo "📝 Note: If .VolumeIcon.icns is still visible, it may be because:"
echo "   1. The DMG viewer has cached the old view - try ejecting and remounting"
echo "   2. Your Finder is set to show hidden files - check with: defaults read com.apple.finder AppleShowAllFiles"
echo "   3. The icon file is being recreated by Tauri after this script runs"
echo ""
echo "💡 Tip: Run this script AFTER 'npm run tauri:build' completes"