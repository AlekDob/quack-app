# Slash Command Alphabetical Sorting and Deduplication Fix

**Date**: 2025-01-03
**Status**: Fixed
**Severity**: Low (UX issue)

## Problems

### Problem 1: Incorrect Sorting Order
When typing `/` in the chat input, the `/background` command always appeared as the first highlighted option in quack-app, but not in other projects.

### Problem 2: Duplicate Commands
Commands were appearing duplicated in the autocomplete dropdown when the same command existed in both global (`~/.claude/commands/`) and project (`.claude/commands/`) directories.

## Root Causes

### Cause 1: Scope-based Priority Sorting
The backend sorting logic gave priority to global commands over project commands:

```rust
// OLD: Scope-based priority sorting
custom.sort_by(|a, b| {
    match (a.scope.as_str(), b.scope.as_str()) {
        ("global", "project") => std::cmp::Ordering::Less,    // global first
        ("project", "global") => std::cmp::Ordering::Greater, // project after
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    }
});
```

### Cause 2: No Deduplication
Commands with the same name from both global and project directories were being added to the list without checking for duplicates.

## Solution

### Fix 1: Alphabetical Sorting
Changed sorting to be purely alphabetical, ignoring scope:

```rust
// NEW: Alphabetical sorting only
custom.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
```

### Fix 2: Deduplication with Project Precedence
Added deduplication logic where project commands override global commands with the same name:

```rust
// Deduplicate: project commands override global commands with the same name
for project_cmd in project_commands {
    // Remove any existing global command with the same name
    custom.retain(|cmd| cmd.name.to_lowercase() != project_cmd.name.to_lowercase());
    // Add the project command
    custom.push(project_cmd);
}
```

## Files Changed

1. **`src-tauri/src/slash_commands.rs`** (lines 154-167)
   - Added deduplication logic for project overriding global
   - Implemented pure alphabetical sorting

2. **`src/tests/slashCommandSorting.test.ts`** (new/updated file)
   - 8 tests for sorting behavior
   - 4 tests for deduplication behavior
   - Total: 12 tests

## Verification

- Rust backend compiles successfully
- All 12 tests pass
- Commands now appear alphabetically without duplicates
- Project commands take precedence over global commands with same name

## Acceptance Criteria

- [x] Commands are sorted alphabetically
- [x] `/background` appears in alphabetical order (not always first)
- [x] No duplicate commands in autocomplete
- [x] Project commands override global commands with same name
- [x] Behavior is consistent across all projects
- [x] Tests verify correct sorting and deduplication behavior
