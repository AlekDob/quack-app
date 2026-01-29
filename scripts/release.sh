#!/bin/bash

# =============================================================================
# Quack Release Script
# Automates the release process: build verification, changelog, upload to GitHub
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
QUACK_APP_DIR="/Users/alekdob/Desktop/Dev/Personal/quack-app"
RELEASES_REPO="AlekDob/quack-releases"
DMG_PATH="$QUACK_APP_DIR/src-tauri/target/universal-apple-darwin/release/bundle/macos/Quack.dmg"
ZIP_PATH="$QUACK_APP_DIR/src-tauri/target/universal-apple-darwin/release/bundle/macos/Quack_universal.zip"

# Get version from tauri.conf.json
get_version() {
    grep -o '"version": "[^"]*"' "$QUACK_APP_DIR/src-tauri/tauri.conf.json" | head -1 | cut -d'"' -f4
}

# Print with color
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Calculate SHA256 checksum
calculate_checksum() {
    shasum -a 256 "$1" | cut -d' ' -f1
}

# Generate changelog from git commits since last tag
generate_changelog() {
    local last_tag=$(git -C "$QUACK_APP_DIR" describe --tags --abbrev=0 2>/dev/null || echo "")

    if [ -z "$last_tag" ]; then
        print_warning "No previous tag found, using last 10 commits"
        git -C "$QUACK_APP_DIR" log --oneline -10 --pretty=format:"- %s"
    else
        print_status "Generating changelog since $last_tag"
        git -C "$QUACK_APP_DIR" log "$last_tag"..HEAD --oneline --pretty=format:"- %s"
    fi
}

# Categorize commits
categorize_commits() {
    local commits="$1"

    local features=$(echo "$commits" | grep -E "^- (feat|add|new)" || true)
    local fixes=$(echo "$commits" | grep -E "^- (fix|bug|patch)" || true)
    local improvements=$(echo "$commits" | grep -E "^- (refactor|improve|update|chore|perf)" || true)
    local other=$(echo "$commits" | grep -vE "^- (feat|add|new|fix|bug|patch|refactor|improve|update|chore|perf)" || true)

    local body=""

    if [ -n "$features" ]; then
        body+="### New Features\n$features\n\n"
    fi

    if [ -n "$fixes" ]; then
        body+="### Bug Fixes\n$fixes\n\n"
    fi

    if [ -n "$improvements" ]; then
        body+="### Improvements\n$improvements\n\n"
    fi

    if [ -n "$other" ]; then
        body+="### Other Changes\n$other\n\n"
    fi

    echo -e "$body"
}

# Main release function
main() {
    local version_override="$1"

    print_status "Starting Quack release process..."

    # 1. Get version
    local version
    if [ -n "$version_override" ]; then
        version="$version_override"
    else
        version=$(get_version)
    fi

    if [ -z "$version" ]; then
        print_error "Could not determine version"
        exit 1
    fi

    local tag="v$version"
    print_status "Version: $version (tag: $tag)"

    # 2. Check if DMG exists
    if [ ! -f "$DMG_PATH" ]; then
        print_error "DMG not found at: $DMG_PATH"
        print_status "Run build first:"
        echo "  npm run tauri build -- --target universal-apple-darwin"
        exit 1
    fi

    print_success "DMG found: $(du -h "$DMG_PATH" | cut -f1)"

    # 3. Calculate checksum
    print_status "Calculating SHA256 checksum..."
    local dmg_checksum=$(calculate_checksum "$DMG_PATH")
    print_success "DMG checksum: $dmg_checksum"

    # 4. Generate changelog
    print_status "Generating changelog..."
    local raw_commits=$(generate_changelog)
    local changelog=$(categorize_commits "$raw_commits")

    # 5. Build release body
    local release_body=$(cat <<EOF
## What's New in Quack $version

$changelog
---

## Downloads

| Platform | File | SHA256 |
|----------|------|--------|
| macOS Universal | Quack.dmg | \`$dmg_checksum\` |

## Installation

1. Download the \`.dmg\` file below
2. Open and drag **Quack** to your Applications folder
3. Launch from Applications
4. **First launch**: System Settings → Privacy & Security → Open Anyway

## Verification

\`\`\`bash
shasum -a 256 Quack.dmg
# Should match: $dmg_checksum
\`\`\`

---

**Full Changelog**: https://github.com/$RELEASES_REPO/compare/v$(git -C "$QUACK_APP_DIR" describe --tags --abbrev=0 2>/dev/null || echo "0.0.0")...$tag
EOF
)

    # 6. Show preview
    echo ""
    echo "=========================================="
    echo "RELEASE PREVIEW"
    echo "=========================================="
    echo "Tag: $tag"
    echo "Title: Quack $version"
    echo ""
    echo "$release_body"
    echo "=========================================="
    echo ""

    # 7. Confirm
    read -p "Create release? (y/N) " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        print_warning "Release cancelled"
        exit 0
    fi

    # 8. Create release
    print_status "Creating release on GitHub..."

    gh release create "$tag" \
        "$DMG_PATH" \
        --repo "$RELEASES_REPO" \
        --title "Quack $version" \
        --notes "$release_body"

    print_success "Release created successfully!"
    echo ""
    echo "Release URL: https://github.com/$RELEASES_REPO/releases/tag/$tag"
}

# Help
show_help() {
    echo "Quack Release Script"
    echo ""
    echo "Usage: ./release.sh [version]"
    echo ""
    echo "If no version is provided, reads from tauri.conf.json"
    echo ""
    echo "Examples:"
    echo "  ./release.sh           # Uses version from tauri.conf.json"
    echo "  ./release.sh 0.2.4     # Forces version 0.2.4"
    echo ""
    echo "Prerequisites:"
    echo "  - gh CLI installed and authenticated"
    echo "  - DMG built: npm run tauri build -- --target universal-apple-darwin"
}

# Entry point
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_help
    exit 0
fi

main "$1"
