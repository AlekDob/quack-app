# Quack App - Windows Build Guide

Complete guide to build Quack App on Windows.

## Prerequisites

### Quick Setup (Recommended)

Run the setup script to install all dependencies automatically:

```powershell
# Run from project root
.\scripts\setup-windows.ps1
```

Or via npm:

```powershell
npm run setup:win
```

### Manual Setup

If you prefer manual installation:

1. **Node.js (v18+)**
   - Download from https://nodejs.org
   - Or via winget: `winget install OpenJS.NodeJS.LTS`

2. **Rust (stable)**
   - Download from https://rustup.rs
   - Or via winget: `winget install Rustlang.Rustup`

3. **Visual Studio Build Tools**
   - Download from https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - Select "Desktop development with C++" workload
   - Or via winget: `winget install Microsoft.VisualStudio.2022.BuildTools`

4. **Tauri CLI**
   ```powershell
   cargo install tauri-cli
   ```

5. **npm dependencies**
   ```powershell
   npm install
   cd src-tauri/node-sdk && npm install --production
   ```

---

## Development

### Start Development Server

```powershell
# Via PowerShell script (recommended)
.\scripts\dev.ps1

# Or via npm
npm run dev:win
```

This will:
- Check all prerequisites
- Free port 5174 if in use
- Start the Tauri development server with hot reload

### Development Notes

- The dev server runs on `http://localhost:5174`
- Changes to React code will hot reload automatically
- Changes to Rust code will trigger a recompile

---

## Production Build

### Standard Build

```powershell
# Via PowerShell script (recommended)
.\scripts\build-windows.ps1

# Or via npm
npm run tauri:build:win
```

### Debug Build (faster, larger)

```powershell
.\scripts\build-windows.ps1 -Debug

# Or via npm
npm run tauri:build:win:debug
```

### Skip Bundle Optimization

```powershell
.\scripts\build-windows.ps1 -SkipOptimize
```

---

## Build Output

After a successful build, installers are created in:

```
src-tauri/target/release/bundle/
├── msi/
│   └── Quack_x.x.x_x64_en-US.msi    # MSI installer
└── nsis/
    └── Quack_x.x.x_x64-setup.exe    # NSIS installer (recommended)
```

### Installer Types

| Type | Format | Use Case |
|------|--------|----------|
| NSIS | .exe | Recommended for end users |
| MSI | .msi | Enterprise/silent deployment |

---

## Build Times

| Build Type | Approx. Time | Size |
|------------|--------------|------|
| First build | 15-25 min | ~100 MB |
| Subsequent | 3-8 min | ~100 MB |
| Debug | 2-5 min | ~200 MB |

**Note**: First build is slower because Rust compiles all dependencies.

---

## Troubleshooting

### "cargo not found"

Rust is not in PATH. Either:
- Open a new terminal after installing Rust
- Or add manually: `$env:Path += ";$env:USERPROFILE\.cargo\bin"`

### "Visual Studio Build Tools not found"

Install Visual Studio Build Tools with "Desktop development with C++" workload:
```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```

Then open Visual Studio Installer and add the C++ workload.

### Build fails with link errors

Ensure you have the Windows 10/11 SDK installed. This comes with the C++ workload.

### Port 5174 already in use

The dev script automatically frees the port, but if needed:
```powershell
# Find process using port 5174
Get-NetTCPConnection -LocalPort 5174 | Select-Object -ExpandProperty OwningProcess

# Kill it
Stop-Process -Id <PID> -Force
```

### WebView2 issues

Tauri requires Microsoft Edge WebView2. On Windows 10/11, it's usually pre-installed.
If not, the installer will download it automatically (configured in `tauri.conf.json`).

---

## npm Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev:win` | Start development server |
| `npm run tauri:build:win` | Production build |
| `npm run tauri:build:win:debug` | Debug build |
| `npm run setup:win` | Install all prerequisites |

---

## Code Signing (Optional)

For production distribution, you should sign your application:

1. Obtain a code signing certificate
2. Set the certificate thumbprint in `tauri.conf.json`:
   ```json
   "windows": {
     "certificateThumbprint": "YOUR_CERT_THUMBPRINT"
   }
   ```
3. Or use environment variable:
   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY = "..."
   ```

---

## Distribution Checklist

- [ ] Build in release mode (`npm run tauri:build:win`)
- [ ] Test the installer on a clean Windows machine
- [ ] Consider code signing for production
- [ ] Include Windows Defender exclusion instructions if needed
- [ ] Test auto-updater functionality

---

**Documentation generated for Quack Agency**
