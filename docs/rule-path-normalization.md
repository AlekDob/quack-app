# Rule Path Normalization

This document explains the portable path format for agent rules in Quack.

## Overview

When agents are shared across projects or machines, rule paths need to be stored in a portable format that works regardless of the user's home directory or project location.

## Path Formats

### Project Rules

Project-specific rules are stored as relative paths from the project root:

```
.claude/rules/my-rule.md
```

### Global Rules

Global rules use tilde notation to reference the user's home directory:

```
~/.claude/rules/my-rule.md
```

## Implementation

The path normalization utilities are in `src/utils/rulePathUtils.ts`:

- `normalizeRulePath()` - Converts absolute paths to portable format
- `resolveRulePath()` - Resolves portable paths to absolute paths
- `areRulePathsEqual()` - Compares paths accounting for different formats

## Migration

Legacy absolute paths are silently migrated when agents are loaded. This ensures backward compatibility with existing agents while normalizing paths for future use.

## Tests

31 tests in `src/tests/rulePathUtils.test.ts` verify the implementation works correctly for:

- Project rules in various formats
- Global rules with tilde notation
- Edge cases (Windows paths, nested directories, etc.)
- Migration of legacy paths
