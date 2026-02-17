#!/bin/bash

# Quack App - Linux Development Environment Setup Script
# This script installs all required dependencies for building Quack on Linux
# Supports: Ubuntu 22.04+, Debian 12+, Fedora 38+, Arch Linux

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🦆 Quack App - Linux Development Setup${NC}"
echo "=========================================="
echo ""

# Detect the Linux distribution
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
        VERSION=$VERSION_ID
    elif [ -f /etc/lsb-release ]; then
        . /etc/lsb-release
        DISTRO=$DISTRIB_ID
        VERSION=$DISTRIB_RELEASE
    else
        DISTRO=$(uname -s)
        VERSION=$(uname -r)
    fi
    echo -e "${GREEN}Detected: $DISTRO $VERSION${NC}"
}

# Install dependencies for Debian/Ubuntu
install_debian() {
    echo -e "${YELLOW}Installing dependencies for Debian/Ubuntu...${NC}"
    
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
    
    # SSL and crypto
    sudo apt install -y \
        libssl-dev \
        libsecret-1-dev
    
    # Additional libraries for various features
    sudo apt install -y \
        libglib2.0-dev \
        libcairo2-dev \
        libpango1.0-dev \
        libgdk-pixbuf-2.0-dev \
        libsoup-3.0-dev \
        libjavascriptcoregtk-4.1-dev
    
    echo -e "${GREEN}✓ Debian/Ubuntu dependencies installed${NC}"
}

# Install dependencies for Fedora/RHEL
install_fedora() {
    echo -e "${YELLOW}Installing dependencies for Fedora/RHEL...${NC}"
    
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
    
    echo -e "${GREEN}✓ Fedora/RHEL dependencies installed${NC}"
}

# Install dependencies for Arch Linux
install_arch() {
    echo -e "${YELLOW}Installing dependencies for Arch Linux...${NC}"
    
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
    
    echo -e "${GREEN}✓ Arch Linux dependencies installed${NC}"
}

# Install Rust if not present
install_rust() {
    if command -v rustc &> /dev/null; then
        RUST_VERSION=$(rustc --version | cut -d' ' -f2)
        echo -e "${GREEN}✓ Rust already installed: $RUST_VERSION${NC}"
    else
        echo -e "${YELLOW}Installing Rust...${NC}"
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source "$HOME/.cargo/env"
        echo -e "${GREEN}✓ Rust installed${NC}"
    fi
    
    # Ensure minimum Rust version (1.77.2 as specified in Cargo.toml)
    RUST_VERSION=$(rustc --version | cut -d' ' -f2)
    MIN_VERSION="1.77.2"
    
    if [ "$(printf '%s\n' "$MIN_VERSION" "$RUST_VERSION" | sort -V | head -n1)" != "$MIN_VERSION" ]; then
        echo -e "${YELLOW}Updating Rust to minimum required version...${NC}"
        rustup update stable
    fi
}

# Install Node.js if not present
install_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        echo -e "${GREEN}✓ Node.js already installed: $NODE_VERSION${NC}"
    else
        echo -e "${YELLOW}Installing Node.js via nvm...${NC}"
        
        # Install nvm
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        
        # Load nvm
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        
        # Install latest LTS
        nvm install --lts
        nvm use --lts
        
        echo -e "${GREEN}✓ Node.js installed${NC}"
    fi
}

# Install Tauri CLI
install_tauri_cli() {
    if command -v cargo-tauri &> /dev/null || cargo tauri --version &> /dev/null 2>&1; then
        echo -e "${GREEN}✓ Tauri CLI already installed${NC}"
    else
        echo -e "${YELLOW}Installing Tauri CLI...${NC}"
        cargo install tauri-cli
        echo -e "${GREEN}✓ Tauri CLI installed${NC}"
    fi
}

# Verify installation
verify_installation() {
    echo ""
    echo -e "${BLUE}Verifying installation...${NC}"
    echo "------------------------"
    
    local all_ok=true
    
    # Check Rust
    if command -v rustc &> /dev/null; then
        echo -e "${GREEN}✓ Rust: $(rustc --version)${NC}"
    else
        echo -e "${RED}✗ Rust not found${NC}"
        all_ok=false
    fi
    
    # Check Cargo
    if command -v cargo &> /dev/null; then
        echo -e "${GREEN}✓ Cargo: $(cargo --version)${NC}"
    else
        echo -e "${RED}✗ Cargo not found${NC}"
        all_ok=false
    fi
    
    # Check Node.js
    if command -v node &> /dev/null; then
        echo -e "${GREEN}✓ Node.js: $(node --version)${NC}"
    else
        echo -e "${RED}✗ Node.js not found${NC}"
        all_ok=false
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        echo -e "${GREEN}✓ npm: $(npm --version)${NC}"
    else
        echo -e "${RED}✗ npm not found${NC}"
        all_ok=false
    fi
    
    # Check pkg-config
    if command -v pkg-config &> /dev/null; then
        echo -e "${GREEN}✓ pkg-config: $(pkg-config --version)${NC}"
    else
        echo -e "${RED}✗ pkg-config not found${NC}"
        all_ok=false
    fi
    
    # Check WebKitGTK
    if pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
        echo -e "${GREEN}✓ WebKitGTK 4.1: $(pkg-config --modversion webkit2gtk-4.1)${NC}"
    else
        echo -e "${RED}✗ WebKitGTK 4.1 not found${NC}"
        all_ok=false
    fi
    
    # Check GTK3
    if pkg-config --exists gtk+-3.0 2>/dev/null; then
        echo -e "${GREEN}✓ GTK3: $(pkg-config --modversion gtk+-3.0)${NC}"
    else
        echo -e "${RED}✗ GTK3 not found${NC}"
        all_ok=false
    fi
    
    # Check libsecret
    if pkg-config --exists libsecret-1 2>/dev/null; then
        echo -e "${GREEN}✓ libsecret: $(pkg-config --modversion libsecret-1)${NC}"
    else
        echo -e "${YELLOW}⚠ libsecret not found (needed for keychain)${NC}"
    fi
    
    echo ""
    
    if $all_ok; then
        echo -e "${GREEN}=========================================${NC}"
        echo -e "${GREEN}✓ All dependencies installed successfully!${NC}"
        echo -e "${GREEN}=========================================${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. cd /path/to/quack-app"
        echo "  2. npm install"
        echo "  3. npm run dev:linux    # For development"
        echo "  4. npm run build:linux  # For production build"
    else
        echo -e "${RED}=========================================${NC}"
        echo -e "${RED}✗ Some dependencies are missing${NC}"
        echo -e "${RED}=========================================${NC}"
        echo "Please check the errors above and install missing dependencies."
        exit 1
    fi
}

# Main execution
main() {
    detect_distro
    echo ""
    
    case $DISTRO in
        ubuntu|debian|linuxmint|pop|elementary|zorin)
            install_debian
            ;;
        fedora|rhel|centos|rocky|alma)
            install_fedora
            ;;
        arch|manjaro|endeavouros)
            install_arch
            ;;
        *)
            echo -e "${RED}Unsupported distribution: $DISTRO${NC}"
            echo "Please install dependencies manually. See README-LINUX.md for details."
            exit 1
            ;;
    esac
    
    echo ""
    install_rust
    echo ""
    install_nodejs
    echo ""
    install_tauri_cli
    
    verify_installation
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
