# Zustand Store Usage Examples

## Basic Usage

### 1. Direct Store Usage (Recommended)

```typescript
import { useTerminalStore } from '../stores';

function TerminalList() {
  // Subscribe only to terminals array
  const terminals = useTerminalStore((state) => state.terminals);

  // Subscribe to multiple values
  const { activeId, setActiveId } = useTerminalStore((state) => ({
    activeId: state.activeId,
    setActiveId: state.setActiveId,
  }));

  return (
    <div>
      {terminals.map((terminal) => (
        <div
          key={terminal.id}
          onClick={() => setActiveId(terminal.id)}
          className={activeId === terminal.id ? 'active' : ''}
        >
          {terminal.label}
        </div>
      ))}
    </div>
  );
}
```

### 2. Using Helper Hooks for Better Performance

```typescript
import { useStore, useStoreValue, useStoreActions } from '../stores/useStore';
import { useTerminalStore } from '../stores';

function TerminalView() {
  // Use shallow comparison for object selectors
  const { terminals, activeId } = useStore(useTerminalStore, (state) => ({
    terminals: state.terminals,
    activeId: state.activeId,
  }));

  // Use direct subscription for primitive values
  const isActive = useStoreValue(useTerminalStore, (state) =>
    state.activeId === 'some-id'
  );

  // Get only actions (no re-renders when state changes)
  const { addTerminal, removeTerminal } = useStoreActions(useTerminalStore, (state) => ({
    addTerminal: state.addTerminal,
    removeTerminal: state.removeTerminal,
  }));

  return <div>...</div>;
}
```

### 3. Subscribing to Multiple Stores

```typescript
import { useMultiStore } from '../stores/useStore';
import { useTerminalStore, useUIStore, useGitStore } from '../stores';

function Dashboard() {
  const { terminals, showModal, gitSummary } = useMultiStore({
    terminals: [useTerminalStore, (s) => s.terminals],
    showModal: [useUIStore, (s) => s.showNewTerminalModal],
    gitSummary: [useGitStore, (s) => s.gitSummary],
  });

  return (
    <div>
      <div>Terminals: {terminals.length}</div>
      <div>Modal Open: {showModal ? 'Yes' : 'No'}</div>
      <div>Git Branch: {gitSummary?.branch || 'N/A'}</div>
    </div>
  );
}
```

## Performance Patterns

### 1. Granular Subscriptions

```typescript
// BAD - Re-renders when ANY terminal property changes
function BadTerminalItem({ id }: { id: string }) {
  const terminals = useTerminalStore((state) => state.terminals);
  const terminal = terminals.find((t) => t.id === id);
  return <div>{terminal?.label}</div>;
}

// GOOD - Re-renders only when this specific terminal changes
function GoodTerminalItem({ id }: { id: string }) {
  const terminal = useTerminalStore((state) =>
    state.terminals.find((t) => t.id === id)
  );
  return <div>{terminal?.label}</div>;
}

// BEST - Use a selector function
function BestTerminalItem({ id }: { id: string }) {
  const terminal = useTerminalStore((state) =>
    state.getTerminalById(id)
  );
  return <div>{terminal?.label}</div>;
}
```

### 2. Computed Values

```typescript
function GitStatus() {
  // Compute derived state in the selector
  const { hasChanges, canCommit } = useGitStore((state) => ({
    hasChanges: state.hasChanges(),
    canCommit: state.canCommit(),
  }));

  return (
    <div>
      {hasChanges && <span>You have uncommitted changes</span>}
      <button disabled={!canCommit}>Commit</button>
    </div>
  );
}
```

### 3. Avoiding Unnecessary Re-renders

```typescript
function TerminalActions() {
  // Actions are stable - component never re-renders
  const addTerminal = useTerminalStore((state) => state.addTerminal);
  const removeTerminal = useTerminalStore((state) => state.removeTerminal);

  return (
    <div>
      <button onClick={() => addTerminal({ /* ... */ })}>Add</button>
      <button onClick={() => removeTerminal('id')}>Remove</button>
    </div>
  );
}
```

