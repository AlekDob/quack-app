# Bump Version Command

Automatically update version numbers across all project files.

## Description

This command updates the version number in all relevant project files (package.json, Cargo.toml, tauri.conf.json) to maintain consistency across the codebase.

## Usage

```bash
/bump-version <new-version>
```

**Examples:**
```bash
/bump-version 0.1.4
/bump-version 0.2.0
/bump-version 1.0.0
```

## What this command does

1. **Validates version format** (must be semver: X.Y.Z)
2. **Shows current version** in all files
3. **Updates version** in:
   - `package.json` → `version` field
   - `src-tauri/Cargo.toml` → `[package]` version
   - `src-tauri/tauri.conf.json` → `version` field
4. **Confirms changes** and shows diff
5. **Optional: Create git commit** with version bump

## Files Updated

### 1. package.json
```json
{
  "name": "quack-app",
  "version": "0.1.4"  ← Updated here
}
```

### 2. src-tauri/Cargo.toml
```toml
[package]
name = "app"
version = "0.1.4"  ← Updated here
```

### 3. src-tauri/tauri.conf.json
```json
{
  "productName": "Quack",
  "version": "0.1.4"  ← Updated here
}
```

## Version Format

Must follow **Semantic Versioning** (semver):
- Format: `MAJOR.MINOR.PATCH`
- Example: `0.1.4`, `1.0.0`, `2.3.15`

**Invalid formats:**
- ❌ `v0.1.4` (no 'v' prefix)
- ❌ `0.1` (missing patch)
- ❌ `1.2.3.4` (too many numbers)

## Implementation

When the user runs this command:

1. **Parse and validate version**:
   ```javascript
   const versionRegex = /^\d+\.\d+\.\d+$/
   if (!versionRegex.test(newVersion)) {
     error("Invalid version format. Use X.Y.Z (e.g., 0.1.4)")
   }
   ```

2. **Read current versions**:
   ```bash
   package.json:        0.1.3
   Cargo.toml:          0.1.3
   tauri.conf.json:     0.1.3
   ```

3. **Update all files**:
   - Use Edit tool for each file
   - Replace old version with new version
   - Preserve file structure

4. **Show changes**:
   ```
   ✅ Version updated: 0.1.3 → 0.1.4

   Files updated:
   - package.json
   - src-tauri/Cargo.toml
   - src-tauri/tauri.conf.json
   ```

5. **Prompt for git commit** (optional):
   ```
   Create git commit? [y/N]

   If yes:
   git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
   git commit -m "chore: bump version to 0.1.4"
   ```

## Example Interaction

```
User: /bump-version 0.1.4

Agent: 📋 Current version: 0.1.3
       🎯 New version: 0.1.4

       Updating files...

       ✅ package.json: 0.1.3 → 0.1.4
       ✅ Cargo.toml: 0.1.3 → 0.1.4
       ✅ tauri.conf.json: 0.1.3 → 0.1.4

       🎉 Version bumped successfully!

       Create git commit? [y/N]

User: y

Agent: 📝 Creating commit...
       ✅ Commit created: "chore: bump version to 0.1.4"
```

## Advanced Usage

### Bump with commit (one command)
```bash
/bump-version 0.1.4 --commit
```

### Bump with custom commit message
```bash
/bump-version 0.1.4 --commit "Release v0.1.4"
```

### Dry run (preview changes)
```bash
/bump-version 0.1.4 --dry-run
```

### Bump and create release notes
```bash
/bump-version 0.1.4 && /create-release 0.1.4
```

## Version Increment Helpers

### Auto-increment patch (0.1.3 → 0.1.4)
```bash
/bump-version patch
```

### Auto-increment minor (0.1.3 → 0.2.0)
```bash
/bump-version minor
```

### Auto-increment major (0.1.3 → 1.0.0)
```bash
/bump-version major
```

## Integration with Release Workflow

Typical release workflow:

```bash
# 1. Bump version
/bump-version 0.1.4

# 2. Create release notes
/create-release 0.1.4

# 3. Build app
npm run tauri:build:universal

# 4. Create GitHub release
# (Upload DMG and release notes)

# 5. Push changes
git push origin main
```

## Safety Features

- **Version validation**: Ensures semver format
- **Consistency check**: Verifies all files have same version
- **Backup**: Shows diff before confirming
- **Rollback**: Can undo with git if committed

## Error Handling

```
❌ Invalid version format
   Use semver format: X.Y.Z (e.g., 0.1.4)

❌ Version already exists
   Current version is already 0.1.4

❌ File not found
   Could not find: src-tauri/Cargo.toml

❌ Version mismatch detected
   Files have different versions:
   - package.json: 0.1.3
   - Cargo.toml: 0.1.2 ← Inconsistent!
   Fix manually or use --force flag
```

## Related Commands

- `/create-release` - Create release notes after version bump
- `/update-release` - Update existing release notes
- `/release` - Git Flow release branch creation

## Metadata

- **Version**: 1.0.0
- **Author**: Alek Dobrohotov
- **Created**: November 14, 2025
- **Category**: Version Management
- **Updates**: package.json, Cargo.toml, tauri.conf.json
