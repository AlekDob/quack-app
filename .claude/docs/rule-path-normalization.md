# Rule Path Normalization

**Date**: 2024-12-17
**Feature**: Portable rule paths for shared agents

## Overview

When rules are associated with an agent, the paths are now stored in a **portable format** that allows agents to be shared across different projects and machines.

## Problem

Previously, rule paths were stored as absolute paths:
```
/Users/alekdob/Desktop/Dev/flow-bi/.claude/rules/translate-3-languages.md
```

This caused issues when:
1. Sharing agents across projects (paths wouldn't resolve)
2. Moving projects to different locations
3. Using agents on different machines

## Solution

Rule paths are now normalized based on their scope:

### Project Rules
Stored as relative paths from project root:
```
.claude/rules/translate-3-languages.md
```

### Global Rules
Stored with tilde notation:
```
~/.claude/rules/global-rule.md
```

## Implementation

### Files Modified

1. **`src/utils/rulePathUtils.ts`** (NEW)
   - `normalizeRulePath(path, projectPath?)` - Normalize a single path
   - `normalizeRulePaths(paths, projectPath?)` - Normalize array of paths
   - `resolveRulePath(path, projectPath, homeDir?)` - Resolve back to absolute
   - `migrateRulePaths(paths)` - Migrate legacy absolute paths
   - `getDisplayPath(path)` - Get user-friendly display format
   - `isGlobalRulePath(path)` / `isProjectRulePath(path)` - Path type detection
   - `areRulePathsEqual(path1, path2)` - Compare paths (handles mixed formats)
   - `findRuleByPath(paths, target)` - Find rule in array

2. **`src/components/NewTerminalModal.tsx`**
   - Uses `normalizeRulePaths()` before saving to personality

3. **`src/utils/agentStorage.ts`**
   - Silent migration of legacy paths on `getSavedAgents()`

4. **`src/components/modal-steps/StepRules.tsx`**
   - Uses `getDisplayPath()` for UI rendering

### Migration

Existing agents with legacy absolute paths are automatically migrated when loaded from localStorage. The migration is:
- **Silent** - No user notification
- **Automatic** - Happens on first load
- **Persistent** - Saves migrated paths back to storage

## Testing

Tests are in `src/tests/rulePathUtils.test.ts` (31 tests):
- Path normalization (project and global)
- Path resolution
- Migration of legacy paths
- Path comparison utilities

Run tests:
```bash
npm test -- --run src/tests/rulePathUtils.test.ts
```

## Usage Examples

```typescript
import { normalizeRulePath, resolveRulePath } from '../utils/rulePathUtils';

// Normalize before saving
const normalized = normalizeRulePath('/Users/me/project/.claude/rules/rule.md');
// Result: '.claude/rules/rule.md'

// Resolve when loading
const absolute = resolveRulePath('.claude/rules/rule.md', '/Users/me/project');
// Result: '/Users/me/project/.claude/rules/rule.md'

// Global rules
const globalNormalized = normalizeRulePath('/Users/me/.claude/rules/global.md');
// Result: '~/.claude/rules/global.md'

const globalAbsolute = resolveRulePath('~/.claude/rules/global.md', '/any/path', '/Users/me');
// Result: '/Users/me/.claude/rules/global.md'
```

## Notes

- When displaying rules in UI, always use `getDisplayPath()` for consistent formatting
- When comparing rule paths (e.g., checking if selected), use `areRulePathsEqual()` to handle mixed formats
- The `~` notation is only used for global rules, project rules always start with `.claude/`