## Migration from Context API

### Before (Context API)

```typescript
import { useTerminalContext } from '../contexts/TerminalContext';

function OldComponent() {
  const { terminals, activeTerminalId, setActiveTerminalId } = useTerminalContext();

  return (
    <div>
      {terminals.map((t) => (
        <div key={t.id} onClick={() => setActiveTerminalId(t.id)}>
          {t.label}
        </div>
      ))}
    </div>
  );
}
```

### After (Zustand)

```typescript
import { useTerminalStore } from '../stores';

function NewComponent() {
  const terminals = useTerminalStore((state) => state.terminals);
  const activeId = useTerminalStore((state) => state.activeId);
  const setActiveId = useTerminalStore((state) => state.setActiveId);

  return (
    <div>
      {terminals.map((t) => (
        <div key={t.id} onClick={() => setActiveId(t.id)}>
          {t.label}
        </div>
      ))}
    </div>
  );
}
```

## Advanced Patterns

### 1. Transient Updates (No History in DevTools)

```typescript
const useTerminalStore = create()(
  devtools(
    (set) => ({
      // ... other state

      // Transient update - won't appear in DevTools
      updateTemporary: (data) => set(
        { tempData: data },
        false, // Don't record in DevTools
        'updateTemporary' // Action name
      ),
    })
  )
);
```

### 2. Store Composition

```typescript
// Combine multiple stores into one
function useAppState() {
  const terminals = useTerminalStore((s) => s.terminals);
  const activeTabId = useUIStore((s) => s.activeTabId);
  const gitSummary = useGitStore((s) => s.gitSummary);

  return {
    terminals,
    activeTabId,
    gitSummary,
    // Computed values
    hasActiveTerminal: terminals.some((t) => t.id === activeTabId),
    isDirty: gitSummary?.hasChanges || false,
  };
}
```

### 3. Store Listeners (Outside React)

```typescript
// Subscribe to store changes outside of React components
const unsubscribe = useTerminalStore.subscribe(
  (state) => state.terminals,
  (terminals) => {
    console.log('Terminals changed:', terminals);
  }
);

// Clean up
unsubscribe();
```

### 4. Async Actions

```typescript
const useGitStore = create()((set, get) => ({
  // ... other state

  fetchGitStatus: async () => {
    set({ loadingGit: true });
    try {
      const status = await invoke('git_status');
      set({
        gitSummary: status,
        loadingGit: false,
        gitError: null,
      });
    } catch (error) {
      set({
        loadingGit: false,
        gitError: error.message,
      });
    }
  },
}));
```

## Testing Stores

```typescript
import { renderHook, act } from '@testing-library/react';
import { useTerminalStore } from '../stores';

describe('Terminal Store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useTerminalStore.setState({
      terminals: [],
      activeId: null,
    });
  });

  test('adds terminal', () => {
    const { result } = renderHook(() => useTerminalStore());

    act(() => {
      result.current.addTerminal({
        id: '1',
        label: 'Terminal 1',
        // ...
      });
    });

    expect(result.current.terminals).toHaveLength(1);
    expect(result.current.terminals[0].label).toBe('Terminal 1');
  });
});
```

## DevTools Integration

Zustand integrates with Redux DevTools automatically:

1. Install Redux DevTools Extension
2. Open DevTools in browser
3. Navigate to Redux tab
4. You'll see all Zustand stores and their state changes

Features:
- Time-travel debugging
- State inspection
- Action replay
- State export/import
- Diff view

## Best Practices

1. **Keep stores focused** - One store per domain (terminals, UI, git, etc.)
2. **Use selectors** - Compute derived state in selectors, not components
3. **Granular subscriptions** - Subscribe only to the data you need
4. **Actions are stable** - They never change, safe to pass as deps
5. **Avoid spreading state** - `const state = useStore()` causes unnecessary re-renders
6. **Use shallow comparison** - For object selectors to prevent re-renders
7. **Persist wisely** - Only persist necessary data, not runtime state
8. **Test stores** - Stores are easy to test in isolation