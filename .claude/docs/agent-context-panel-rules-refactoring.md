# Agent Context Panel - Rules Section Refactoring

**Date**: 2025-12-14
**Task**: Replace "Recommended Tools" (Skills + Droids) with "Agent Rules" section

## Summary

Refactored the `AgentContextPanel` component to display agent-assigned rules instead of the deprecated skills and droids recommendations.

## Changes Made

### 1. AgentContextPanel.tsx

**Removed:**
- `recommendedSkills` and `recommendedDroids` state variables
- Skills loading logic from `loadAgentContext()` (extracting from `personality.skills`)
- Droids loading logic (parsing from `customNotes` "Selected Protocol Droids:" section)
- `onSelectSkill` and `onSelectAgent` props
- "Recommended Tools" UI section

**Added:**
- `agentRules: Rule[]` state variable
- `agentRulesCollapsed` state for section collapse
- `onOpenRulesTab?: () => void` prop for navigation to Rules tab
- Rules loading logic from `activeAgentPersonality.selectedRules[]`
- "Agent Rules" UI section with:
  - Collapsible header with clipboard/checklist icon
  - Rule items showing: name, "Always" badge (if alwaysApply), description, scope
  - Click handler to open rule file as a tab
  - Empty state with "No rules assigned" message and "Add Rules" button

### 2. AgentContextPanel.css

**Added:**
- `.context-empty-rules` - Styling for empty state container
- `.add-rules-button` - Styling for the "Add Rules" navigation button

### 3. SidePanel.tsx

**Changed:**
- Removed `onSelectSkill` and `onSelectAgent` props from AgentContextPanel usage
- Added `onOpenRulesTab={() => setActiveTab("rules")}` callback

## Type Changes

- Import changed from `SkillInfo, AgentInfo` to `Rule`
- Props interface updated to replace skill/agent callbacks with `onOpenRulesTab`

## User Interaction

1. **Rules Display**: When an agent has `selectedRules` in their personality, they are loaded and displayed in the "Agent Rules" section
2. **Click on Rule**: Opens the rule file (.md) as a new tab in the editor
3. **Empty State**: Shows "No rules assigned" with an "Add Rules" button that navigates to the Rules tab
4. **Always Badge**: Rules with `frontmatter.alwaysApply = true` show a green "Always" badge

## Testing Checklist

- [x] TypeScript compiles without errors
- [x] Build succeeds
- [ ] Manual test: Rules are displayed when agent has selectedRules
- [ ] Manual test: Click on rule opens file in tab
- [ ] Manual test: Empty state shows correctly
- [ ] Manual test: "Add Rules" button navigates to Rules tab
