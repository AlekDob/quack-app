#!/bin/bash
# Create temporary SVG-based PNG icons for Quack Inspector

# Create a base SVG with duck emoji
create_icon() {
  size=$1
  output=$2
  
  cat > temp.svg << SVGEOF
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#FF6B35" rx="$((size/8))"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="$((size*6/10))" fill="white">🦆</text>
</svg>
SVGEOF

  # Check if we have convert (ImageMagick) or rsvg-convert
  if command -v convert &> /dev/null; then
    convert temp.svg "${output}"
  elif command -v rsvg-convert &> /dev/null; then
    rsvg-convert -w ${size} -h ${size} temp.svg -o "${output}"
  else
    echo "Warning: Neither ImageMagick nor librsvg installed. Creating placeholder..."
    # Create a simple colored square as fallback using base64 PNG
    # This is a minimal valid PNG file
    echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" | base64 -d > "${output}"
  fi
  
  rm -f temp.svg
}

echo "🦆 Creating Quack Inspector icons..."

create_icon 16 icon16.png
create_icon 48 icon48.png
create_icon 128 icon128.png

echo "✅ Icons created successfully!"
ls -lh *.png
