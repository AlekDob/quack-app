# Quack - Linux Guide

Complete guide for developing, building, and distributing Quack on Linux.

## Supported Distributions

- **Ubuntu** 22.04+ / Debian 12+
- **Fedora** 38+
- **Arch Linux** / Manjaro

## Quick Start

```bash
# 1. Install system dependencies
npm run setup:linux

# 2. Install npm dependencies
npm install
cd src-tauri/node-sdk && npm install --production && cd ../..

# 3. Run in development mode
npm run dev:linux

# 4. Build for production
npm run build:linux
```

## Manual Setup

If you prefer to install dependencies manually:

### Ubuntu / Debian

```bash
sudo apt update

# Core Tauri dependencies
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf

# Build tools
sudo apt install -y \
  build-essential \
  curl \
  wget \
  file \
  pkg-config

# SSL and secure storage
sudo apt install -y \
  libssl-dev \
  libsecret-1-dev

# Additional libraries
sudo apt install -y \
  libglib2.0-dev \
  libcairo2-dev \
  libpango1.0-dev \
  libgdk-pixbuf-2.0-dev \
  libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev
```

### Fedora / RHEL

```bash
sudo dnf update -y

sudo dnf install -y \
  webkit2gtk4.1-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel

sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y curl wget file pkg-config

sudo dnf install -y \
  openssl-devel \
  libsecret-devel \
  glib2-devel \
  cairo-devel \
  pango-devel \
  gdk-pixbuf2-devel \
  libsoup3-devel \
  javascriptcoregtk4.1-devel
```

### Arch Linux

```bash
sudo pacman -Syu --noconfirm

sudo pacman -S --noconfirm --needed \
  webkit2gtk-4.1 gtk3 libayatana-appindicator librsvg \
  base-devel curl wget file pkgconf \
  openssl libsecret glib2 cairo pango gdk-pixbuf2 libsoup3
```

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Verify (minimum required: 1.77.2)
rustc --version
```

### Install Node.js

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

nvm install --lts
nvm use --lts
```

### Install Tauri CLI

```bash
cargo install tauri-cli
```

## Development

```bash
npm run dev:linux
```

Starts the Tauri dev server with hot reload on `http://localhost:5174`.

## Build Commands

### Build All Formats (deb + AppImage)

```bash
npm run build:linux
```

### Build Specific Format

```bash
npm run build:linux:deb        # .deb only (Debian/Ubuntu)
npm run build:linux:appimage   # AppImage only (Universal)
```

Output files are placed in `dist-linux/`.

### Bundle Optimization

```bash
npm run optimize-bundle:linux
```

Removes unused platform binaries, source maps, and test files from the node-sdk to reduce bundle size.

## Release

```bash
# Full release (build + optimize + package + checksums)
npm run release:linux

# Release specific format
npm run release:linux:deb
npm run release:linux:appimage
```

## Package Formats

### .deb (Debian/Ubuntu)

```bash
# Install
sudo dpkg -i dist-linux/quack_*.deb

# Fix missing dependencies
sudo apt-get install -f

# Uninstall
sudo apt remove quack
```

### AppImage (Universal)

```bash
# Make executable and run
chmod +x dist-linux/Quack_*.AppImage
./dist-linux/Quack_*.AppImage
```

### .rpm (Fedora/RHEL)

```bash
# Install
sudo dnf install ./dist-linux/quack_*.rpm

# Uninstall
sudo dnf remove quack
```

## Feature Support

| Feature | Status | Notes |
|---------|--------|-------|
| Core UI | Full | |
| Terminal emulator | Full | PTY-based |
| Native terminal integration | Full | gnome-terminal, konsole, etc. |
| System tray | Full | Requires libayatana-appindicator |
| Transparent windows | Partial | Requires compositor |
| Keychain / Secrets | Full | Via libsecret |
| File explorer | Full | |
| Git integration | Full | |
| AI integration | Full | |

## Known Limitations

1. **Window title bar:** Uses standard GTK decorations instead of macOS overlay style.
2. **Dock badge:** The "DEV" badge is macOS-only. Linux shows "[DEV MODE]" in the title.
3. **Window focus/close:** Requires `wmctrl` or `xdotool` for native terminal focus operations.

## Troubleshooting

### WebKitGTK not found

```
error: could not find system library 'webkit2gtk-4.1'
```

```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel

# Arch
sudo pacman -S webkit2gtk-4.1
```

### Tray icon not showing

Some desktop environments (e.g. vanilla GNOME) don't show tray icons by default. Install the "AppIndicator and KStatusNotifierItem Support" extension.

```bash
# Ubuntu/Debian
sudo apt install libayatana-appindicator3-1

# Fedora
sudo dnf install libappindicator-gtk3

# Arch
sudo pacman -S libayatana-appindicator
```

### Keychain / secret storage issues

```bash
# Ubuntu/Debian
sudo apt install libsecret-1-0 gnome-keyring

# Fedora
sudo dnf install libsecret gnome-keyring

# Arch
sudo pacman -S libsecret gnome-keyring

# Start keyring daemon if not running
eval $(gnome-keyring-daemon --start)
export SSH_AUTH_SOCK
```

### Transparent window shows black background

Requires a compositor:
- **X11:** Enable `picom`, `compton`, or your desktop's built-in compositor
- **Wayland:** Compositor is always enabled, but transparency may behave differently

### AppImage won't run

```bash
# Install FUSE
sudo apt install fuse libfuse2

# Make executable
chmod +x Quack_*.AppImage

# Alternative: extract and run
./Quack_*.AppImage --appimage-extract
./squashfs-root/AppRun
```

### pkg-config not found

```bash
# Ubuntu/Debian
sudo apt install pkg-config

# Fedora
sudo dnf install pkg-config

# Arch
sudo pacman -S pkgconf
```

### Window management tools (optional)

For native terminal integration:

```bash
# Ubuntu/Debian
sudo apt install wmctrl xdotool

# Fedora
sudo dnf install wmctrl xdotool

# Arch
sudo pacman -S wmctrl xdotool
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TERMINAL` | Preferred terminal emulator | Auto-detected |
| `DISPLAY` | X11 display | `:0` |
| `WAYLAND_DISPLAY` | Wayland display | Auto-detected |
| `APPIMAGE_EXTRACT_AND_RUN` | Run AppImage tools without FUSE (VMs) | Not set |

## npm Scripts Reference

| Script | Description |
|--------|-------------|
| `dev:linux` | Start dev server with hot reload |
| `build:linux` | Build all formats (deb + AppImage) |
| `build:linux:deb` | Build .deb package only |
| `build:linux:appimage` | Build AppImage only |
| `optimize-bundle:linux` | Optimize node-sdk bundle size |
| `release:linux` | Full release pipeline |
| `release:linux:deb` | Release .deb only |
| `release:linux:appimage` | Release AppImage only |
| `setup:linux` | Install system dependencies |
