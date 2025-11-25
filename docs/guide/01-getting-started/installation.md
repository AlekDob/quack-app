# Installation

Learn how to install and set up Quack on your machine.

## System Requirements

Before installing Quack, ensure your system meets these requirements:

### Operating System
- **macOS** 10.15 (Catalina) or later
- **Windows** 10/11
- **Linux** (Ubuntu 20.04+, Fedora 34+, or equivalent)

### Software Requirements
- **Node.js** 18.17.0 or higher
- **npm** (comes with Node.js)
- **Rust** 1.77.2 or higher (for building from source)

## Download Quack

### Option 1: Pre-built Binaries (Recommended)

Download the latest release for your platform:

**macOS**:
```bash
# Download DMG from GitHub Releases
# Coming soon...
```

**Windows**:
```bash
# Download MSI installer from GitHub Releases
# Coming soon...
```

**Linux**:
```bash
# Download AppImage or .deb package
# Coming soon...
```

### Option 2: Build from Source

If you want to build Quack from source:

```bash
# Clone the repository
git clone https://github.com/alekdob/quack-app
cd quack-app

# Install dependencies
npm install

# Build the app
npm run tauri:build

# The built app will be in src-tauri/target/release/
```

## First Launch

After installation:

1. **Launch Quack** from your Applications folder (macOS) or Start Menu (Windows)
2. **Grant permissions** when prompted (terminal access, file system)
3. **Configure Claude API** (if you haven't already)

### Setting up Claude API

Quack requires a Claude API key to function. You can get one from [console.anthropic.com](https://console.anthropic.com).

**In Quack**:
1. Open Settings (Cmd/Ctrl + ,)
2. Navigate to "API Configuration"
3. Enter your Anthropic API key
4. Click "Save"

**Alternatively**, set an environment variable:

```bash
# macOS/Linux
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Windows
setx ANTHROPIC_API_KEY "sk-ant-your-key-here"
```

## Verify Installation

To verify Quack is working correctly:

1. Open a new terminal tab (Cmd/Ctrl + T)
2. Run a simple command: `echo "Hello Quack!"`
3. Ask Claude a question in the chat panel
4. Check that file explorer shows your project files

If everything works, you're ready to start using Quack! 🎉

## Troubleshooting

### Terminal Not Working

If terminals aren't launching:
- **macOS**: Grant Terminal access in System Preferences > Security & Privacy
- **Windows**: Run Quack as Administrator
- **Linux**: Check shell configuration in `~/.bashrc` or `~/.zshrc`

### Claude API Errors

If you see API errors:
- Verify your API key is correct
- Check you have credits in your Anthropic account
- Ensure you're connected to the internet

### File Explorer Not Showing Files

If file explorer is empty:
- Navigate to a project directory using the path input
- Check file permissions
- Try refreshing (Cmd/Ctrl + R)

---

**Next**: [First Steps →](./first-steps)
**Previous**: [← Introduction](./introduction)
