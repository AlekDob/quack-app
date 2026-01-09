# Project Color Coding

## Overview

Visual color-coding system for repository groups in the Terminal Sidebar. Each project automatically gets assigned a unique color from a predefined palette, providing quick visual identification and better organization.

## Implementation Date
2026-01-09

## Files Modified
- `/src/components/TerminalSidebar.tsx` - Main implementation with storage, state management, and visual styling

## Key Features

### 1. Extended Storage Format
**New format in `.quack-repo-order.dat`:**
```typescript
interface ProjectStorageData {
  order: string[];                      // Repository order (existing)
  colors: Record<string, string>;       // NEW: Project colors map
}

// Example:
{
  order: ["repo-quack-app", "repo-claude-code", "repo-portfolio"],
  colors: {
    "repo-quack-app": "#FF6B35",       // Orange
    "repo-claude-code": "#4DA6FF",     // Blue
    "repo-portfolio": "#9B59B6"        // Purple
  }
}
```

### 2. Default Color Palette
8-color palette designed to match Quack's design system:
```typescript
const DEFAULT_PROJECT_COLORS = [
  '#FF6B35', // Orange (Quack primary)
  '#4DA6FF', // Blue
  '#9B59B6', // Purple
  '#2ECC71', // Green
  '#E74C3C', // Red
  '#F39C12', // Yellow
  '#1ABC9C', // Teal
  '#E84393', // Pink
];
```

Colors cycle when there are more than 8 projects (modulo operation).

### 3. Backward Compatibility
**Automatic migration from old format:**
```typescript
// Old format (array)
["repo-quack-app", "repo-claude-code"]

// Auto-migrates to new format
{
  order: ["repo-quack-app", "repo-claude-code"],
  colors: {
    "repo-quack-app": "#FF6B35",
    "repo-claude-code": "#4DA6FF"
  }
}
```

Migration happens automatically on first load and persists immediately.

### 4. Auto-Assignment for New Projects
When a new repository is detected:
1. Color is auto-assigned based on position in order array
2. Uses modulo operation to cycle through palette
3. Persists to storage immediately

```typescript
// New project "repo-my-app" is 3rd in list
const colorIndex = 2 % DEFAULT_PROJECT_COLORS.length; // = 2
const color = DEFAULT_PROJECT_COLORS[2]; // = #9B59B6 (Purple)
```

### 5. Visual Styling
Each repository group gets:
- **Background tint**: `${projectColor}12` (~7% opacity)
- **Left border**: `3px solid ${projectColor}` (full opacity)

```tsx
// Applied to sortable-repository-group div
style={{
  backgroundColor: projectColor ? `${projectColor}12` : undefined,
  borderLeft: projectColor ? `3px solid ${projectColor}` : undefined,
}}
```

## State Management

### State Variables
```typescript
const [repositoryOrder, setRepositoryOrder] = useState<string[]>([]);
const [projectColors, setProjectColors] = useState<Record<string, string>>({});
```

### Load on Mount
```typescript
useEffect(() => {
  const loadOrderAndColors = async () => {
    const store = await Store.load('.quack-repo-order.dat');
    const savedData = await store.get<ProjectStorageData | string[]>('repository-order');

    if (Array.isArray(savedData)) {
      // Old format - migrate
      const migratedData = { order: savedData, colors: {} };
      savedData.forEach((repoKey, index) => {
        migratedData.colors[repoKey] = DEFAULT_PROJECT_COLORS[index % DEFAULT_PROJECT_COLORS.length];
      });
      await store.set('repository-order', migratedData);
      await store.save();
      setRepositoryOrder(migratedData.order);
      setProjectColors(migratedData.colors);
    } else {
      // New format - use directly
      setRepositoryOrder(savedData.order);
      setProjectColors(savedData.colors);
    }
  };
  loadOrderAndColors();
}, []);
```

### Save Function
```typescript
const saveRepositoryOrder = useCallback(async (order: string[], colors: Record<string, string>) => {
  const store = await Store.load('.quack-repo-order.dat');
  const data: ProjectStorageData = { order, colors };
  await store.set('repository-order', data);
  await store.save();
}, []);
```

### Auto-Assignment in useMemo
When new projects are detected in `orderedRepositoryGroups`:
```typescript
const newRepos: string[] = [];
for (const [name, group] of repositoryGroups) {
  const repoKey = `repo-${name}`;
  if (!added.has(repoKey)) {
    ordered.push([name, group]);
    newRepos.push(repoKey);
  }
}

if (newRepos.length > 0) {
  const updatedColors = { ...projectColors };
  const updatedOrder = [...repositoryOrder, ...newRepos];

  newRepos.forEach((repoKey, index) => {
    if (!updatedColors[repoKey]) {
      const colorIndex = (repositoryOrder.length + index) % DEFAULT_PROJECT_COLORS.length;
      updatedColors[repoKey] = DEFAULT_PROJECT_COLORS[colorIndex];
    }
  });

  setProjectColors(updatedColors);
  setRepositoryOrder(updatedOrder);
  saveRepositoryOrder(updatedOrder, updatedColors);
}
```

