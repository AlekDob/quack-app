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

```bash
xattr -d com.apple.quarantine /Applications/Quack.app
```

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
