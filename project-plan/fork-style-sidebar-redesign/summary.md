# Fork-Style Sidebar Redesign

## Objective
Transform the current TerminalSidebar into a sleek, Fork Git client-inspired design with dark mode and glass effect.

## Visual Requirements
- **Fork-inspired dark mode aesthetic** - compact, minimal, professional
- **Glass/blur transparency effect** - show Mac desktop underneath
- **Color dots on the left** - replace current status indicators
- **Compact layout** - reduce padding, margins, overall size
- **Temporarily disable status indicators** - comment out "PRONTO"/"IN ESECUZIONE" logic

## Technical Implementation Areas

### 1. CSS Glass Effect Implementation
**Current State**: Sidebar has `backdrop-filter: blur(14px)` but solid background `#181A21`
**Target**: True glass transparency showing Mac desktop underneath
- **Change**: `background: #181A21` → `background: rgba(24, 26, 33, 0.75)` or similar
- **Enhance blur**: Possibly increase blur from 14px to 18-20px for better effect
- **Add transparency**: Semi-transparent background to show desktop through
- **Test**: Ensure performance is good with Tauri window rendering

### 2. Layout Restructuring - Fork-Style Compact Design
**Current Elements to Modify**:
- **.sidebar-header** (lines 508-515): Make more compact, smaller padding
- **.sidebar-list** (lines 543-549): Reduce spacing between items
- **.terminal-item** (lines 551-561): Make smaller, more minimal
- **.sidebar-title**: Reduce font size, make lighter weight
- **.sidebar-button**: Smaller, more subtle

**Changes Needed**:
- Reduce padding from `1rem 1.25rem` to `0.65rem 0.9rem`
- Terminal item padding from `0.55rem 0.65rem` to `0.35rem 0.45rem`
- Reduce gap between items from `0.6rem` to `0.35rem`
- Smaller fonts and lighter typography weights

### 3. Color Dot System (Replace Status Chips)
**Current**: Full status chips with "PRONTO"/"IN ESECUZIONE" text
**Target**: Simple colored dots on the left like Fork
- **Remove**: `.terminal-status-chip` entirely from JSX
- **Replace**: `<input type="color">` with simple `<div class="terminal-dot">`
- **Style**: Small 8-10px colored circles, positioned left
- **Color**: Use existing `terminal.color` values
- **Layout**: Dot + terminal name only, very clean

### 4. CSS Architecture
- **Glass effect classes**: reusable backdrop-blur utilities
- **Dark theme consistency**: ensure colors match Fork aesthetic
- **Responsive behavior**: maintain functionality at different sizes
- **Terminal item styling**: clean, minimal list items

## Files to Modify

### Primary Files
- `src/components/TerminalSidebar.tsx` - main component restructure
- `src/App.css` - glass effects, dark theme, compact styling

### Secondary Files
- `src/App.tsx` - temporary state logic modifications
- `src/types.ts` - potentially update interfaces if needed

## Questions for Clarification
1. Should color dots correspond to existing terminal color assignments?
2. Glass effect always active or user-configurable?
3. Maintain current terminal switching functionality?
4. Any specific Fork UI elements to prioritize (beyond general aesthetic)?

## Success Criteria
- [ ] Sidebar visually matches Fork client dark mode aesthetic
- [ ] Glass/blur effect successfully implemented
- [ ] Color dots replace status indicators
- [ ] Compact, minimal layout achieved
- [ ] Terminal switching functionality preserved
- [ ] Performance remains smooth with glass effects