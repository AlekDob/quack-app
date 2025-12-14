# Rules System

**Date**: 2024-12-14
**Status**: Implemented

## Overview

The Rules System provides explicit behavior configuration for Claude agents in Quack. Rules are markdown files that define coding standards, workflows, and conventions that agents must follow.

## Problem Solved

Previously, Skills and Droids were displayed in the Agent Context panel as "Recommended Tools". However:
- Skills and Droids are **auto-discovered** by Claude
- Users had no explicit control over which were applied
- Agent behavior was inconsistent

The Rules System solves this by:
- **Explicit assignment**: Users select rules when creating agents
- **Persistent enforcement**: Rules are recapped in each response
- **Clear configuration**: Rules are visible in the Agent Context panel

## Architecture

### File Storage

```
.claude/rules/              # Project rules (shared via git)
  coding-standards.md
  testing-workflow.md

~/.claude/rules/            # Global rules (personal)
  my-conventions.md
```

### Rule File Format

```markdown
---
description: Brief description shown in UI
alwaysApply: true
globs:
  - "**/*.tsx"
  - "**/*.ts"
---

# Rule Content

Instructions for Claude...
```

### Data Flow

```
NewTerminalModal          AgentPersonality           AgentContextPanel
     |                          |                          |
     |-- selectedRules[] -->    |                          |
     |                          |-- selectedRules[] -->    |
     |                          |                          |
                                                           v
                                                    list_rules (Rust)
                                                           |
                                                           v
                                                    Match & Display
```

## Implementation

### Components Modified

1. **AgentContextPanel.tsx**
   - Removed: `recommendedSkills`, `recommendedDroids` state
   - Added: `agentRules: Rule[]` state
   - Added: `onOpenRulesTab` prop
   - New "Agent Rules" collapsible section

2. **SidePanel.tsx**
   - Added: `onOpenRulesTab={() => setActiveTab("rules")}` callback
   - Removed: `onSelectSkill`, `onSelectAgent` props

3. **AgentContextPanel.css**
   - Added: `.context-empty-rules` styles
   - Added: `.add-rules-button` styles

### Type Changes

```typescript
interface AgentContextPanelProps {
  // Removed
  // onSelectSkill?: (skillInfo: SkillInfo) => void;
  // onSelectAgent?: (agentInfo: AgentInfo) => void;

  // Added
  onOpenRulesTab?: () => void;
}
```

### Backend Integration

Rules are loaded via the `list_rules` Tauri command:

```typescript
const rulesResponse = await invoke<{ project: Rule[]; global: Rule[] }>('list_rules', {
  basePath: activeAgentCwd,
});
```

Rules are matched by path from `activeAgentPersonality.selectedRules[]`.

## UI Components

### Agent Rules Section

- Collapsible header with clipboard icon
- Badge showing rule count
- Each rule shows:
  - Document icon
  - Rule name (formatted)
  - "Always" badge (green) if `alwaysApply`
  - Description from frontmatter
  - Scope (Project/Global)
- Click opens rule file in new tab

### Empty State

- "No rules assigned" message
- "Add Rules" button navigates to Rules tab

## Best Practices

### 1. Reference Skills in Rules

For optimal behavior, reference Skills within Rules:

```markdown
## Frontend Development

When building UI:
1. Use the `frontend-design` skill
2. Follow `frontend-dev-guidelines` patterns
```

### 2. Reference Droids in Rules

Delegate specialized work to Droids:

```markdown
## Code Quality

After implementing features:
1. Use `code-reviewer` droid for review
2. Use `test-engineer` droid for tests
```

### 3. Keep Rules Focused

One concern per rule:
- `coding-standards.md` - Code style
- `testing-workflow.md` - Test procedures
- `git-conventions.md` - Git workflow

## Testing

Manual testing checklist:
- [ ] Rules displayed when agent has selectedRules
- [ ] Click on rule opens file in tab
- [ ] Empty state shows when no rules
- [ ] "Add Rules" button navigates to Rules tab
- [ ] Rules match correctly by path

## Related Documentation

- User Guide: `docs/guide/02-core-concepts/rules.md`
- Side Panel: `docs/guide/02-core-concepts/side-panel.md`
- Architecture: `docs/01-architecture.md`
