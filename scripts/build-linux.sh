#!/bin/bash

# Quack Linux Build Script
# Builds .deb package for Debian/Ubuntu

set -e

# Add cargo to PATH
export PATH="$HOME/.cargo/bin:$PATH"

echo "🦆 Building Quack for Linux (.deb)..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
SKIP_FRONTEND=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-frontend)
            SKIP_FRONTEND=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
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

# Build Tauri app (.deb only)
build_tauri() {
    echo -e "${BLUE}Building Tauri application (.deb)...${NC}"

    echo "Running: cargo tauri build --bundles deb"
    cargo tauri build --bundles deb

    echo -e "${GREEN}✓ Tauri build complete${NC}"
}

# Post-build processing
post_build() {
    echo -e "${BLUE}Post-build processing...${NC}"

    local BUNDLE_DIR="src-tauri/target/release/bundle"
    local DIST_DIR="dist-linux"

    # Create distribution directory
    mkdir -p "$DIST_DIR"

    # Copy .deb
    if [ -d "$BUNDLE_DIR/deb" ]; then
        DEB_FILE=$(find "$BUNDLE_DIR/deb" -name "*.deb" | head -1)
        if [ -n "$DEB_FILE" ]; then
            cp "$DEB_FILE" "$DIST_DIR/"
            echo -e "${GREEN}✓ .deb package: $(basename $DEB_FILE)${NC}"
        fi
    fi

    # Create installation README
    cat > "$DIST_DIR/README.md" << 'EOF'
# Quack - Linux Installation

## Install (.deb - Debian/Ubuntu)

```bash
sudo dpkg -i Quack_*.deb

# If there are dependency errors:
sudo apt-get install -f
```

## First Run

After installation, launch Quack from:
- Application menu (search for "Quack")
- Terminal: `quack` or `/opt/quack/quack`

## Troubleshooting

### Missing Libraries

```bash
sudo apt install libwebkit2gtk-4.1-0 libgtk-3-0 libayatana-appindicator3-1
```

### Keychain Issues

For secure API key storage:
```bash
sudo apt install libsecret-1-0 gnome-keyring
```

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
    echo "📦 Distribution files in: $DIST_DIR/"

    if [ -d "$DIST_DIR" ]; then
        ls -lh "$DIST_DIR"/*.deb 2>/dev/null || true
    fi

    echo ""
    echo "Installation: sudo dpkg -i $DIST_DIR/Quack_*.deb"
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
