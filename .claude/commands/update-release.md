# Update Release Notes Command

Update existing release notes by adding, removing, or modifying changes.

## Description

This command allows you to update an existing release notes file in the `releases/` directory. Useful when you need to add forgotten changes, fix typos, or reorganize content.

## Usage

```bash
/update-release [version]
```

**Example:**
```bash
/update-release 0.1.3
```

## What this command does

1. **Load existing release file** from `releases/v{version}.md`
2. **Show current content** organized by category
3. **Prompt for action**:
   - Add new change
   - Remove existing change
   - Modify existing change
   - Change release title
   - Done (save and exit)
4. **Save updated file** preserving the format

## Interactive Menu

When you run the command, you'll see:

```
📝 Updating release notes for v0.1.3

Current title: Git Branch Selection Fix

Current changes:

🔧 Critical Bug Fixes:
1. Git branch selection fix - Fixed critical bug where...
2. Branch detection improvements - Agent creation now properly...
3. Better error handling - Added fallback logic to skip...

What do you want to do?
[1] Add new change
[2] Remove change
[3] Modify change
[4] Change title
[5] Done (save)

Choice: _
```

## Actions

### Add New Change

```
Category: [Bug Fixes / New Features / Improvements / Infrastructure]
Feature name: Terminal performance
Description: Optimized terminal rendering for large outputs
```

### Remove Change

```
Select category: [1] Bug Fixes [2] New Features [3] ...
Select change number to remove: 2
✅ Removed: Branch detection improvements
```

### Modify Change

```
Select category: [1] Bug Fixes [2] New Features [3] ...
Select change number to modify: 1
New feature name (or press enter to keep): [Git branch fix]
New description (or press enter to keep): [Updated description...]
✅ Updated change
```

### Change Title

```
Current title: Git Branch Selection Fix
New title: Git Branch Selection & Error Handling Fix
✅ Title updated
```

## Implementation

When the user runs this command:

1. **Check if file exists**:
   ```bash
   if [ ! -f "releases/v{VERSION}.md" ]; then
     echo "❌ Release file not found. Use /create-release instead."
     exit 1
   fi
   ```

2. **Parse existing file**:
   - Extract title from line: `## 🦆 Quack v{VERSION} - {TITLE}`
   - Extract changes organized by category
   - Preserve Downloads and Installation sections

3. **Interactive loop**:
   - Show current state
   - Prompt for action
   - Apply changes
   - Repeat until "Done"

4. **Save updated file**:
   - Maintain exact format
   - Keep emoji categories
   - Preserve Downloads/Installation sections
   - Keep previous version link

5. **Confirm**:
   ```
   ✅ Release notes updated: releases/v{VERSION}.md
   📋 Changes saved successfully!
   ```

## Format Preservation

The command maintains:
- ✅ Header structure (`# v{VERSION}`)
- ✅ Title format (`## 🦆 Quack v{VERSION} - {TITLE}`)
- ✅ Category sections with emojis (🔧 🚀 🏗️)
- ✅ Checkbox format (`- ✅ **{Name}** - {Description}`)
- ✅ Downloads section
- ✅ Installation instructions
- ✅ Previous version link

## Example Interaction

```
User: /update-release 0.1.3

Agent: 📝 Updating release notes for v0.1.3

Current title: Git Branch Selection Fix

🔧 Critical Bug Fixes:
1. Git branch selection fix
2. Branch detection improvements
3. Better error handling

What do you want to do?
[1] Add [2] Remove [3] Modify [4] Change title [5] Done

User: 1

Agent: Category?
[1] Critical Bug Fixes
[2] New Features
[3] Fixes & Improvements
[4] Build & Infrastructure

User: 1

Agent: Feature name: Copy button for markdown
Description: Added copy button to easily copy code blocks

✅ Added to Critical Bug Fixes

What do you want to do?
[1] Add [2] Remove [3] Modify [4] Change title [5] Done

User: 5

Agent: ✅ Release notes updated: releases/v0.1.3.md
```

## Safety Features

- **Backup before save**: Creates `.bak` file before overwriting
- **Validation**: Ensures format is preserved
- **Undo support**: Can restore from `.bak` if needed
- **Dry run mode**: `--dry-run` flag to preview changes

## Advanced Usage

```bash
# Update with dry run (preview changes)
/update-release 0.1.3 --dry-run

# Quick add (skip interactive menu)
/update-release 0.1.3 --add "Bug Fixes" "Feature name" "Description"

# Remove specific change
/update-release 0.1.3 --remove "Bug Fixes" 2
```

## Related Commands

- `/create-release` - Create new release notes
- `/release` - Git Flow release branch creation
- `/diary` - Document daily progress

## Metadata

- **Version**: 1.0.0
- **Author**: Alek Dobrohotov
- **Created**: November 14, 2025
- **Category**: Release Management
- **Modifies**: Existing markdown files in `releases/` directory
