#!/bin/bash

# =============================================================================
# Quack - Complete Linux Release Script
# =============================================================================
# This script automates the entire release process for Linux:
# 1. Build the frontend
# 2. Optimize node-sdk (remove unused platform binaries)
# 3. Build Tauri packages (deb, AppImage)
# 4. Generate SHA256 checksums
# 5. Create distribution directory with all artifacts
#
# Usage: ./scripts/release-linux.sh [OPTIONS]
#   --deb         Build only .deb package
#   --appimage    Build only AppImage
#   --rpm         Build only .rpm package
#   --skip-build  Skip frontend build (use existing dist/)
# =============================================================================

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_ROOT/dist-linux"
BUNDLE_DIR="$PROJECT_ROOT/src-tauri/target/release/bundle"

# Add cargo to PATH
export PATH="$HOME/.cargo/bin:$PATH"

# Load environment variables from .env if exists
if [ -f "$PROJECT_ROOT/.env" ]; then
    echo "Loading environment variables from .env..."
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
fi

# Increase Node.js memory limit for large builds
export NODE_OPTIONS="--max-old-space-size=8192"

# Allow AppImage tools (linuxdeploy) to run without FUSE (needed in VMs)
export APPIMAGE_EXTRACT_AND_RUN=1

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "=================================================================="
echo "           Quack Linux Release Script"
echo "=================================================================="
echo -e "${NC}"

cd "$PROJECT_ROOT"

# Parse command line arguments
BUILD_TARGET="all"
SKIP_BUILD=false

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
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --deb           Build only .deb package (Debian/Ubuntu)"
            echo "  --rpm           Build only .rpm package (Fedora/RHEL)"
            echo "  --appimage      Build only AppImage (Universal)"
            echo "  --skip-build    Skip frontend build (use existing dist/)"
            echo "  --help, -h      Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# ==== Check Requirements ====
check_requirements() {
    echo -e "${YELLOW}[1/6] Checking requirements...${NC}"

    local missing=false

    if ! command -v cargo &> /dev/null; then
        echo -e "${RED}  x Cargo not found. Please install Rust.${NC}"
        missing=true
    else
        echo -e "${GREEN}  + Cargo: $(cargo --version | cut -d' ' -f2)${NC}"
    fi

    if ! command -v node &> /dev/null; then
        echo -e "${RED}  x Node.js not found.${NC}"
        missing=true
    else
        echo -e "${GREEN}  + Node.js: $(node --version)${NC}"
    fi

    if ! pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
        echo -e "${RED}  x WebKitGTK 4.1 not found. Run: ./scripts/setup-linux.sh${NC}"
        missing=true
    else
        echo -e "${GREEN}  + WebKitGTK: $(pkg-config --modversion webkit2gtk-4.1)${NC}"
    fi

    if $missing; then
        echo -e "${RED}Missing requirements. Please install them first.${NC}"
        exit 1
    fi

    echo -e "${GREEN}All requirements met${NC}"
    echo ""
}

# ==== Build Frontend ====
build_frontend() {
    if $SKIP_BUILD; then
        echo -e "${YELLOW}[2/6] Skipping frontend build (--skip-build)${NC}"
        echo ""
        return
    fi

    echo -e "${YELLOW}[2/6] Building frontend...${NC}"

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo "  Installing npm dependencies..."
        npm install
    fi

    # Build the frontend
    npm run build:secure

    echo -e "${GREEN}Frontend build complete${NC}"
    echo ""
}

# ==== Optimize Bundle ====
optimize_bundle() {
    echo -e "${YELLOW}[3/6] Optimizing node-sdk for Linux...${NC}"

    if [ -f "$SCRIPT_DIR/optimize-bundle-linux.sh" ]; then
        "$SCRIPT_DIR/optimize-bundle-linux.sh"
    else
        echo -e "${YELLOW}  optimize-bundle-linux.sh not found, skipping${NC}"
    fi

    echo ""
}

# ==== Build Tauri ====
build_tauri() {
    echo -e "${YELLOW}[4/6] Building Tauri packages...${NC}"

    local tauri_args=""

    case $BUILD_TARGET in
        deb)
            tauri_args="--bundles deb"
            echo "  Building .deb package..."
            ;;
        rpm)
            tauri_args="--bundles rpm"
            echo "  Building .rpm package..."
            ;;
        appimage)
            tauri_args="--bundles appimage"
            echo "  Building AppImage..."
            ;;
        all)
            tauri_args="--bundles deb,appimage"
            echo "  Building all packages (deb, AppImage)..."
            ;;
    esac

    # Skip beforeBuildCommand since we already built the frontend and optimized the bundle
    cargo tauri build $tauri_args --config '{"build":{"beforeBuildCommand":""}}'

    echo -e "${GREEN}Tauri build complete${NC}"
    echo ""
}

