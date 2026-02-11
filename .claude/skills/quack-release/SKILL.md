---
name: quack-release
description: Publish Quack releases to GitHub with structured release notes, checksums, and multi-platform uploads (macOS + Windows)
activationKeywords:
  - release
  - publish release
  - create release
  - upload dmg
  - github release
invocations:
  - /release
  - /publish-release
---

# Quack Release Skill

Automates publishing Quack releases to GitHub with professional release notes. Supports **macOS** and **Windows** platforms.

## Prerequisites

Before using this skill:

1. **macOS build**: Run `./scripts/release-macos.sh` first to build, sign, and notarize the DMG
2. **Windows build**: Ensure the `.exe` installer exists (built separately on Windows or via CI)
3. **gh CLI**: Available at `/opt/homebrew/bin/gh` and authenticated (`gh auth login`)
4. **Version**: Set in `src-tauri/tauri.conf.json`

## Workflow

### Step 1: Verify Builds

Check that platform artifacts exist:

```bash
# macOS DMG
DMG_PATH="src-tauri/target/universal-apple-darwin/release/bundle/macos/Quack.dmg"
ls -la "$DMG_PATH"

# Windows EXE (check Downloads folder - user brings this from Windows build)
VERSION=$(grep -o '"version": "[^"]*"' src-tauri/tauri.conf.json | head -1 | cut -d'"' -f4)
EXE_PATH="$HOME/Downloads/Quack_${VERSION}_x64-setup.exe"
ls -la "$EXE_PATH"
```

At minimum one platform must be available. Both are expected for standard releases.

### Step 2: Get Version

Read version from tauri.conf.json:

```bash
grep -o '"version": "[^"]*"' src-tauri/tauri.conf.json | head -1 | cut -d'"' -f4
```

### Step 3: Calculate Checksums

```bash
# macOS
shasum -a 256 "$DMG_PATH" | cut -d' ' -f1

# Windows
shasum -a 256 "$EXE_PATH" | cut -d' ' -f1
```

### Step 4: Generate Changelog

Get commits since last tag:

```bash
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -n "$LAST_TAG" ]; then
  git log "$LAST_TAG"..HEAD --oneline --pretty=format:"- %s"
else
  git log --oneline -20 --pretty=format:"- %s"
fi
```

### Step 5: Ask User for Feature Highlights

Before creating the release, ask the user:

> "What are the main features/changes in this release? I'll use them for the release notes."

If the user already provided the highlights in the initial message, skip this step and use what they said.

### Step 6: Create Release Notes

Format the release body:

```markdown
## What's New in Quack {version}

{User-provided feature highlights, formatted as sections with ### headings}

### Changes

{Auto-generated changelog from commits, categorized:}
- **New Features**: commits starting with feat/add/new
- **Bug Fixes**: commits starting with fix/bug/patch
- **Improvements**: commits starting with refactor/improve/update/chore

---

## Downloads

| Platform | File | SHA256 |
|----------|------|--------|
| macOS Universal | Quack.dmg | `{mac_checksum}` |
| Windows x64 | Quack_{version}_x64-setup.exe | `{win_checksum}` |

## Installation

### macOS
1. Download `Quack.dmg`
2. Open and drag **Quack** to Applications
3. First launch: System Settings > Privacy & Security > Open Anyway

### Windows
1. Download `Quack_{version}_x64-setup.exe`
2. Run the installer
3. Launch Quack from Start Menu

---

**Full Changelog**: https://github.com/AlekDob/quack-releases/compare/{previous_tag}...v{version}
```

### Step 7: Preview and Confirm

Show the user the complete release notes and ask for confirmation before publishing.

### Step 8: Publish Release

**IMPORTANT**: Use `/opt/homebrew/bin/gh` as the full path for the gh CLI.

```bash
# Build the upload command with available artifacts
/opt/homebrew/bin/gh release create "v{version}" \
  "$DMG_PATH" \
  "$EXE_PATH" \
  --repo AlekDob/quack-releases \
  --title "Quack {version}" \
  --notes "{release_body}"
```

If only one platform is available, include only that file. The upload may take several minutes for large files (~500 MB total).

### Step 9: Confirm Success

Output the release URL: `https://github.com/AlekDob/quack-releases/releases/tag/v{version}`

## Configuration

| Variable | Value |
|----------|-------|
| Repository | `AlekDob/quack-releases` |
| gh CLI Path | `/opt/homebrew/bin/gh` |
| DMG Path | `src-tauri/target/universal-apple-darwin/release/bundle/macos/Quack.dmg` |
| EXE Path | `~/Downloads/Quack_{version}_x64-setup.exe` |
| Version Source | `src-tauri/tauri.conf.json` |

## Example Usage

```
User: /release - version 0.5.2, Windows support, Plan Mode fix, Quack Store redesign

Agent: I'll help you publish Quack 0.5.2.

1. Checking DMG... Found (314 MB)
2. Checking EXE... Found (172 MB)
3. Version: 0.5.2
4. Checksums calculated

Here's the release preview:

## What's New in Quack 0.5.2
### Windows Support
- Quack is now available on Windows!
...

Create this release? (y/n)

User: y

Agent: Release published! https://github.com/AlekDob/quack-releases/releases/tag/v0.5.2
  - macOS Universal (DMG, 314 MB)
  - Windows x64 (EXE, 172 MB)
```

## Notes

- Always run `./scripts/release-macos.sh` BEFORE this skill for macOS builds
- Windows EXE is built separately and placed in `~/Downloads/`
- The skill publishes to `quack-releases` repo (separate from main code)
- Source code archives are auto-generated by GitHub (cannot be removed)
- macOS DMG is signed and notarized by Apple
- Upload of both artifacts (~500 MB) may take a few minutes
