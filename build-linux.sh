#!/bin/bash

# Quack Linux Build Script
# This script handles the build and distribution of Quack for Linux
# Supports: .deb (Debian/Ubuntu), .rpm (Fedora/RHEL), AppImage (Universal)

set -e

# Add cargo to PATH
export PATH="$HOME/.cargo/bin:$PATH"

echo "🦆 Building Quack for Linux..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
BUILD_TARGET="all"  # all, deb, rpm, appimage
SKIP_FRONTEND=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --deb)
            BUILD_TARGET="deb"
            shift
            ;;
        --rpm)
            BUILD_TARGET="rpm"
            shift
            ;;
        --appimage)
            BUILD_TARGET="appimage"
            shift
            ;;
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --deb           Build only .deb package (Debian/Ubuntu)"
            echo "  --rpm           Build only .rpm package (Fedora/RHEL)"
            echo "  --appimage      Build only AppImage (Universal)"
            echo "  --skip-frontend Skip frontend build (use existing dist/)"
            echo "  --help, -h      Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Check for required tools
check_requirements() {
    echo -e "${BLUE}Checking requirements...${NC}"
    
    local missing=false
    
    if ! command -v cargo &> /dev/null; then
        echo -e "${RED}✗ Cargo not found. Please install Rust.${NC}"
        missing=true
    fi
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}✗ Node.js not found. Please install Node.js.${NC}"
        missing=true
    fi
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}✗ npm not found. Please install npm.${NC}"
        missing=true
    fi
    
    if ! pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
        echo -e "${RED}✗ WebKitGTK 4.1 not found. Run: ./scripts/setup-linux.sh${NC}"
        missing=true
    fi
    
    if $missing; then
        echo -e "${RED}Missing requirements. Please install them first.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ All requirements met${NC}"
}

# Clean previous builds
clean_builds() {
    echo -e "${YELLOW}Cleaning previous builds...${NC}"
    rm -rf src-tauri/target/release/bundle
    echo -e "${GREEN}✓ Cleaned${NC}"
}

# Build frontend
build_frontend() {
    if $SKIP_FRONTEND; then
        echo -e "${YELLOW}Skipping frontend build (using existing dist/)${NC}"
        return
    fi
    
    echo -e "${BLUE}Building frontend...${NC}"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "Installing npm dependencies..."
        npm install
    fi
    
    # Build the frontend
    npm run build:secure
    
    echo -e "${GREEN}✓ Frontend built${NC}"
}

# Build Tauri app
build_tauri() {
    echo -e "${BLUE}Building Tauri application...${NC}"
    
    local tauri_args=""
    
    case $BUILD_TARGET in
        deb)
            tauri_args="--bundles deb"
            ;;
        rpm)
            tauri_args="--bundles rpm"
            ;;
        appimage)
            tauri_args="--bundles appimage"
            ;;
        all)
            tauri_args="--bundles deb,appimage"
            # Note: rpm requires additional setup, we'll try it but it might fail
            ;;
    esac
    
    echo "Running: cargo tauri build $tauri_args"
    cargo tauri build $tauri_args
    
    echo -e "${GREEN}✓ Tauri build complete${NC}"
}