# ==== Create Distribution ====
create_distribution() {
    echo -e "${YELLOW}[5/6] Creating distribution...${NC}"

    # Create/clean distribution directory
    rm -rf "$DIST_DIR"
    mkdir -p "$DIST_DIR"

    # Copy .deb if exists
    if [ -d "$BUNDLE_DIR/deb" ]; then
        DEB_FILE=$(find "$BUNDLE_DIR/deb" -name "*.deb" | head -1)
        if [ -n "$DEB_FILE" ] && [ -f "$DEB_FILE" ]; then
            cp "$DEB_FILE" "$DIST_DIR/"
            echo -e "${GREEN}  + .deb: $(basename $DEB_FILE)${NC}"
        fi
    fi

    # Copy AppImage if exists
    if [ -d "$BUNDLE_DIR/appimage" ]; then
        APPIMAGE_FILE=$(find "$BUNDLE_DIR/appimage" -name "*.AppImage" | head -1)
        if [ -n "$APPIMAGE_FILE" ] && [ -f "$APPIMAGE_FILE" ]; then
            cp "$APPIMAGE_FILE" "$DIST_DIR/"
            chmod +x "$DIST_DIR/$(basename $APPIMAGE_FILE)"
            echo -e "${GREEN}  + AppImage: $(basename $APPIMAGE_FILE)${NC}"
        fi
    fi

    # Copy .rpm if exists
    if [ -d "$BUNDLE_DIR/rpm" ]; then
        RPM_FILE=$(find "$BUNDLE_DIR/rpm" -name "*.rpm" | head -1)
        if [ -n "$RPM_FILE" ] && [ -f "$RPM_FILE" ]; then
            cp "$RPM_FILE" "$DIST_DIR/"
            echo -e "${GREEN}  + .rpm: $(basename $RPM_FILE)${NC}"
        fi
    fi

    echo ""
}

# ==== Generate Checksums ====
generate_checksums() {
    echo -e "${YELLOW}[6/6] Generating SHA256 checksums...${NC}"

    cd "$DIST_DIR"

    # Generate checksum for each file
    CHECKSUM_FILE="SHA256SUMS.txt"
    rm -f "$CHECKSUM_FILE"

    for file in *.deb *.AppImage *.rpm; do
        if [ -f "$file" ] 2>/dev/null; then
            sha256sum "$file" >> "$CHECKSUM_FILE"
            echo -e "${GREEN}  + $(sha256sum "$file" | cut -c1-16)... $file${NC}"
        fi
    done

    if [ -f "$CHECKSUM_FILE" ]; then
        echo ""
        echo -e "${GREEN}Checksums saved to: $CHECKSUM_FILE${NC}"
    fi

    cd "$PROJECT_ROOT"
    echo ""
}

# ==== Create README ====
create_readme() {
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

## Verifying Downloads

Verify the integrity of downloaded files using SHA256 checksums:

```bash
sha256sum -c SHA256SUMS.txt
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

Enjoy using Quack!
EOF

    echo "README.md created"
}

# ==== Print Summary ====
print_summary() {
    echo -e "${GREEN}"
    echo "=================================================================="
    echo "                    Release Complete!"
    echo "=================================================================="
    echo -e "${NC}"
    echo ""
    echo "Distribution files created in: $DIST_DIR/"
    echo ""

    if [ -d "$DIST_DIR" ]; then
        echo "Files:"
        ls -lh "$DIST_DIR"/*.deb "$DIST_DIR"/*.AppImage "$DIST_DIR"/*.rpm 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
        echo ""
    fi

    echo "Installation commands:"
    echo "  Debian/Ubuntu: sudo dpkg -i $DIST_DIR/quack_*.deb"
    echo "  AppImage:      chmod +x $DIST_DIR/Quack_*.AppImage && ./Quack_*.AppImage"
    echo "  Fedora/RHEL:   sudo rpm -i $DIST_DIR/quack_*.rpm"
    echo ""
    echo "Verify checksums:"
    echo "  cd $DIST_DIR && sha256sum -c SHA256SUMS.txt"
    echo ""
}

# ==== Main Execution ====
main() {
    check_requirements
    build_frontend
    optimize_bundle
    build_tauri
    create_distribution
    generate_checksums
    create_readme
    print_summary
}

main "$@"
