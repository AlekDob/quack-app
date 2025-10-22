# Quack Inspector Icons

This folder should contain the following icons:

- `icon16.png` - 16x16px icon for toolbar
- `icon48.png` - 48x48px icon for extension management
- `icon128.png` - 128x128px icon for Chrome Web Store

## Design Guidelines

- Use a duck emoji 🦆 or stylized duck icon
- Orange/yellow color scheme (#FF6B35 primary)
- Simple, recognizable design
- Works well at small sizes

## Temporary Solution

For now, you can use emoji-to-image converters or create simple PNG files.

### Using ImageMagick (if installed):

```bash
# Create placeholder icons with text
convert -size 16x16 xc:orange -pointsize 10 -fill white -gravity center -annotate +0+0 "🦆" icon16.png
convert -size 48x48 xc:orange -pointsize 30 -fill white -gravity center -annotate +0+0 "🦆" icon48.png
convert -size 128x128 xc:orange -pointsize 80 -fill white -gravity center -annotate +0+0 "🦆" icon128.png
```

### Using Figma/Sketch:

1. Create new artboards at 16x16, 48x48, 128x128
2. Place duck emoji or icon
3. Export as PNG

### Online Tools:

- https://favicon.io/ - Generate icons from text/emoji
- https://www.canva.com/ - Design custom icons
- https://www.figma.com/ - Professional design tool
