---
type: pattern
created: 2026-02-11
tags: [ui, groups, context-menu, hover, sidebar]
---

# Pattern: Group Management UI with Hover Actions and Context Menu

## Problem

Users needed a way to manage project groups in the sidebar: remove individual projects from group or disband entire group.

## Solution

Dual-interaction pattern:

### 1. Hover Icon (Quick Action)
- X icon (disband) appears on hover over group header
- Fade-in smooth (opacity 0 to 1, transition 0.15s)

### 2. Right-Click Context Menu
- List of "Remove {project}" actions for each project
- "Disband group" action (red, destructive)

## Key Implementation Details

### Remove Project from Group
- If remaining < 2 projects after removal, auto-disband the group
- Groups require at least 2 projects

### Disband Group (Backend)
1. Reads `group.json` for project list
2. Removes `<!-- QUACK_GROUP_CONTEXT -->` from each project's CLAUDE.md
3. Deletes `~/.quack/groups/{id}/`

### Gotchas
- `e.stopPropagation()` on hover icon click to prevent group collapse
- Context menu fullscreen backdrop with `zIndex: 9999`

## Reusability

This pattern applies to any collapsible element needing quick-access hover actions + context menu for complex actions.
