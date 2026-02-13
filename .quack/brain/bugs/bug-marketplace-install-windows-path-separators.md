---
type: bug_fix
project: quack-app
created: 2026-02-10
tags: [marketplace, windows, paths, cross-platform]
---

# Bug: Marketplace Install Failed on Windows - Path Separator Issue

## Problem

Windows users couldn't install any resource (skills, agents, rules, commands) from the Quack Store. All install attempts failed with "Failed to install" toast.

**Root cause**: `useMarketplace.ts` constructed all file paths using string concatenation with hardcoded forward slashes `/`:

```typescript
// BROKEN (Windows incompatible)
let home = await homeDir();  // Returns "C:\Users\Username" on Windows
if (!home.endsWith('/')) home += '/';
const targetPath = `${home}.claude/agents/${agentFile}`;
// Result: "C:\Users\Username/.claude/agents/file.md" (mixed separators)
```

On Windows, `homeDir()` returns `C:\Users\Username` with backslashes, but the code added forward slashes, creating mixed-separator paths like `C:\Users\Username/.claude/agents/file.md` that Windows filesystem operations reject.

## Solution

Replaced **all** path string concatenation with Tauri's `join()` function from `@tauri-apps/api/path`, which automatically uses the correct separator for each OS:

```typescript
// FIXED (cross-platform)
import { homeDir, join } from '@tauri-apps/api/path';

const home = await homeDir();
const targetDir = await join(home, '.claude', 'agents');
const targetPath = await join(targetDir, agentFile);
// macOS: "/Users/alek/.claude/agents/file.md"
// Windows: "C:\Users\alek\.claude\agents\file.md"
```

## Files Changed

**File**: `src/hooks/useMarketplace.ts`

### Fixed Functions:
1. **`checkInstalledResources()`** (lines 275-323)
   - 4 path constructions for checking installed skills/commands/agents/rules

2. **`installResource()`** (lines 358-474)
   - `basePath` construction (global vs project scope)
   - 8 path constructions (4 categories × targetDir + targetPath)

3. **`uninstallResource()`** (lines 476-521)
   - 5 path constructions for removing files/directories

4. **`installAgentBundle()`** (lines 523-661)
   - 4 path constructions for installing bundled skills and rules

### Total: 21 path constructions fixed

## Testing

- TypeScript compiles without errors
- Backward compatible with macOS (uses same normalized paths)
- Windows users should now be able to install from Quack Store

## Related

Pattern used correctly in `src/components/TasksPanel.tsx` (lines 34-35):
```typescript
const home = await homeDir();
const tasksDir = await join(home, '.claude', 'tasks');
```

## Prevention

Always use `join()` from `@tauri-apps/api/path` for cross-platform path construction. Never concatenate paths with string templates containing `/` or `\`.
