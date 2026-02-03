# Quack - Linux Setup Guide

This guide covers setting up the development environment and building Quack on Linux.

## Supported Distributions

- **Ubuntu** 22.04+ / Debian 12+
- **Fedora** 38+
- **Arch Linux** / Manjaro

## Quick Start

```bash
# 1. Run the setup script to install all dependencies
./scripts/setup-linux.sh

# 2. Install npm dependencies
npm install

# 3. Run in development mode
npm run tauri:dev

# 4. Build for production
./build-linux.sh
```

## Manual Setup

If you prefer to install dependencies manually or the setup script doesn't work for your distribution:

### Ubuntu / Debian

```bash
# Update package list
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

# SSL and crypto (for keychain/secure storage)
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
# Update system
sudo dnf update -y

# Core Tauri dependencies
sudo dnf install -y \
  webkit2gtk4.1-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel

# Build tools
sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y \
  curl \
  wget \
  file \
  pkg-config

# SSL and crypto
sudo dnf install -y \
  openssl-devel \
  libsecret-devel

# Additional libraries
sudo dnf install -y \
  glib2-devel \
  cairo-devel \
  pango-devel \
  gdk-pixbuf2-devel \
  libsoup3-devel \
  javascriptcoregtk4.1-devel
```

### Arch Linux

```bash
# Update system
sudo pacman -Syu --noconfirm

# Core Tauri dependencies
sudo pacman -S --noconfirm --needed \
  webkit2gtk-4.1 \
  gtk3 \
  libayatana-appindicator \
  librsvg

# Build tools
sudo pacman -S --noconfirm --needed \
  base-devel \
  curl \
  wget \
  file \
  pkgconf

# SSL and crypto
sudo pacman -S --noconfirm --needed \
  openssl \
  libsecret

# Additional libraries
sudo pacman -S --noconfirm --needed \
  glib2 \
  cairo \
  pango \
  gdk-pixbuf2 \
  libsoup3
```

### Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Verify installation (minimum required: 1.77.2)
rustc --version
```

### Install Node.js

Using nvm (recommended):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc  # or ~/.zshrc

nvm install --lts
nvm use --lts

# Verify installation
node --version
npm --version
```

### Install Tauri CLI

```bash
cargo install tauri-cli
```

## Development

### Running in Development Mode

```bash
# Start the development server with hot reload
npm run tauri:dev
```

### Building for Production

```bash
# Build all formats (deb, AppImage)
./build-linux.sh

# Build only .deb package
./build-linux.sh --deb

# Build only AppImage
./build-linux.sh --appimage

# Build only .rpm package (requires rpmbuild)
./build-linux.sh --rpm

# Skip frontend build (use existing dist/)
./build-linux.sh --skip-frontend
```

Output files will be in:
- `dist-linux/` - Distribution-ready packages
- `src-tauri/target/release/bundle/` - Raw build output

## Package Formats

### .deb (Debian/Ubuntu)

```bash
# Install
sudo dpkg -i dist-linux/quack_*.deb

# If dependencies are missing
sudo apt-get install -f

# Uninstall
sudo apt remove quack
```

### AppImage (Universal)

```bash
# Make executable
chmod +x dist-linux/Quack_*.AppImage

# Run directly
./dist-linux/Quack_*.AppImage

# Or integrate with AppImageLauncher
```

### .rpm (Fedora/RHEL)

```bash
# Install
sudo rpm -i dist-linux/quack_*.rpm

# Or using dnf
sudo dnf install ./dist-linux/quack_*.rpm

# Uninstall
sudo dnf remove quack
```

## Troubleshooting

### WebKitGTK Not Found

```
error: could not find system library 'webkit2gtk-4.1'
```

**Solution:** Install the WebKitGTK development package:

```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel

# Arch
sudo pacman -S webkit2gtk-4.1
```

### AppIndicator/Tray Icon Not Showing

The system tray requires `libayatana-appindicator3`. If the tray icon doesn't appear:

```bash
# Ubuntu/Debian
sudo apt install libayatana-appindicator3-1

# Fedora
sudo dnf install libappindicator-gtk3

# Arch
sudo pacman -S libayatana-appindicator
```

**Note:** Some desktop environments (like vanilla GNOME) don't show tray icons by default. You may need to install an extension like "AppIndicator and KStatusNotifierItem Support".

### Keychain/Secret Storage Issues

Quack uses the system keychain for secure API key storage. If you have issues:

```bash
# Ubuntu/Debian
sudo apt install libsecret-1-0 gnome-keyring

# Fedora
sudo dnf install libsecret gnome-keyring

# Arch
sudo pacman -S libsecret gnome-keyring

# Start the keyring daemon if not running
eval $(gnome-keyring-daemon --start)
export SSH_AUTH_SOCK
```

### Transparent Window Issues

Transparent windows require a compositor. If you see a black background instead of transparency:

- **X11:** Enable a compositor like `picom`, `compton`, or your desktop's built-in compositor
- **Wayland:** Compositor is always enabled, but transparency might behave differently

### AppImage Won't Run

```bash
# Install FUSE
sudo apt install fuse libfuse2

# Make sure it's executable
chmod +x Quack_*.AppImage

# Try extracting and running directly
./Quack_*.AppImage --appimage-extract
./squashfs-root/AppRun
```

### Build Fails with "pkg-config not found"

```bash
# Ubuntu/Debian
sudo apt install pkg-config

# Fedora
sudo dnf install pkg-config

# Arch
sudo pacman -S pkgconf
```

## Window Management Tools (Optional)

For better native terminal integration, install window management tools:

```bash
# Ubuntu/Debian
sudo apt install wmctrl xdotool

# Fedora
sudo dnf install wmctrl xdotool

# Arch
sudo pacman -S wmctrl xdotool
```

These tools enable:
- Focusing terminal windows by name
- Closing terminal windows programmatically
- Better integration with external terminal emulators

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TERMINAL` | Preferred terminal emulator | Auto-detected |
| `DISPLAY` | X11 display (for X11 sessions) | `:0` |
| `WAYLAND_DISPLAY` | Wayland display | Auto-detected |

## Feature Support Matrix

| Feature | Status | Notes |
|---------|--------|-------|
| Core UI | ✅ Full | |
| Terminal emulator | ✅ Full | PTY-based |
| Native terminal integration | ✅ Full | gnome-terminal, konsole, etc. |
| System tray | ✅ Full | Requires libayatana-appindicator |
| Menu bar | ✅ Full | |
| Transparent windows | ⚠️ Partial | Requires compositor |
| Keychain/Secrets | ✅ Full | Via libsecret |
| File explorer | ✅ Full | |
| Git integration | ✅ Full | |
| AI integration | ✅ Full | |
| Window decorations | ✅ Full | Standard GTK decorations |

## Known Limitations

1. **Window title bar style:** Linux uses standard GTK decorations instead of the custom overlay style on macOS.

2. **Dock badge:** The "DEV" badge on the dock icon is macOS-only. On Linux, the app title shows "[DEV MODE]" instead.

3. **Native terminal focus:** Window focus/close operations require `wmctrl` or `xdotool` to be installed.

## Contributing

When contributing Linux-specific changes:

1. Test on at least Ubuntu and one other distribution
2. Use `#[cfg(target_os = "linux")]` for Linux-specific code
3. Document any new system dependencies
4. Update this README if needed

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Run with `RUST_LOG=debug npm run tauri:dev` for detailed logs
3. Open an issue on GitHub with your distribution and error logs
