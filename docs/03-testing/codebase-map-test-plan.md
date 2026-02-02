# Codebase Map - Test & Documentation Guide

This document serves two purposes:
1. **Documentation**: Explains how the Codebase Map feature works
2. **Manual Test Plan**: Step-by-step verification in Quack

---

## How Codebase Map Works

The Codebase Map is an auto-generated index of all TypeScript/TSX exports in a project. Instead of AI agents making 10-20 exploratory `Read` calls to understand the codebase structure, they read a single compact map file (~300 lines) and know exactly where every function, type, and component lives.

The feature has three parts: a Node.js generator script, a PostToolUse hook that auto-updates the map when Claude writes files, and a Settings UI panel for configuration.

### Architecture

```
                    ┌──────────────────────────────┐
                    │     Settings UI (toggle)      │
                    │  CodebaseMapSettings.tsx       │
                    └──────────┬───────────────────┘
                               │ enable/disable
                               ▼
┌──────────────┐    ┌──────────────────────────────┐
│ Claude writes │──▶│  PostToolUse Hook (Write)     │
│ a .ts file   │    │  .claude/settings.json        │
└──────────────┘    └──────────┬───────────────────┘
                               │ triggers
                               ▼
                    ┌──────────────────────────────┐
                    │  generate-codebase-map.mjs    │
                    │  --update-file <changed-file> │
                    └──────────┬───────────────────┘
                               │ writes
                               ▼
                    ┌──────────────────────────────┐
                    │  .quack/codebase-map.md       │
                    │  400 files, 1166 exports      │
                    └──────────────────────────────┘
                               │ read by
                               ▼
                    ┌──────────────────────────────┐
                    │  AI Agent (Claude)            │
                    │  Reads map → navigates code   │
                    └──────────────────────────────┘
```

### Key Concepts

**Generator Script** (`scripts/generate-codebase-map.mjs`): Pure Node.js (zero dependencies). Scans `.ts`/`.tsx` files using regex to extract exported functions, types, interfaces, classes, enums, and re-exports. Two modes:
- **Full scan**: Scans all files, generates complete map (~123ms for 478 files)
- **Incremental**: Updates only one file's section in the existing map (~2ms)

**PostToolUse Hook**: A Claude Code hook that fires after the `Write` tool executes. If enabled, it runs the generator in incremental mode on the file that was just written.

**Map Output**: A markdown file with YAML frontmatter containing stats (file count, export count, timestamp) followed by sections per file listing its exports in compact format.

### Where Things Live

| File | What it does |
|------|-------------|
| `scripts/generate-codebase-map.mjs` | Generator script (Node.js, ESM, zero deps) |
| `src/services/codebaseMapService.ts` | Service layer for Tauri invoke calls |
| `src/components/settings/categories/CodebaseMapSettings.tsx` | Settings UI panel |
| `.quack/codebase-map.md` | Generated map output |
| `.claude/settings.json` | Where the PostToolUse hook is registered |
| `.quack/hooks-metadata.json` | Hook metadata (name, enabled state) |
| `src/components/settings/SettingsSidebar.tsx` | Sidebar category registration |
| `src/components/settings/UnifiedSettings.tsx` | Category routing |
| `src/components/settings/SettingsIcon.tsx` | Category icon |

---

## Manual Testing in Quack

Open Quack and follow each section in order. Make sure you have a project loaded with TypeScript files.

---

### Test 1: Settings Navigation

**What to check**: The Codebase Map category appears in Settings and is navigable.

1. Open Quack
2. Open Settings (gear icon or shortcut)
3. Look at the left sidebar for "Codebase Map" category
4. Click on "Codebase Map"

**Pass criteria**:
- [ ] "Codebase Map" appears in the sidebar between "Second Brain" and "External IDE"
- [ ] An icon is displayed next to the label (graph/chart-like icon with dots)
- [ ] Clicking it loads the Codebase Map settings panel on the right
- [ ] The panel has two sections: "Codebase Map" and "Status"

---

### Test 2: Initial State (No Map Generated Yet)

**What to check**: The UI handles the case where no map has been generated.

1. Open Settings > Codebase Map on a project that has never had a map generated
2. Observe the Status section

**Pass criteria**:
- [ ] "Last generated" shows "Never"
- [ ] "Files indexed" shows "0 files"
- [ ] "Exports found" shows "0 exports"
- [ ] "Auto-generate on file changes" toggle is off
- [ ] "Map location" shows `.quack/codebase-map.md` in green monospace text

---

### Test 3: Generate Now Button

**What to check**: Manual generation creates the codebase map successfully.

1. Open Settings > Codebase Map
2. Click "Generate Now"
3. Watch the button state change
4. Observe the Status section after completion

