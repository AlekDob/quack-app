# Quack - Windows Guide

Complete guide for developing, building, and distributing Quack on Windows.

## System Requirements

- Windows 10 (1809+) or Windows 11
- x64 architecture
- Microsoft Edge WebView2 (usually pre-installed on Windows 10/11)

## Prerequisites

### Quick Setup (Recommended)

```powershell
npm run setup:win
```

This installs all dependencies automatically.

### Manual Setup

1. **Node.js (v18+)**
   - Download from https://nodejs.org
   - Or: `winget install OpenJS.NodeJS.LTS`

2. **Rust (stable)**
   - Download from https://rustup.rs
   - Or: `winget install Rustlang.Rustup`

3. **Visual Studio Build Tools**
   - Download from https://visualstudio.microsoft.com/visual-cpp-build-tools/
   - Select "Desktop development with C++" workload
   - Or: `winget install Microsoft.VisualStudio.2022.BuildTools`

4. **Tauri CLI**
   ```powershell
   cargo install tauri-cli
   ```

5. **npm dependencies**
   ```powershell
   npm install
   cd src-tauri\node-sdk; npm install --production; cd ..\..
   ```

## Development

```powershell
npm run dev:win
```

This will:
- Check all prerequisites
- Free port 5174 if in use
- Load `.env` file for Rust compile-time variables
- Start the Tauri dev server with hot reload on `http://localhost:5174`

## Build Commands

### Production Build

```powershell
npm run build:win
```

### Debug Build (faster, larger)

```powershell
npm run build:win:debug
```

## Build Output

Installers are created in `src-tauri\target\release\bundle\`:

```
bundle\
  nsis\
    Quack_x.x.x_x64-setup.exe    # NSIS installer (recommended)
  msi\
    Quack_x.x.x_x64_en-US.msi    # MSI installer
```

| Installer | Format | Use Case |
|-----------|--------|----------|
| NSIS | .exe | Recommended for end users |
| MSI | .msi | Enterprise / silent deployment |

## Build Times

| Build Type | Time | Size |
|------------|------|------|
| First build | 15-25 min | ~100 MB |
| Subsequent | 3-8 min | ~100 MB |
| Debug | 2-5 min | ~200 MB |

First build is slower because Rust compiles all dependencies.

## Bundle Optimization

After building, you can optimize the bundle to remove unused platform binaries and reduce installer size:

```powershell
npm run optimize-bundle:win
```

## Release Workflow

Quack uses a `production` branch to trigger automated releases via GitHub Actions.

```powershell
# First time: create the production branch
npm run release:create-branch

# Prepare release (merge main into production)
npm run release:prepare

# Publish (push to trigger GitHub Actions)
npm run release:publish
```

GitHub Actions will automatically build, package, and create a GitHub Release with the Windows installer.

## Code Signing (Optional)

For production distribution:

1. Obtain a code signing certificate
2. Set the certificate thumbprint in `tauri.conf.json`:
   ```json
   "windows": {
     "certificateThumbprint": "YOUR_CERT_THUMBPRINT"
   }
   ```
3. Or set via environment variable:
   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY = "..."
   ```

## Troubleshooting

### "cargo not found"

Rust is not in PATH. Either:
- Open a new terminal after installing Rust
- Or add manually: `$env:Path += ";$env:USERPROFILE\.cargo\bin"`

### "Visual Studio Build Tools not found"

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```

Then open Visual Studio Installer and add the "Desktop development with C++" workload.

### Build fails with link errors

Ensure you have the Windows 10/11 SDK installed. This comes with the C++ workload.

### Port 5174 already in use

The dev script frees the port automatically. If needed:

```powershell
Get-NetTCPConnection -LocalPort 5174 | Select-Object -ExpandProperty OwningProcess
Stop-Process -Id <PID> -Force
```

### WebView2 issues

Tauri requires Microsoft Edge WebView2. On Windows 10/11 it's usually pre-installed. If not, the installer downloads it automatically.

## npm Scripts Reference

| Script | Description |
|--------|-------------|
| `dev:win` | Start dev server with hot reload |
| `build:win` | Production build |
| `build:win:debug` | Debug build |
| `optimize-bundle:win` | Optimize bundle size |
| `setup:win` | Install all prerequisites |
| `release:create-branch` | Create production branch (first time) |
| `release:prepare` | Merge main into production |
| `release:publish` | Push to trigger CI/CD |

## Distribution Checklist

- [ ] Build in release mode (`npm run build:win`)
- [ ] Test the installer on a clean Windows machine
- [ ] Consider code signing for production
- [ ] Test auto-updater functionality
