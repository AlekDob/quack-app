# Memory UI Components

**Status**: Implemented
**Date**: 2025-12-15
**Location**: `/src/components/memory/`

## Overview

The Memory UI provides a user interface for viewing, searching, and managing Quack's persistent memory system. It's integrated into the SidePanel as a new "Memory" tab.

## Architecture

### Component Structure

```
memory/
├── MemoryPanel.tsx      - Main container with stats & settings
├── MemoryList.tsx       - List renderer with grouping
├── MemoryItem.tsx       - Individual memory card
└── MemorySearch.tsx     - Search input with filters
```

### Integration

- **Hook**: `useMemory` from `@/hooks/useMemory`
- **SidePanel Tab**: "memory" tab ID
- **Icon**: Brain with neural connections (SVG)

## Components

### MemoryPanel

Main container component that orchestrates all memory UI features.

**Features**:
- Memory statistics (total, verified, global, project)
- Search integration with MemorySearch
- Settings panel toggle
- Error handling
- Loading states

**Props**: None (uses `useMemory` hook internally)

**State**:
- `showSettings`: Toggle for settings panel
- `searchQuery`: Current search query
- `searchFilters`: Active filters (category, scope)

### MemoryList

Renders list of memories with smart grouping and empty states.

**Features**:
- Grouped by category (normal mode)
- Flat list for search results
- Filters out archived memories (normal mode)
- Empty state messages

**Props**:
```typescript
interface MemoryListProps {
  memories: QuackMemory[];
  searchResults: MemorySearchResult[];
  isSearchMode: boolean;
  onVerify: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}
```

### MemoryItem

Individual memory card with actions and expandable content.

**Features**:
- Category badge with color coding
- Confidence indicator (colored dot)
- Verified badge (checkmark)
- Expandable content (>120 chars)
- Action buttons (verify, archive, delete)
- Relative timestamp
- Scope indicator

**Props**:
```typescript
interface MemoryItemProps {
  memory: QuackMemory;
  onVerify: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}
```

**Category Colors**:
- `preference`: #3b82f6 (blue)
- `fact`: #10b981 (green)
- `decision`: #8b5cf6 (purple)
- `pattern`: #f97316 (orange)
- `mistake`: #ef4444 (red)
- `context`: #6b7280 (gray)

**Confidence Colors**:
- `high`: #10b981 (green)
- `medium`: #f59e0b (yellow)
- `low`: #6b7280 (gray)

### MemorySearch

Search input with debounce and filter dropdowns.

**Features**:
- Debounced search (300ms delay)
- Category filter dropdown
- Scope filter dropdown
- Active filter indicators
- Results count display
- Clear filters button

**Props**:
```typescript
interface MemorySearchProps {
  onSearch: (query: string, filters: SearchFilters) => void;
  resultsCount: number;
  isSearching: boolean;
}

interface SearchFilters {
  category?: MemoryCategory;
  scope?: MemoryScope;
}
```

## Design System

### Colors

Uses existing Quack CSS variables:
- Background: `bg-white/5`
- Border: `border-white/10`
- Text: `text-white`, `text-white/50`, `text-white/40`
- Accent: `#f28c52` (Quack orange)
- Hover: `hover:bg-white/8`

### Glassmorphism

Applied via existing SidePanel styles:
- Backdrop blur on panels
- Semi-transparent backgrounds
- Subtle borders

### Icons

From `lucide-react`:
- `Brain`: Memory tab icon
- `Search`: Search input
- `Filter`: Filter toggle
- `RefreshCw`: Refresh button
- `Settings`: Settings toggle
- `CheckCircle2`: Verify action
- `Archive`: Archive action
- `Trash2`: Delete action
- `ChevronDown/Right`: Expand/collapse

## Usage

### Accessing Memory UI

1. Open Quack application
2. Look for the Brain icon in the SidePanel tab bar
3. Click to open Memory tab

### Viewing Memories

- Memories are grouped by category
- Each card shows:
  - Category badge (colored)
  - Confidence level (dot)
  - Content (truncated if long)
  - Timestamp (relative)
  - Scope (global/project)