**Pass criteria**:
- [ ] Button text changes to "Generating..." while running
- [ ] Button is disabled during generation
- [ ] After completion, button returns to "Generate Now"
- [ ] "Last generated" updates to current timestamp
- [ ] "Files indexed" shows a number > 0 (expect ~400 for quack-app)
- [ ] "Exports found" shows a number > 0 (expect ~1166 for quack-app)
- [ ] Console log shows: `Codebase map generated successfully`

**If it doesn't work**: Check DevTools console for errors. Common issue: `run_shell_command` Tauri command may not exist - check if the backend has this command registered.

---

### Test 4: View Map Button

**What to check**: The View Map button reveals the generated file in Finder.

1. First ensure a map has been generated (Test 3)
2. Click "View Map"

**Pass criteria**:
- [ ] Finder opens and highlights `.quack/codebase-map.md` in the project directory
- [ ] The file exists and contains markdown content

**If it doesn't work**: Check if `reveal_in_finder` Tauri command is registered. Console should show error if the path doesn't exist.

---

### Test 5: View Map Content Manually

**What to check**: The generated map file has correct format and content.

1. Open `.quack/codebase-map.md` in any text editor
2. Check the YAML frontmatter
3. Scroll through the content

**Pass criteria**:
- [ ] File starts with `---` YAML frontmatter block
- [ ] Frontmatter contains: `type: codebase-map`, `project:`, `generated:`, `files:`, `exports:`
- [ ] `files:` count matches the Settings UI count
- [ ] `exports:` count matches the Settings UI count
- [ ] Content is organized by `## path/to/file.ts` sections
- [ ] Each section lists exports as `- export fn`, `- export type`, `- export class`, etc.
- [ ] Sections are sorted alphabetically by file path
- [ ] No files from `node_modules`, `dist`, `.git`, or `target` are included
- [ ] Files with zero exports are not listed

---

### Test 6: Auto-Generate Toggle - Enable

**What to check**: Enabling the toggle installs the PostToolUse hook.

1. Open Settings > Codebase Map
2. Toggle "Auto-generate on file changes" ON
3. Check the console for confirmation

**Pass criteria**:
- [ ] Toggle switches to ON position
- [ ] Console shows: `Codebase map auto-update enabled`
- [ ] Verify the hook was installed:

Open `.claude/settings.json` in the project root and confirm it contains:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/generate-codebase-map.mjs --update-file \"$TOOL_INPUT_FILE_PATH\""
          }
        ]
      }
    ]
  }
}
```

- [ ] Verify `.quack/hooks-metadata.json` contains an entry with id `codebase-map-auto-update`

---

### Test 7: Auto-Generate Toggle - Disable

**What to check**: Disabling the toggle removes the hook.

1. Ensure the toggle is currently ON (Test 6)
2. Toggle "Auto-generate on file changes" OFF
3. Check the console

**Pass criteria**:
- [ ] Toggle switches to OFF position
- [ ] Console shows: `Codebase map auto-update disabled`
- [ ] `.claude/settings.json` no longer contains the codebase-map hook entry
- [ ] `.quack/hooks-metadata.json` no longer contains the `codebase-map-auto-update` entry

---

### Test 8: Toggle Persistence Across Settings Reopens

**What to check**: The toggle state persists when closing and reopening Settings.

1. Enable the toggle (ON)
2. Close Settings
3. Reopen Settings > Codebase Map

**Pass criteria**:
- [ ] Toggle is still ON

1. Disable the toggle (OFF)
2. Close Settings
3. Reopen Settings > Codebase Map

- [ ] Toggle is now OFF

---

### Test 9: CLI Script - Full Scan

**What to check**: The generator script works correctly from the command line.

1. Open a terminal in the project root
2. Run:
```bash
node scripts/generate-codebase-map.mjs
```

**Pass criteria**:
- [ ] Script outputs: `Scanned N files, mapped N files with N exports (Nms)`
- [ ] Script outputs: `Output: .quack/codebase-map.md`
- [ ] Execution time is under 500ms
- [ ] `.quack/codebase-map.md` is created/updated

---

### Test 10: CLI Script - Incremental Update

**What to check**: The incremental mode updates only the specified file's section.

1. Open a terminal in the project root
2. Note the current content of a specific file section in the map
3. Run:
```bash
node scripts/generate-codebase-map.mjs --update-file src/App.tsx
```

**Pass criteria**:
- [ ] Script outputs: `Updated src/App.tsx in map (Nms)`
- [ ] Execution time is under 10ms
- [ ] Only the `## src/App.tsx` section in the map was modified
- [ ] The `generated:` timestamp in frontmatter was updated
- [ ] Other file sections remain unchanged

---

### Test 11: CLI Script - New File Addition

**What to check**: Incremental mode handles new files that aren't in the map yet.

