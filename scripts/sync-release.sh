#!/bin/bash

# Quack - Release Sync Script
# Copies built DMG/MSI/AppImage files to quackagency-website for deployment

set -e

WEBSITE_PATH="/Users/alekdob/Desktop/Dev/Personal/quackagency-website"
DOWNLOADS_PATH="$WEBSITE_PATH/public/downloads"
BUILD_PATH="src-tauri/target/release/bundle"

echo "🦆 Quack Release Sync Script"
echo "=============================="
echo ""

# Check if website folder exists
if [ ! -d "$WEBSITE_PATH" ]; then
  echo "❌ Error: quackagency-website not found at $WEBSITE_PATH"
  exit 1
fi

# Create downloads folder if it doesn't exist
mkdir -p "$DOWNLOADS_PATH"

echo "📦 Copying build artifacts..."
echo ""

# Copy macOS DMG files
if [ -d "$BUILD_PATH/dmg" ]; then
  echo "📀 Copying macOS DMG files..."
  cp -v "$BUILD_PATH/dmg"/*.dmg "$DOWNLOADS_PATH/" 2>/dev/null || echo "  ⚠️  No DMG files found"
fi

# Copy Windows MSI files
if [ -d "$BUILD_PATH/msi" ]; then
  echo "🪟 Copying Windows MSI files..."
  cp -v "$BUILD_PATH/msi"/*.msi "$DOWNLOADS_PATH/" 2>/dev/null || echo "  ⚠️  No MSI files found"
fi

# Copy Linux AppImage files
if [ -d "$BUILD_PATH/appimage" ]; then
  echo "🐧 Copying Linux AppImage files..."
  cp -v "$BUILD_PATH/appimage"/*.AppImage "$DOWNLOADS_PATH/" 2>/dev/null || echo "  ⚠️  No AppImage files found"
fi

echo ""
echo "✅ Files copied to: $DOWNLOADS_PATH"
echo ""
echo "📋 Files available for download:"
ls -lh "$DOWNLOADS_PATH"
echo ""
echo "🚀 Next steps:"
echo "  1. cd $WEBSITE_PATH"
echo "  2. vercel --prod"
echo ""
echo "🦆 Quack quack! Release synced successfully!"
