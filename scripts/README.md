# Quack Scripts

Helper scripts for development and build processes.

## 🪟 Windows Scripts

### `setup-windows.ps1`

**Purpose**: Complete Windows development environment setup

**What it does**:
1. Installs Git (via winget)
2. Installs Node.js LTS (via winget)
3. Verifies npx is in PATH (required for MCP servers)
4. Installs Rust (via rustup)
5. Installs Visual Studio Build Tools
6. Installs Tauri CLI
7. Installs npm dependencies

**Usage**:
```powershell
# Run from project root
powershell -ExecutionPolicy Bypass -File scripts/setup-windows.ps1
```

**Requirements**:
- Windows 10/11
- winget (Windows Package Manager) - pre-installed on modern Windows

### `verify-setup.ps1`

**Purpose**: Verify all required tools are installed correctly

**Usage**:
```powershell
powershell -ExecutionPolicy Bypass -File scripts/verify-setup.ps1
```

### `dev.ps1`

**Purpose**: Start development server on Windows

**Usage**:
```powershell
.\scripts\dev.ps1
# or
npm run dev:win
```

### `build-windows.ps1`

**Purpose**: Build production release for Windows

**Usage**:
```powershell
.\scripts\build-windows.ps1
# or
npm run tauri:build:win
```

---

## 🍎 macOS/Linux Scripts

### `dev.sh`

**Purpose**: Start Tauri development server with proper environment setup

**What it does**:
1. Sets up Node.js PATH (v22.21.0 via NVM)
2. Sets up Rust/Cargo PATH
3. Displays version information
4. Runs `npm run tauri:dev`

**Usage**:
```bash
# Via npm script (recommended)
npm run tauri:dev

# Or directly
./scripts/dev.sh
```

**Requirements**:
- Node.js v22.21.0 installed at `~/.nvm/versions/node/v22.21.0/`
- Cargo installed at `~/.cargo/bin/`

**Why it exists**:
- Ensures consistent environment across different terminal sessions
- Fixes "cargo: command not found" errors
- Ensures Node.js version meets Vite requirements (20.19+ or 22.12+)
- See `docs/02-bug-fixes/03-mcp-integration-fix.md` for details

---

## 🔧 Build Scripts

### `optimize-bundle.sh`

**Purpose**: Optimize the Tauri bundle after building

**Usage**:
```bash
./scripts/optimize-bundle.sh
```

**Note**: Called automatically by `npm run tauri:build`

---

## 📝 Adding New Scripts

When adding a new script:

1. **Make it executable**: `chmod +x scripts/your-script.sh`
2. **Add shebang**: Start with `#!/bin/bash`
3. **Document here**: Add usage instructions
4. **Add to package.json**: If it should be a npm script

### Script Template

```bash
#!/bin/bash
# Brief description of what this script does

# Exit on error
set -e

# Your script logic here
echo "🚀 Starting..."
# ...
echo "✅ Done!"
```

---

## 🐛 Troubleshooting

### Windows: "npx not found" (MCP servers fail)

This is usually a PATH issue. The Quack app now uses `cmd /c npx` internally to work around this, but you should still verify:

```powershell
# Check if npx is available
npx --version

# If not, restart your terminal after Node.js installation
# Or manually add Node.js to PATH
```

### Windows: "Permission denied" running scripts

```powershell
# Allow script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Windows: IDE not detected

Make sure your IDE is installed in a standard location:
- VS Code: `%LOCALAPPDATA%\Programs\Microsoft VS Code\`
- Cursor: `%LOCALAPPDATA%\Programs\cursor\`
- JetBrains IDEs: `%ProgramFiles%\JetBrains\`

### macOS/Linux: "Permission denied" error
```bash
chmod +x scripts/your-script.sh
```

### macOS/Linux: "cargo: command not found"
The `dev.sh` script should fix this. If it persists, check:
```bash
# Verify Cargo is installed
ls ~/.cargo/bin/cargo

# Manually add to PATH
export PATH="$HOME/.cargo/bin:$PATH"
```

### macOS/Linux: "Node version too old"
The `dev.sh` script uses Node v22.21.0. Verify:
```bash
# Check NVM installation
ls ~/.nvm/versions/node/v22.21.0/bin/node

# If missing, install Node 22
nvm install 22
```

---

## 📚 Related Documentation

- [MCP Integration Fix](../docs/02-bug-fixes/03-mcp-integration-fix.md) - Why `dev.sh` was created
- [Build Setup](../docs/04-build-setup/) - Build configuration docs
- [Architecture](../docs/01-architecture.md) - Overall system architecture
