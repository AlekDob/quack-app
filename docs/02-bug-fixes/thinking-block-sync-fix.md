# Bug Fix: ThinkingBlock Sync Issue

## Problem

When a user enters "thinking mode" (Ultra Think) and collapses the thinking-block, they get "trapped" - pressing Tab to cycle thinking modes doesn't reset the expanded state, leaving them stuck with collapsed blocks.

## Root Cause

**ThinkingBlock was an uncontrolled component with isolated state** that didn't sync with the parent component hierarchy.

### Problematic Code

```typescript
// ThinkingBlock.tsx (BEFORE)
const [isExpanded, setIsExpanded] = useState(defaultExpanded);
// defaultExpanded read ONLY ONCE at mount
// NOT synchronized when parent changes thinking mode
```

The issue was in the data flow:

1. `ChatView.tsx` handles Tab key to cycle thinking modes
2. `ThinkingBlock.tsx` had local state completely disconnected from parent
3. No mechanism existed to "reset" blocks when thinking mode changed

## Solution

### 1. ThinkingBlock as Controlled Component with Reset Key

Added support for controlled mode and a `resetKey` prop:

```typescript
// ThinkingBlock.tsx (AFTER)
interface ThinkingBlockProps {
  content: string;
  isExpanded?: boolean;           // Optional controlled state
  onExpandedChange?: (expanded: boolean) => void;
  defaultExpanded?: boolean;
  resetKey?: string | number;     // NEW: Triggers reset when changed
}

function ThinkingBlock({
  content,
  isExpanded: controlledExpanded,
  onExpandedChange,
  defaultExpanded = false,
  resetKey
}: ThinkingBlockProps) {
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);

  // Reset local state when resetKey changes
  useEffect(() => {
    if (resetKey !== undefined) {
      setLocalExpanded(defaultExpanded);
    }
  }, [resetKey, defaultExpanded]);

  // Use controlled state if provided, otherwise use local state
  const expanded = controlledExpanded !== undefined ? controlledExpanded : localExpanded;
  // ...
}
```

### 2. ChatView Reset Counter

Added a counter in `ChatView.tsx` that increments when Tab cycles thinking modes:

```typescript
// ChatView.tsx
const [thinkingModeResetCounter, setThinkingModeResetCounter] = useState(0);

// In Tab key handler:
if (e.key === 'Tab' && !e.shiftKey && !isLoading && onThinkingModeChange) {
  e.preventDefault();
  onThinkingModeChange(modes[nextIndex]);

  // Increment reset counter to re-expand all ThinkingBlocks
  setThinkingModeResetCounter(prev => prev + 1);
}
```

### 3. Prop Drilling Through Component Hierarchy

The reset key is passed down:

```
ChatView → MessageList → ChatMessage → ThinkingBlock
           (thinkingModeResetKey prop)
```

## Files Modified

| File | Change |
|------|--------|
| `src/components/ThinkingBlock.tsx` | Added resetKey prop and controlled component support |
| `src/components/ChatMessage.tsx` | Pass resetKey to ThinkingBlock |
| `src/components/MessageList.tsx` | Accept and forward thinkingModeResetKey prop |
| `src/components/ChatView.tsx` | Add reset counter, increment on Tab key |

## Testing

New test file: `src/tests/thinkingBlockSync.test.ts`

Tests cover:
- Local state maintenance in uncontrolled mode
- Reset behavior when resetKey changes
- Multiple resets as resetKey increments
- Integration of reset counter with ThinkingBlock state

Run tests:
```bash
npm test -- --run src/tests/thinkingBlockSync.test.ts
```

## Acceptance Criteria

- [x] ThinkingBlock accepts `resetKey` prop
- [x] ThinkingBlock has `onExpandedChange` callback (for future controlled usage)
- [x] Tab key resets all thinking blocks to expanded=true
- [x] Default state is now expanded (better UX)
- [x] Tests written and passing (7 tests)
- [x] No regression on messages without thinking content

## Design Pattern

This fix implements the **Controlled/Uncontrolled Component Pattern** with a **Reset Key**:

1. Component can work in uncontrolled mode (local state)
2. Component can work in controlled mode (props from parent)
3. A reset key allows the parent to "reset" local state without full control

This pattern is useful when:
- You want optional controlled behavior
- You need parent-triggered resets without full state management
- You want backwards compatibility with uncontrolled usage
