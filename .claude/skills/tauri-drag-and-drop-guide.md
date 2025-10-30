# Tauri Drag & Drop Implementation Guide

## The Problem

When implementing HTML5 drag-and-drop in Tauri applications, you'll encounter a common issue: **dragging works, but dropping doesn't**.

This happens because Tauri intercepts drag-and-drop events by default to handle external file drops (from Finder/Explorer into your app). This interception prevents internal HTML5 drag-and-drop from working properly.

## The Solution

### Tauri v2: Disable `dragDropEnabled`

In Tauri v2, add this to your `tauri.conf.json`:

```json
{
  "app": {
    "windows": [
      {
        "title": "Your App",
        "dragDropEnabled": false  // ← This disables Tauri's file drop interception
      }
    ]
  }
}
```

**Note:** In Tauri v1, this property was called `fileDropEnabled`.

### Trade-offs

- ✅ **Internal HTML5 drag-and-drop works** (reordering lists, tabs, cards, etc.)
- ❌ **External file drop is disabled** (can't drag files from Finder/Explorer into app)

If you need both:
- Keep `dragDropEnabled: true`
- Use Tauri's file drop API via `onFileDrop` event listener
- Handle internal drag-and-drop through custom event management

## Implementation Steps

### 1. Configure Tauri

Edit `src-tauri/tauri.conf.json`:

```json
{
  "app": {
    "windows": [
      {
        "dragDropEnabled": false
      }
    ]
  }
}
```

### 2. Add State Management

In your React component:

```tsx
const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
```

### 3. Implement Drag Handlers

```tsx
const handleDragStart = (e: React.DragEvent, item: YourItem) => {
  setDraggedItemId(item.id);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', item.id);
};

const handleDragOver = (e: React.DragEvent, item: YourItem) => {
  e.preventDefault(); // CRITICAL: Allow drop
  if (item.id === draggedItemId) return; // Can't drop on self
  e.dataTransfer.dropEffect = 'move';
  setDragOverItemId(item.id);
};

const handleDragLeave = () => {
  setDragOverItemId(null);
};

const handleDrop = (e: React.DragEvent, targetItem: YourItem) => {
  e.preventDefault();
  if (!draggedItemId || targetItem.id === draggedItemId) return;

  // Reorder logic
  const draggedIndex = items.findIndex(i => i.id === draggedItemId);
  const targetIndex = items.findIndex(i => i.id === targetItem.id);

  const newItems = [...items];
  const [draggedItem] = newItems.splice(draggedIndex, 1);
  newItems.splice(targetIndex, 0, draggedItem);

  // Update state
  setItems(newItems);
  setDragOverItemId(null);
};

const handleDragEnd = () => {
  setDraggedItemId(null);
  setDragOverItemId(null);
};
```

### 4. Add to JSX

```tsx
<div
  draggable={true}
  onDragStart={(e) => handleDragStart(e, item)}
  onDragOver={(e) => handleDragOver(e, item)}
  onDragLeave={handleDragLeave}
  onDrop={(e) => handleDrop(e, item)}
  onDragEnd={handleDragEnd}
  className={`item ${draggedItemId === item.id ? 'dragging' : ''} ${
    dragOverItemId === item.id ? 'drag-over' : ''
  }`}
>
  {item.content}
</div>
```

## Visual Feedback CSS

```css
/* Item being dragged */
.item.dragging {
  opacity: 0.4;
  cursor: grabbing !important;
  background: rgba(255, 255, 255, 0.05);
}

/* Item being dragged over (drop target) */
.item.drag-over {
  background: rgba(var(--accent-rgb), 0.15);
  border-left: 2px solid var(--accent);
  transition: all 0.1s ease;
}

/* Cursor feedback */
.item[draggable="true"] {
  cursor: grab;
}

.item[draggable="true"]:active {
  cursor: grabbing;
}

/* Non-draggable items */
.item[draggable="false"] {
  cursor: default;
}
```

## Complete Example: Tab Reordering

### Component Code

```tsx
interface Tab {
  id: string;
  label: string;
  type: 'file' | 'chat';
}

interface TabBarProps {
  tabs: Tab[];
  onTabReorder?: (tabs: Tab[]) => void;
}

const TabBar: React.FC<TabBarProps> = ({ tabs, onTabReorder }) => {
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, tab: Tab) => {
    if (tab.type === 'chat') {
      e.preventDefault(); // Chat tab not draggable
      return;
    }
    setDraggedTabId(tab.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tab.id);
  };

  const handleDragOver = (e: React.DragEvent, tab: Tab) => {
    e.preventDefault();
    if (tab.type === 'chat' || tab.id === draggedTabId) return;
    e.dataTransfer.dropEffect = 'move';
    setDragOverTabId(tab.id);
  };

  const handleDrop = (e: React.DragEvent, targetTab: Tab) => {
    e.preventDefault();
    if (!draggedTabId || targetTab.id === draggedTabId || targetTab.type === 'chat') {
      return;
    }

    const draggedIndex = tabs.findIndex(t => t.id === draggedTabId);
    const targetIndex = tabs.findIndex(t => t.id === targetTab.id);

    const newTabs = [...tabs];
    const [draggedTab] = newTabs.splice(draggedIndex, 1);
    newTabs.splice(targetIndex, 0, draggedTab);

    if (onTabReorder) {
      onTabReorder(newTabs);
    }
    setDragOverTabId(null);
  };

  const handleDragEnd = () => {
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  return (
    <div className="tab-bar">
      {tabs.map(tab => (
        <button
          key={tab.id}
          draggable={tab.type !== 'chat'}
          onDragStart={(e) => handleDragStart(e, tab)}
          onDragOver={(e) => handleDragOver(e, tab)}
          onDragLeave={() => setDragOverTabId(null)}
          onDrop={(e) => handleDrop(e, tab)}
          onDragEnd={handleDragEnd}
          className={`tab-item ${draggedTabId === tab.id ? 'dragging' : ''} ${
            dragOverTabId === tab.id ? 'drag-over' : ''
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
```

### Persist Reordered State

```tsx
// In parent component (e.g., App.tsx)
const handleTabReorder = useCallback((reorderedTabs: Tab[]) => {
  console.log('[handleTabReorder] Reordering tabs');

  // Update global state
  setTabs(reorderedTabs);

  // Persist to storage (e.g., tabsByTerminal Map)
  if (activeTerminalId) {
    setTabsByTerminal((prev) => {
      const updated = new Map(prev);
      const fileTabs = reorderedTabs.filter(t => t.type === 'file');

      if (fileTabs.length > 0) {
        updated.set(activeTerminalId, fileTabs);
      }

      return updated;
    });
  }
}, [activeTerminalId]);

<TabBar tabs={tabs} onTabReorder={handleTabReorder} />
```

## Common Patterns

### 1. List Reordering

Use for: Todo lists, playlist items, navigation menu items

```tsx
// Same pattern as tabs, but for list items
const handleDrop = (e, targetItem) => {
  // ... reorder logic
  setItems(newItems);

  // Optional: persist to backend
  await api.updateItemsOrder(newItems);
};
```

### 2. Card Drag & Drop (Kanban Style)

```tsx
const handleDrop = (e, targetColumn) => {
  const cardId = e.dataTransfer.getData('cardId');
  const sourceColumn = e.dataTransfer.getData('sourceColumn');

  // Move card between columns
  moveCard(cardId, sourceColumn, targetColumn);
};
```

### 3. File Upload with Drag & Drop (Workaround)

If you need external file drop AND internal drag-and-drop:

```tsx
// Keep dragDropEnabled: true in Tauri config
// Use Tauri's file drop API
import { listen } from '@tauri-apps/api/event';

useEffect(() => {
  const unlisten = listen('tauri://file-drop', (event) => {
    const files = event.payload as string[];
    handleFileUpload(files);
  });

  return () => {
    unlisten.then(fn => fn());
  };
}, []);

// Handle internal drag-and-drop with custom data attributes
// to distinguish from external file drops
```

## Best Practices

### 1. Accessibility

```tsx
// Add keyboard support
const handleKeyDown = (e: KeyboardEvent, item) => {
  if (e.key === 'ArrowUp' && e.ctrlKey) {
    moveItemUp(item);
  } else if (e.key === 'ArrowDown' && e.ctrlKey) {
    moveItemDown(item);
  }
};

// Add ARIA attributes
<div
  draggable={true}
  role="button"
  aria-grabbed={draggedItemId === item.id}
  aria-label={`Reorder ${item.label}`}
  tabIndex={0}
  onKeyDown={(e) => handleKeyDown(e, item)}
>
```

### 2. Performance

```tsx
// Debounce dragOver events
import { useDebouncedCallback } from 'use-debounce';

const debouncedDragOver = useDebouncedCallback(
  (itemId: string) => {
    setDragOverItemId(itemId);
  },
  50 // ms
);
```

### 3. Edge Cases

```tsx
const handleDrop = (e, targetItem) => {
  e.preventDefault();

  // Validate drop
  if (!draggedItemId) return;
  if (targetItem.id === draggedItemId) return; // Can't drop on self
  if (targetItem.isLocked) return; // Locked items can't be reordered

  // ... proceed with reorder
};
```

### 4. Touch Support

For mobile/tablet support, consider using a library like `react-dnd` or `@dnd-kit/core` which handle touch events automatically.

## Troubleshooting

### Issue: Drag works but drop doesn't fire

**Solution:** Make sure you call `e.preventDefault()` in `onDragOver`:

```tsx
const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault(); // ← CRITICAL
  // ...
};
```

### Issue: Drop fires on wrong element

**Solution:** Check your event propagation and stopPropagation:

```tsx
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation(); // Prevent parent handlers
  // ...
};
```

### Issue: Visual feedback not showing

**Solution:** Ensure CSS classes are being applied:

```tsx
// Debug with console.log
console.log('Dragging:', draggedItemId);
console.log('Drag over:', dragOverItemId);
```

### Issue: Drag ghost image looks wrong

**Solution:** Customize the drag image:

```tsx
const handleDragStart = (e, item) => {
  // Create custom drag preview
  const dragPreview = document.createElement('div');
  dragPreview.textContent = item.label;
  dragPreview.style.position = 'absolute';
  dragPreview.style.top = '-1000px';
  document.body.appendChild(dragPreview);

  e.dataTransfer.setDragImage(dragPreview, 0, 0);

  setTimeout(() => {
    document.body.removeChild(dragPreview);
  }, 0);
};
```

## Summary

1. **Disable Tauri's drag-and-drop interception**: `dragDropEnabled: false` in `tauri.conf.json`
2. **State management**: Track `draggedItemId` and `dragOverItemId`
3. **Event handlers**: Implement all drag events (start, over, leave, drop, end)
4. **Visual feedback**: Add CSS classes for `.dragging` and `.drag-over`
5. **Persistence**: Save reordered state to storage/backend
6. **Accessibility**: Add keyboard support and ARIA attributes
7. **Testing**: Test edge cases (locked items, validation, etc.)

## When to Use This Guide

- Implementing drag-and-drop for **any** Tauri component
- Debugging "drag works but drop doesn't" issues
- Reordering UI elements (lists, tabs, cards, etc.)
- Understanding Tauri's file drop behavior
- Learning best practices for accessible drag-and-drop

---

**Created:** 2025-01-XX
**Last Updated:** 2025-01-XX
**Tested with:** Tauri v2, React 19, TypeScript 5.8