## Component Props

### SortableRepositoryGroup
Added `projectColor` prop:
```typescript
interface SortableRepositoryGroupProps {
  // ... existing props
  projectColor?: string; // Color for visual identification
}
```

Passed from parent:
```tsx
{orderedRepositoryGroups.map(([repoName, group]) => {
  const repoKey = `repo-${repoName}`;
  const projectColor = projectColors[repoKey];

  return (
    <SortableRepositoryGroup
      key={repoKey}
      repoKey={repoKey}
      projectColor={projectColor}
      // ... other props
    />
  );
})}
```

## Persistence Behavior

### Triggers for Save
1. **Drag-and-drop reorder** - Saves new order + existing colors
2. **New project detected** - Saves updated order + auto-assigned color
3. **Migration from old format** - Saves immediately after migration

### Storage Location
`.quack-repo-order.dat` in Tauri Store (platform-specific location)

### Data Structure
```typescript
// Key: 'repository-order'
// Value: ProjectStorageData object
{
  order: string[];
  colors: Record<string, string>;
}
```

## Color Assignment Algorithm

### Initial Assignment
```typescript
// For existing projects (migration)
savedOrder.forEach((repoKey, index) => {
  colors[repoKey] = DEFAULT_PROJECT_COLORS[index % DEFAULT_PROJECT_COLORS.length];
});
```

### Dynamic Assignment (New Projects)
```typescript
// For new projects detected at runtime
const colorIndex = (repositoryOrder.length + index) % DEFAULT_PROJECT_COLORS.length;
const color = DEFAULT_PROJECT_COLORS[colorIndex];
```

### Collision Handling
Colors cycle through palette using modulo operation. With 8 colors:
- Projects 1-8: Unique colors
- Projects 9-16: Repeat colors (but different contexts)
- Projects 17+: Continue cycling

## Visual Design

### Background Opacity
`${projectColor}12` = hex color + "12" suffix for ~7% opacity
- `#FF6B35` → `#FF6B3512` (light orange tint)
- `#4DA6FF` → `#4DA6FF12` (light blue tint)

### Border Style
`3px solid ${projectColor}` - Full opacity for clear visual indicator

### Example Result
```tsx
<div style={{
  backgroundColor: '#FF6B3512',    // Light orange background
  borderLeft: '3px solid #FF6B35'  // Solid orange left border
}}>
  {/* Repository group content */}
</div>
```

## Testing Checklist

- [ ] Load app with existing `.quack-repo-order.dat` (old format) - should migrate
- [ ] Load app with no saved order - should auto-assign colors to all projects
- [ ] Create new project - should auto-assign next color in palette
- [ ] Drag-and-drop reorder - should preserve colors
- [ ] Restart app - colors should persist across sessions
- [ ] Multiple projects (9+) - should cycle colors correctly
- [ ] Visual verification - background tint + left border visible

## Future Enhancements

### Manual Color Picker
Allow users to customize project colors:
```typescript
// Add to context menu or project settings
onChangeColor: (repoKey: string, newColor: string) => void;
```

### Color Themes
Multiple predefined palettes:
- Default (current)
- Pastel
- Vibrant
- Monochrome
- Custom

### Semantic Colors
Auto-assign based on project type:
- Frontend projects: Blue/Cyan
- Backend projects: Green/Teal
- Documentation: Purple
- Testing: Orange

### Color Conflicts
Detect similar colors and suggest alternatives when palette cycles.

## Technical Notes

### Performance
- Colors loaded once on mount
- Minimal re-renders (only when colors change)
- useMemo prevents unnecessary recalculations

### Memory Usage
- Small footprint: `Record<string, string>` with ~10-20 entries typical
- Persisted to disk, not kept in memory permanently

### Browser Compatibility
- CSS hex colors with opacity suffix widely supported
- Fallback: `undefined` disables styling if no color assigned

## Related Files
- `/src/components/RepositoryGroup.tsx` - Renders repository groups (unchanged)
- `/src/components/DragHandle.tsx` - Drag-and-drop handle (unchanged)
- `/.quack-repo-order.dat` - Tauri Store file (auto-created)

## Dependencies
- `@tauri-apps/plugin-store` - File-based key-value storage
- `@dnd-kit/sortable` - Drag-and-drop functionality
- React hooks: `useState`, `useEffect`, `useCallback`, `useMemo`
