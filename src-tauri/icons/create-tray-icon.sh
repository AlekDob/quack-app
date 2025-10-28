#!/bin/bash

# Create simple tray icon using ImageMagick or sips (macOS built-in)
# For now, we'll copy and rename the 32x32 icon as tray icon
# The "Template" suffix tells macOS to treat it as a template image

cp 32x32.png tray-icon.png
cp 32x32.png tray-iconTemplate.png

echo "✅ Tray icons created!"
echo "Note: For production, create a simplified monochrome version"
