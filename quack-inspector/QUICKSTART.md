# 🦆 Quack Inspector - Quick Start Guide

Get up and running with Quack Inspector in 5 minutes!

## Step 1: Install the Extension

### Option A: Load Unpacked (Development)

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the `quack-inspector` folder
6. Done! 🎉

### Option B: Chrome Web Store (Coming Soon)

Once published, you'll be able to install with one click.

## Step 2: Test It Out

1. Open the included `test.html` file in Chrome:
   ```bash
   open test.html
   # or just drag test.html into Chrome
   ```

2. You should see a test page with React components

## Step 3: Start Inspecting

### Method 1: Extension Icon

1. Click the Quack Inspector icon (🦆) in your Chrome toolbar
2. Click the blue "Start Inspecting" button
3. Hover over any element on the page
4. Click to inspect it
5. Component info is automatically copied to clipboard!

### Method 2: Keyboard Shortcut

1. Press `⌘ + Shift + Q` (Mac) or `Ctrl + Shift + Q` (Windows/Linux)
2. Click any element
3. Done!

## Step 4: Use the Output

After inspecting a component, your clipboard contains AI-ready markdown:

```markdown
## 🦆 Component Inspector

**Framework**: React

**Component**: `CounterButton`

**File**: Unknown

**Props**:
```json
{}
```

**State**:
```json
{
  "count": 5
}
```

**Hooks**: 1 hook(s) detected

**DOM Path**:
```css
div.container > div#root > div > div.card:nth-child(3)
```
```

## Step 5: Paste into Claude/AI

Now you can give super specific instructions to your AI assistant:

**Before Quack:**
> "Fix the counter button"

**After Quack:**
> "In the CounterButton component, the useState hook is initialized to 0. Change it to initialize from localStorage so the count persists across page refreshes."

The AI now knows:
- ✅ Exact component name
- ✅ That it uses useState
- ✅ Current implementation details
- ✅ Where in the DOM it lives

## Tips & Tricks

### Viewing History

1. Click the Quack Inspector icon
2. Scroll down to "Recent Inspections"
3. Click any item to copy it again

### DevTools Panel

1. Open Chrome DevTools (F12)
2. Click the "Quack 🦆" tab
3. Access all Quack features from DevTools

### Keyboard Shortcuts

- `⌘/Ctrl + Shift + Q` - Toggle inspector mode
- `⌘/Ctrl + Shift + C` - Copy last inspected component

You can customize these in `chrome://extensions/shortcuts`

## Real-World Example

Let's say you're working on the Quack app and want to fix the terminal drawer:

1. Open Quack app in Chrome
2. Activate Quack Inspector (`⌘ + Shift + Q`)
3. Click on the terminal drawer
4. Get this output:

```markdown
**Component**: `TerminalDrawer`
**File**: `src/components/TerminalDrawer.tsx`
**Props**: { isOpen: true, terminalId: "abc-123" }
```

5. Tell Claude:

> "In the TerminalDrawer component (src/components/TerminalDrawer.tsx), the drawer width is not respecting the 85vw inline style. The terminal is also showing horizontal lines when running commands. Can you fix both issues?"

Claude now knows:
- Exact file path ✅
- Component name ✅
- Current props ✅
- What to look for ✅

## Troubleshooting

### Extension won't activate

- Refresh the page after installing
- Check you're not on a restricted URL (chrome://, file://, etc.)

### Framework not detected

- Make sure source maps are enabled
- Try a known React/Vue/Angular app first
- Generic HTML inspection will still work!

### Copy doesn't work

- Click the extension icon and check history
- Try the keyboard shortcut instead
- Check browser clipboard permissions

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Check out [EXAMPLES.md](EXAMPLES.md) for more use cases
- Star the repo if you find it useful! 🌟

## Support

Questions? Issues? Ideas?

- 🐛 Report bugs on GitHub
- 💡 Request features in Issues
- 📖 Check the full README for more info

---

**Happy Quacking! 🦆**

*Made with ❤️ by Quack Agency*
