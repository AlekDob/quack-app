#!/bin/bash

# =============================================================================
# Quack - Linux Release Script
# =============================================================================
# Automates the release process for Linux (.deb):
# 1. Build the frontend
# 2. Optimize node-sdk
# 3. Build Tauri .deb package
# 4. Generate SHA256 checksums
# 5. Create distribution directory
#
# Usage: ./scripts/release-linux.sh [OPTIONS]
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

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "=================================================================="
echo "           Quack Linux Release Script (.deb)"
echo "=================================================================="
echo -e "${NC}"

cd "$PROJECT_ROOT"

# Parse command line arguments
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
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
    echo -e "${YELLOW}[4/6] Building Tauri .deb package...${NC}"

    # Skip beforeBuildCommand since we already built the frontend and optimized the bundle
    cargo tauri build --bundles deb --config '{"build":{"beforeBuildCommand":""}}'

    echo -e "${GREEN}Tauri build complete${NC}"
    echo ""
}

# ==== Create Distribution ====
create_distribution() {
    echo -e "${YELLOW}[5/6] Creating distribution...${NC}"

    # Create/clean distribution directory
    rm -rf "$DIST_DIR"
    mkdir -p "$DIST_DIR"

    # Copy .deb
    if [ -d "$BUNDLE_DIR/deb" ]; then
        DEB_FILE=$(find "$BUNDLE_DIR/deb" -name "*.deb" | head -1)
        if [ -n "$DEB_FILE" ] && [ -f "$DEB_FILE" ]; then
            cp "$DEB_FILE" "$DIST_DIR/"
            echo -e "${GREEN}  + .deb: $(basename $DEB_FILE)${NC}"
        fi
    fi

    echo ""
}

# ==== Generate Checksums ====
generate_checksums() {
    echo -e "${YELLOW}[6/6] Generating SHA256 checksums...${NC}"

    cd "$DIST_DIR"

    CHECKSUM_FILE="SHA256SUMS.txt"
    rm -f "$CHECKSUM_FILE"

    for file in *.deb; do
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
# Quack - Linux Installation

## Install (.deb - Debian/Ubuntu)

```bash
sudo dpkg -i Quack_*.deb

# If there are dependency errors:
sudo apt-get install -f
```

## Verifying Downloads

```bash
sha256sum -c SHA256SUMS.txt
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
    echo "Distribution files in: $DIST_DIR/"
    echo ""

    if [ -d "$DIST_DIR" ]; then
        echo "Files:"
        ls -lh "$DIST_DIR"/*.deb 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
        echo ""
    fi

    echo "Installation: sudo dpkg -i $DIST_DIR/Quack_*.deb"
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