### Searching Memories

1. Type in search box (auto-debounced)
2. Click "Filters" to open filter dropdowns
3. Select category and/or scope
4. Results update automatically
5. Click "Clear" to reset filters

### Managing Memories

**Verify**: Mark memory as user-verified (increases confidence to "high")
**Archive**: Hide memory without deleting (can be shown via filters)
**Delete**: Permanently remove memory

### Settings

Click Settings icon to view:
- Enabled status
- Auto-extract setting
- Semantic search status
- Max memories limit

## Tests

**Location**: `/src/tests/memory-ui.test.tsx`

**Test Coverage**:
- ✅ Relative time formatting
- ✅ Memory grouping by category
- ✅ Archived memory filtering
- ✅ Search debouncing
- ✅ Category color mapping

**Run Tests**:
```bash
npm test src/tests/memory-ui.test.tsx
```

## Code Quality

### Component Size
- `MemoryPanel.tsx`: 200 lines ✅
- `MemoryList.tsx`: 127 lines ✅
- `MemoryItem.tsx`: 172 lines ✅
- `MemorySearch.tsx`: 175 lines ✅

All components under 300 line limit.

### Function Size
All functions under 20 line limit ✅

### TypeScript
- Strict mode enabled ✅
- No `any` types ✅
- Type-only imports where required ✅

## Accessibility

### Keyboard Navigation
- Tab through all interactive elements
- Enter/Space to activate buttons
- Focus visible on all controls

### ARIA
- `aria-label` on icon-only buttons
- `title` attributes for context
- Semantic HTML elements

### Screen Reader
- Descriptive button labels
- Status announcements via toast
- Logical tab order

## Performance

### Optimization Strategies
1. **Debounced Search**: 300ms delay reduces API calls
2. **Filtered Rendering**: Only shows non-archived in normal mode
3. **Lazy Expansion**: Content truncation for long memories
4. **React Hooks**: `useCallback` for stable function references
5. **Conditional Rendering**: Components only render when tab is active

### Bundle Impact
- **Memory components**: ~21 KB (uncompressed)
- **Lucide icons**: Already in bundle (shared)
- **useMemory hook**: Already implemented (no additional cost)

## Future Enhancements

### Planned Features
1. **Virtualized List**: For 1000+ memories (react-window)
2. **Memory Export**: Download memories as JSON/CSV
3. **Bulk Actions**: Select multiple memories for batch operations
4. **Memory Editing**: Inline editing of memory content
5. **Advanced Filters**: Date range, access count, etc.
6. **Memory Visualization**: Graph view of memory relationships
7. **Memory Import**: Upload memories from external sources

### Performance Improvements
1. Implement virtualization for large lists
2. Add loading skeleton states
3. Optimize search with Web Workers
4. Cache search results

### UX Improvements
1. Drag-and-drop to reorder
2. Context menu (right-click actions)
3. Keyboard shortcuts (e.g., Cmd+F to search)
4. Memory preview on hover
5. Category color customization

## Troubleshooting

### Memory Tab Not Showing
- Verify `MemoryPanel` import in `SidePanel.tsx`
- Check `TabId` union includes "memory"
- Verify icon is defined in `icons` object

### Search Not Working
- Check `useMemory` hook is initialized
- Verify `searchMemories` service is available
- Check browser console for errors

### Memories Not Loading
- Verify memory storage is initialized
- Check IndexedDB in browser DevTools
- Look for errors in memory services

### Type Errors
- Ensure `MemorySearchOptions` is imported as type-only
- Verify all memory types are imported from `@/types/memory`

## Related Documentation

- [Memory System Architecture](../01-architecture.md#memory-system)
- [Memory Services](../04-build-setup/memory-services.md)
- [useMemory Hook](../../src/hooks/useMemory.ts)
- [Memory Types](../../src/types/memory.ts)

## Changelog

### 2025-12-15
- Initial implementation of Memory UI components
- Integration with SidePanel
- Tests added
- Documentation created
