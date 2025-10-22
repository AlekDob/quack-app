#!/usr/bin/env python3
"""Create proper PNG icons for Quack Inspector"""

from PIL import Image, ImageDraw, ImageFont
import sys

def create_icon(size, output):
    """Create a PNG icon with orange background and duck emoji"""
    # Create image with orange background
    img = Image.new('RGB', (size, size), '#FF6B35')
    draw = ImageDraw.Draw(img)
    
    # Try to load a font for the emoji, fallback to default
    try:
        # Try to use a system font that supports emoji
        font_size = int(size * 0.6)
        font = ImageFont.truetype("/System/Library/Fonts/Apple Color Emoji.ttc", font_size)
    except:
        try:
            font = ImageFont.truetype("/Library/Fonts/Arial Unicode.ttf", int(size * 0.6))
        except:
            # Fallback: draw a simple shape instead
            font = None
    
    if font:
        # Draw duck emoji
        text = "🦆"
        # Get text bounding box
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        # Center the text
        x = (size - text_width) // 2 - bbox[0]
        y = (size - text_height) // 2 - bbox[1]
        
        draw.text((x, y), text, fill='white', font=font)
    else:
        # Fallback: draw a simple circle
        margin = size // 4
        draw.ellipse([margin, margin, size-margin, size-margin], fill='white')
        
    # Save the image
    img.save(output, 'PNG')
    print(f"✅ Created {output} ({size}x{size})")

if __name__ == '__main__':
    try:
        create_icon(16, 'icon16.png')
        create_icon(48, 'icon48.png')
        create_icon(128, 'icon128.png')
        print("🦆 All icons created successfully!")
    except ImportError:
        print("❌ PIL/Pillow not installed. Installing...")
        import subprocess
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pillow'])
        print("✅ Pillow installed. Please run the script again.")
