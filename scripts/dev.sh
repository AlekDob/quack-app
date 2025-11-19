#!/bin/bash
# Dev script to ensure correct Node and Cargo paths

# Add NVM Node.js to PATH
export PATH="$HOME/.nvm/versions/node/v22.21.0/bin:$PATH"

# Add Rust/Cargo to PATH
export PATH="$HOME/.cargo/bin:$PATH"

# Kill any process using port 5174 to avoid conflicts
echo "🔍 Checking port 5174..."
lsof -ti:5174 | xargs kill -9 2>/dev/null && echo "✅ Freed port 5174" || echo "✅ Port 5174 already free"

# Verify versions
echo "✅ Node.js: $(node --version)"
echo "✅ npm: $(npm --version)"
echo "✅ Cargo: $(cargo --version)"
echo ""
echo "🚀 Starting Tauri dev..."
echo ""

# Run cargo tauri dev directly (not via npm to avoid recursion)
cargo tauri dev