# Post-build processing
post_build() {
    echo -e "${BLUE}Post-build processing...${NC}"
    
    local BUNDLE_DIR="src-tauri/target/release/bundle"
    local DIST_DIR="dist-linux"
    
    # Create distribution directory
    mkdir -p "$DIST_DIR"
    
    # Copy .deb if exists
    if [ -d "$BUNDLE_DIR/deb" ]; then
        DEB_FILE=$(find "$BUNDLE_DIR/deb" -name "*.deb" | head -1)
        if [ -n "$DEB_FILE" ]; then
            cp "$DEB_FILE" "$DIST_DIR/"
            echo -e "${GREEN}✓ .deb package: $(basename $DEB_FILE)${NC}"
        fi
    fi
    
    # Copy AppImage if exists
    if [ -d "$BUNDLE_DIR/appimage" ]; then
        APPIMAGE_FILE=$(find "$BUNDLE_DIR/appimage" -name "*.AppImage" | head -1)
        if [ -n "$APPIMAGE_FILE" ]; then
            cp "$APPIMAGE_FILE" "$DIST_DIR/"
            chmod +x "$DIST_DIR/$(basename $APPIMAGE_FILE)"
            echo -e "${GREEN}✓ AppImage: $(basename $APPIMAGE_FILE)${NC}"
        fi
    fi
    
    # Copy .rpm if exists
    if [ -d "$BUNDLE_DIR/rpm" ]; then
        RPM_FILE=$(find "$BUNDLE_DIR/rpm" -name "*.rpm" | head -1)
        if [ -n "$RPM_FILE" ]; then
            cp "$RPM_FILE" "$DIST_DIR/"
            echo -e "${GREEN}✓ .rpm package: $(basename $RPM_FILE)${NC}"
        fi
    fi
    
    # Create installation README
    cat > "$DIST_DIR/README.md" << 'EOF'
# Quack Installation Instructions for Linux

## Installation Methods

### Option 1: .deb Package (Debian/Ubuntu)

```bash
sudo dpkg -i quack_*.deb

# If there are dependency errors, run:
sudo apt-get install -f
```

### Option 2: AppImage (Universal)

```bash
# Make executable
chmod +x Quack_*.AppImage

# Run directly
./Quack_*.AppImage

# Or install with AppImageLauncher for better integration
```

### Option 3: .rpm Package (Fedora/RHEL)

```bash
sudo rpm -i quack_*.rpm

# Or using dnf:
sudo dnf install ./quack_*.rpm
```

## First Run

After installation, you can launch Quack from:
- Application menu (search for "Quack")
- Terminal: `quack` or `/opt/quack/quack`

## Troubleshooting

### Missing Libraries

If you get library errors, install dependencies:

**Ubuntu/Debian:**
```bash
sudo apt install libwebkit2gtk-4.1-0 libgtk-3-0 libayatana-appindicator3-1
```

**Fedora:**
```bash
sudo dnf install webkit2gtk4.1 gtk3 libappindicator-gtk3
```

### AppImage Won't Run

1. Make sure it's executable: `chmod +x Quack_*.AppImage`
2. Install FUSE if needed: `sudo apt install fuse libfuse2`

### Keychain Issues

For secure API key storage, install libsecret:
```bash
# Ubuntu/Debian
sudo apt install libsecret-1-0 gnome-keyring

# Fedora
sudo dnf install libsecret gnome-keyring
```

## Features

- Multi-terminal emulator with AI integration
- Claude Agent SDK powered assistant
- Git integration
- File explorer
- And much more!

Enjoy using Quack! 🦆
EOF

    echo -e "${GREEN}✓ Installation README created${NC}"
}

# Print summary
print_summary() {
    local DIST_DIR="dist-linux"
    
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo -e "${GREEN}✓ Build Complete!${NC}"
    echo "════════════════════════════════════════════════════════════"
    echo ""
    echo "📦 Distribution files created in: $DIST_DIR/"
    
    if [ -d "$DIST_DIR" ]; then
        ls -lh "$DIST_DIR"/*.deb "$DIST_DIR"/*.AppImage "$DIST_DIR"/*.rpm 2>/dev/null || true
    fi
    
    echo ""
    echo "Installation:"
    echo "  Debian/Ubuntu: sudo dpkg -i $DIST_DIR/quack_*.deb"
    echo "  AppImage:      chmod +x $DIST_DIR/Quack_*.AppImage && ./Quack_*.AppImage"
    echo "  Fedora/RHEL:   sudo rpm -i $DIST_DIR/quack_*.rpm"
    echo ""
}

# Main execution
main() {
    check_requirements
    echo ""
    clean_builds
    echo ""
    build_frontend
    echo ""
    build_tauri
    echo ""
    post_build
    print_summary
}

main "$@"
