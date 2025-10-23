#!/bin/bash

# Fix DMG Visual Issues Script
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

# Hide system files
echo "Hiding system files..."
if [ -f "$MOUNT_POINT/.VolumeIcon.icns" ]; then
    SetFile -a V "$MOUNT_POINT/.VolumeIcon.icns" 2>/dev/null || chflags hidden "$MOUNT_POINT/.VolumeIcon.icns"
    echo "✓ Hidden .VolumeIcon.icns"
fi

if [ -f "$MOUNT_POINT/.background" ]; then
    SetFile -a V "$MOUNT_POINT/.background" 2>/dev/null || chflags hidden "$MOUNT_POINT/.background"
    echo "✓ Hidden .background"
fi

if [ -f "$MOUNT_POINT/.DS_Store" ]; then
    SetFile -a V "$MOUNT_POINT/.DS_Store" 2>/dev/null || chflags hidden "$MOUNT_POINT/.DS_Store"
    echo "✓ Hidden .DS_Store"
fi

if [ -f "$MOUNT_POINT/.fseventsd" ]; then
    SetFile -a V "$MOUNT_POINT/.fseventsd" 2>/dev/null || chflags hidden "$MOUNT_POINT/.fseventsd"
    echo "✓ Hidden .fseventsd"
fi

# Create proper window settings with AppleScript
echo "Configuring DMG window..."
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
        set icon size of theViewOptions to 72
        set position of item "Quack.app" of container window to {180, 170}
        set position of item "Applications" of container window to {480, 170}
        close
        open
        update without registering applications
        delay 2
    end tell
end tell
EOF

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