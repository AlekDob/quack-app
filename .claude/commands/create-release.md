# Create Release Notes Command

Generate release notes for a new Quack version following the established format.

## Description

This command automates the creation of release notes in the `releases/` directory. It prompts for version information and changes, then generates a properly formatted markdown file ready for GitHub releases.

## Usage

```bash
/create-release [version]
```

**Example:**
```bash
/create-release 0.1.4
```

## What this command does

1. **Prompt for version number** (if not provided as argument)
2. **Ask for release title** (e.g., "Git Branch Selection Fix")
3. **Collect list of changes** organized by category:
   - Critical Bug Fixes 🔧
   - New Features 🚀
   - Fixes & Improvements 🔧
   - Build & Infrastructure 🏗️
4. **Generate markdown file** in `releases/v{version}.md`
5. **Follow established format** from previous releases

## Format Template

The command generates release notes following this structure:

```markdown
# v{VERSION}

## 🦆 Quack v{VERSION} - {TITLE}

### ✨ What's New

#### 🔧 Critical Bug Fixes
- ✅ **{Feature name}** - {Description}

#### 🚀 New Features
- ✅ **{Feature name}** - {Description}

### 📦 Downloads

**macOS Universal (Intel + Apple Silicon):**
- Single DMG works on all Mac architectures
- Optimized performance on both Intel and Apple Silicon

### 🔧 Installation

1. Download `Quack_{VERSION}_universal.dmg`
2. Open the downloaded file
3. Drag Quack to your Applications folder
4. Open Quack from Applications
5. On first launch, go to System Settings > Privacy & Security and click "Open Anyway"

---

**Previous version:** [v{PREVIOUS_VERSION}](https://github.com/AlekDob/quack-releases/releases/tag/v{PREVIOUS_VERSION})
```

## Implementation

When the user runs this command:

1. **Parse version argument** or prompt for it
2. **Interactive prompts**:
   ```
   Release title: [e.g., "Git Branch Selection Fix"]

   Add changes (one per line, empty line to finish):
   Category: [Bug Fixes / New Features / Improvements / Infrastructure]
   Feature name: [e.g., "Git branch selection fix"]
   Description: [e.g., "Fixed critical bug where..."]
   ```

3. **Create releases directory** if it doesn't exist:
   ```bash
   mkdir -p releases
   ```

4. **Generate markdown file**:
   ```bash
   # Write to releases/v{VERSION}.md
   ```

5. **Detect previous version** automatically from existing release files

6. **Confirm and show path**:
   ```
   ✅ Release notes created: releases/v{VERSION}.md
   📋 Copy this content to GitHub releases
   ```

## Example Interaction

```
User: /create-release 0.1.4
Agent: Creating release notes for v0.1.4

Release title: Performance Improvements & Bug Fixes

Add changes (one per line, empty line to finish each category)

🔧 Critical Bug Fixes:
1. Terminal freeze on large output - Fixed memory leak causing terminals to freeze
2. [empty line to finish]

🚀 New Features:
1. Search in files - Added full-text search across project files
2. [empty line to finish]

✅ Release notes created: releases/v0.1.4.md
📋 Ready to copy to GitHub!
```

## Notes

- The command automatically creates the `releases/` directory if it doesn't exist
- It detects the previous version from existing release files
- The format follows the style used in https://github.com/AlekDob/quack-releases
- All changes should be written in English
- Use emoji categories consistently (🔧 🚀 🏗️)

## Related Commands

- `/release` - Git Flow release branch creation
- `/diary` - Document daily progress

## Metadata

- **Version**: 1.0.0
- **Author**: Alek Dobrohotov
- **Created**: November 14, 2025
- **Category**: Release Management
- **Output**: Markdown file in `releases/` directory
