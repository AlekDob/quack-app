#!/bin/bash

# Quack Linux Development Script
# This script starts the Tauri development server on Linux

set -e

# Add cargo to PATH
export PATH="$HOME/.cargo/bin:$PATH"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🦆 Starting Quack in development mode (Linux)...${NC}"

# Check for required dependencies
check_deps() {
    local missing=false
    
    if ! pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
        echo -e "${YELLOW}⚠️  WebKitGTK 4.1 not found. Run: ./scripts/setup-linux.sh${NC}"
        missing=true
    fi
    
    if ! pkg-config --exists gtk+-3.0 2>/dev/null; then
        echo -e "${YELLOW}⚠️  GTK3 not found. Run: ./scripts/setup-linux.sh${NC}"
        missing=true
    fi
    
    if $missing; then
        echo ""
        echo "Some dependencies are missing. Please run:"
        echo "  ./scripts/setup-linux.sh"
        exit 1
    fi
}

# Only check deps if not skipped
if [ "$1" != "--skip-check" ]; then
    check_deps
fi

# Start Tauri dev
echo -e "${GREEN}Starting Tauri development server...${NC}"
cargo tauri dev