1. Create a temporary test file:
```bash
echo 'export function testNewFile(): string { return "test"; }' > src/test-codebase-map-temp.ts
```
2. Run:
```bash
node scripts/generate-codebase-map.mjs --update-file src/test-codebase-map-temp.ts
```
3. Check the map file for the new entry
4. Clean up:
```bash
rm src/test-codebase-map-temp.ts
node scripts/generate-codebase-map.mjs --update-file src/test-codebase-map-temp.ts
```

**Pass criteria**:
- [ ] New section `## src/test-codebase-map-temp.ts` appears in the map after step 2
- [ ] The section contains: `- export fn \`testNewFile(): string\``
- [ ] Section is inserted in alphabetical order
- [ ] After cleanup (step 4), the section is removed from the map

---

### Test 12: No Project Selected State

**What to check**: The UI handles gracefully when no project is selected.

1. If possible, navigate to a state where no session/project is active
2. Open Settings > Codebase Map

**Pass criteria**:
- [ ] "Generate Now" button is disabled
- [ ] "View Map" button is disabled
- [ ] Toggle switch is disabled
- [ ] No errors in console

---

### Test 13: Export Extraction Accuracy

**What to check**: The script correctly identifies different TypeScript export patterns.

1. Create a test file with various export types:
```typescript
// src/test-exports-temp.ts
export function regularFunction(a: string, b: number): boolean { return true; }
export const arrowFn = (x: number): string => String(x);
export interface UserProfile { id: string; name: string; email: string; }
export type Status = 'active' | 'inactive';
export class DatabaseService { }
export enum Color { Red, Green, Blue }
export default function MainComponent() { return null; }
export { something } from './other';
```
2. Run: `node scripts/generate-codebase-map.mjs --update-file src/test-exports-temp.ts`
3. Check the generated section in the map
4. Clean up: `rm src/test-exports-temp.ts`

**Pass criteria**:
- [ ] `export fn regularFunction(a: string, b: number): boolean` is listed
- [ ] `export fn arrowFn(x: number): string` is listed
- [ ] `export type UserProfile { id, name, email }` is listed
- [ ] `export type Status` is listed
- [ ] `export class DatabaseService` is listed
- [ ] `export enum Color` is listed
- [ ] `export default fn MainComponent()` is listed
- [ ] `re-export something from './other'` is listed

---

## Troubleshooting

### Generate Now button does nothing

- Open DevTools console (Cmd+Option+I) and look for errors
- Check if `run_shell_command` Tauri command exists in the backend
- Verify `scripts/generate-codebase-map.mjs` exists and is executable
- Try running the script manually from terminal to isolate the issue

### Toggle doesn't persist

- Check if `.claude/settings.json` is writable
- Check if `.quack/hooks-metadata.json` is writable
- Look for errors in console when toggling
- Verify the `list_hooks` Tauri command returns the expected format

### Map file is empty or missing exports

- Ensure the project has `.ts`/`.tsx` files with `export` statements
- Check that files aren't in excluded directories (`node_modules`, `dist`, etc.)
- Run the script with a single file to debug: `node scripts/generate-codebase-map.mjs --update-file src/App.tsx`

### Hook doesn't fire when Claude writes files

- Verify `.claude/settings.json` contains the PostToolUse hook entry
- Check that `$TOOL_INPUT_FILE_PATH` is set by Claude Code when the Write tool runs
- Check the Claude Code hook execution logs for errors
- Ensure `node` is in PATH when the hook runs

---

## Architecture Summary

### Before (no codebase map)

```
AI Agent needs to understand codebase
  → Glob **/*.ts (finds 478 files)
  → Grep for patterns (reads file content)
  → Read file1.ts (300 lines into context)
  → Read file2.ts (300 lines into context)
  → Read file3.ts (300 lines into context)
  → ... (10-20 Read calls)
  = 3000-6000 lines consumed in context
```

### After (with codebase map)

```
AI Agent needs to understand codebase
  → Read .quack/codebase-map.md (~300 lines)
  → Knows exactly where to find things
  → Read only the specific files needed
  = ~500-800 lines consumed in context
```

### Key Design Decisions

1. **Regex over AST**: Used regex instead of ts-morph/tree-sitter to avoid external dependencies. Regex is sufficient for extracting export signatures and keeps the script at zero dependencies.
2. **Incremental updates**: The PostToolUse hook only re-scans the single file that changed (~2ms) instead of the entire project (~123ms), keeping hook execution imperceptible.
3. **In-project storage**: Map lives at `.quack/codebase-map.md` inside the project rather than in the Brain, because it's project-specific and auto-generated.
4. **Hook-based automation**: Uses Claude Code's existing PostToolUse hook system rather than file watchers, ensuring it only triggers during AI-assisted development sessions.
