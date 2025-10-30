# React Integration Patterns for XTerm.js

This document covers React-specific patterns and best practices for XTerm.js integration.

## Core Challenge

XTerm.js was designed for vanilla JavaScript, not React. The fundamental mismatch:

- **React**: Declarative, expects to mount/unmount components freely
- **XTerm**: Imperative, instances are stateful and cannot be recreated

This creates tension that must be carefully managed.

## Pattern 1: Global Instance Storage

**Problem**: React components remount frequently. If XTerm instances are created in component state or refs, they get lost or recreated.

**Solution**: Store instances outside React lifecycle in a global Map.

```typescript
// OUTSIDE component - survives all remounts
const terminalInstances = new Map<string, {
  xterm: XTerm;
  fitAddon: FitAddon;
  unlisten: () => void;
  unlistenExit: () => void;
}>();

function TerminalComponent({ terminalId }: Props) {
  // Component can mount/unmount freely
  // Instance in Map persists
  const instance = terminalInstances.get(terminalId);
}
```

**Why it works**:
- Map lives for entire app lifetime
- Survives all component unmounts
- Multiple components can reference same instance
- Enables true instance reuse

## Pattern 2: Initialization Guard

**Problem**: React StrictMode calls effects twice. Component may remount. Need to ensure XTerm initialized exactly once.

**Solution**: Use `useRef` as initialization flag.

```typescript
function TerminalComponent({ terminalId, color }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);  // Guard flag

  useEffect(() => {
    // Guard: Skip if already initialized
    if (!terminalRef.current || initializedRef.current) {
      return;
    }

    const instance = terminalInstances.get(terminalId);

    if (!instance) {
      // First time - create new instance
      createXtermInstance(terminalId, terminalRef.current, color);
      initializedRef.current = true;
    } else {
      // Already exists - reuse it
      reattachInstance(instance, terminalRef.current);
      initializedRef.current = true;
    }
  }, [terminalId, color]);
}
```

**Critical**: Don't add `isActive` as dependency to initialization effect unless you want re-initialization (usually don't).

## Pattern 3: DOM Re-attachment After Remount

**Problem**: Component remounts create new DOM elements. Old XTerm instance is attached to old (removed) element.

**Solution**: Move the XTerm element to the new container.

```typescript
function reattachInstance(
  instance: TerminalInstance,
  newContainer: HTMLDivElement
) {
  if (instance.xterm.element) {
    // Clear new container
    newContainer.innerHTML = '';

    // Move existing XTerm element
    newContainer.appendChild(instance.xterm.element);

    console.log('XTerm re-attached to new container');
  }
}
```

**When to use**: In initialization effect when finding existing instance in global Map.

## Pattern 4: Multiple Terminals with Opacity Toggle

**Problem**: How to render multiple terminals that can be switched between?

**Wrong approach**:
```typescript
// BAD - mounts/unmounts constantly
{activeTerminalId === terminal.id && (
  <TerminalComponent terminalId={terminal.id} />
)}
```

**Correct approach**:
```typescript
// GOOD - all rendered, toggle visibility
{terminals.map(terminal => (
  <TerminalComponent
    key={terminal.id}
    terminalId={terminal.id}
    isActive={activeTerminalId === terminal.id}
  />
))}

// In TerminalComponent:
<div style={{
  opacity: isActive ? 1 : 0,
  pointerEvents: isActive ? 'auto' : 'none',
  position: 'absolute',  // All terminals in same space
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
}}>
```

**Why it works**:
- All terminals stay mounted
- No DOM thrashing
- Instant switching
- Instances never recreated

## Pattern 5: Fitting on Activation

**Problem**: Need to resize terminal when it becomes active (opacity changes 0→1).

**Solution**: useEffect watching `isActive`, with proper timing.

```typescript
useEffect(() => {
  // Only fit when active
  if (!isActive || !initializedRef.current) {
    return;
  }

  // Wait for opacity transition to complete
  const timer = setTimeout(() => {
    // Double RAF ensures layout is stable
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const instance = terminalInstances.get(terminalId);
        if (instance && terminalRef.current) {
          const rect = terminalRef.current.getBoundingClientRect();

          // Validate dimensions
          if (rect.width > 0 && rect.height > 0) {
            try {
              instance.fitAddon.fit();

              const { cols, rows } = instance.xterm;
              console.log(`Terminal fitted: ${cols}x${rows}`);
            } catch (error) {
              console.error('Fit failed:', error);
            }
          }
        }
      });
    });
  }, 100); // Allow CSS transition

  return () => clearTimeout(timer);
}, [isActive, terminalId]);
```

**Key points**:
- Check `isActive` first - don't fit hidden terminals
- Wait 100ms for opacity transition
- Double RAF for layout stability
- Validate dimensions before fitting
- Log success/failure for debugging

## Pattern 6: Window Resize Handling

**Problem**: When window resizes, active terminal needs to refit.

**Solution**: Listen to resize only for active terminal, with debouncing.

```typescript
useEffect(() => {
  // Only active terminal listens
  if (!isActive) {
    return;
  }

  let resizeTimeout: number;

  const handleResize = () => {
    // Debounce: wait for resize to finish
    clearTimeout(resizeTimeout);

    resizeTimeout = window.setTimeout(() => {
      const instance = terminalInstances.get(terminalId);
      if (instance && terminalRef.current) {
        const rect = terminalRef.current.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0) {
          requestAnimationFrame(() => {
            try {
              instance.fitAddon.fit();
              console.log(`Refitted on resize: ${instance.xterm.cols}x${instance.xterm.rows}`);
            } catch (error) {
              console.error('Resize fit failed:', error);
            }
          });
        }
      }
    }, 200); // 200ms debounce
  };

  window.addEventListener('resize', handleResize);

  return () => {
    window.removeEventListener('resize', handleResize);
    clearTimeout(resizeTimeout);
  };
}, [isActive, terminalId]);
```

**Why separate effect**:
- Independent concern from initialization
- Different dependencies (`isActive`)
- Only active terminal needs to listen
- Prevents memory leaks

## Pattern 7: Cleanup on Unmount/Close

**Problem**: When terminal is permanently closed, need full cleanup.

**Solution**: Export disposal function, call from parent.

```typescript
// In TerminalComponent file
export function disposeTerminal(terminalId: string) {
  const instance = terminalInstances.get(terminalId);

  if (instance) {
    console.log(`Disposing terminal: ${terminalId}`);

    // Cleanup event listeners
    instance.unlisten();
    instance.unlistenExit();

    // Dispose XTerm instance
    instance.xterm.dispose();

    // Remove from Map
    terminalInstances.delete(terminalId);

    // Close backend PTY
    invoke('close_terminal', { id: terminalId }).catch(console.error);
  }
}

// In parent component
const handleCloseTerminal = async (terminalId: string) => {
  const confirmed = await confirm('Close this terminal?');

  if (confirmed) {
    // Remove from React state
    setTerminals(prev => prev.filter(t => t.id !== terminalId));

    // Dispose XTerm instance
    disposeTerminal(terminalId);
  }
};
```

## Pattern 8: Tab Persistence Across Agent Switches

**Problem**: When switching agents, want to save/restore terminal tabs per agent.

**Solution**: useEffect tracking `activeAgentId` with Map storage.

```typescript
function App() {
  const [activeAgentId, setActiveAgentId] = useState<string>('agent-1');
  const [tabs, setTabs] = useState<Tab[]>([]);

  // Store tabs per agent
  const [tabsByAgent] = useState(() => new Map<string, Tab[]>());
  const previousAgentRef = useRef<string>();

  useEffect(() => {
    const previousId = previousAgentRef.current;

    // Save tabs for previous agent
    if (previousId && previousId !== activeAgentId) {
      console.log(`Saving tabs for agent: ${previousId}`, tabs);

      const agentTabs = tabs.filter(t => t.type !== 'chat');
      tabsByAgent.set(previousId, agentTabs);
    }

    // Restore tabs for new agent
    if (activeAgentId) {
      const restoredTabs = tabsByAgent.get(activeAgentId) || [];

      console.log(`Restoring tabs for agent: ${activeAgentId}`, restoredTabs);

      setTabs([
        { id: 'chat', label: 'Chat', type: 'chat', closable: false },
        ...restoredTabs
      ]);
    }

    previousAgentRef.current = activeAgentId;
  }, [activeAgentId]);

  return (
    // Render terminals with restored tabs
  );
}
```

**Key points**:
- Use Map to store tabs per agent
- Save on agent change (previous agent)
- Restore on agent change (new agent)
- Filter out chat tab (always present)
- Use ref to track previous agent

## Common Pitfalls

### Pitfall 1: Adding Too Many Dependencies

```typescript
// BAD - re-initializes on every isActive change
useEffect(() => {
  initializeTerminal();
}, [terminalId, color, isActive]);  // isActive causes re-init!

// GOOD - initialize once
useEffect(() => {
  if (initializedRef.current) return;
  initializeTerminal();
  initializedRef.current = true;
}, [terminalId, color]);  // Only on terminalId/color change
```

### Pitfall 2: Fitting Too Early

```typescript
// BAD - DOM might not be ready
const instance = createXterm();
instance.fitAddon.fit();  // Might fail!

// GOOD - wait for layout
const instance = createXterm();
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    instance.fitAddon.fit();  // DOM definitely ready
  });
});
```

### Pitfall 3: Fitting Hidden Terminals

```typescript
// BAD - fits all terminals on resize
terminals.forEach(terminal => {
  getTerminalInstance(terminal.id).fitAddon.fit();
});

// GOOD - only fit active terminal
if (isActive) {
  instance.fitAddon.fit();
}
```

### Pitfall 4: Not Validating Dimensions

```typescript
// BAD - fit() might fail silently
instance.fitAddon.fit();

// GOOD - check dimensions first
const rect = container.getBoundingClientRect();
if (rect.width > 0 && rect.height > 0) {
  instance.fitAddon.fit();
} else {
  console.warn('Container has zero dimensions, skipping fit');
}
```

## Testing Strategy

### Unit Tests
- Mock XTerm imports
- Test initialization logic
- Test cleanup logic
- Test dimension validation

### Integration Tests
- Test terminal creation
- Test switching between terminals
- Test agent switching with tab persistence
- Test window resize behavior

### Manual Testing Checklist
- [ ] Create multiple terminals
- [ ] Switch between terminals - content persists?
- [ ] Switch agents - terminals saved per agent?
- [ ] Resize window - active terminal adjusts?
- [ ] Close terminal - cleanup complete?
- [ ] Type in each terminal - independent?
- [ ] DevTools console - any errors?

## Performance Considerations

### Rendering All Terminals
- Using opacity keeps all terminals in DOM
- Each terminal has full XTerm instance in memory
- Trade-off: Memory vs. instant switching

**Optimization**: If many terminals (>10), consider:
- Virtual list for tab bar
- Only render visible + adjacent terminals
- Lazy load terminal instances

### Fitting Frequency
- Don't fit on every render
- Debounce resize events (200ms)
- Only fit active terminal
- Check dimensions before fitting

### Memory Management
- Dispose terminals when closed
- Clear event listeners
- Remove from global Map
- Close backend PTY

## Summary: React Integration Rules

1. **Store instances globally** - Outside React lifecycle
2. **Initialize once** - Use `initializedRef` guard
3. **Render all, toggle opacity** - No mount/unmount
4. **Re-attach after remount** - Move `xterm.element`
5. **Fit when active** - Check `isActive` first
6. **Debounce resize** - 200ms delay
7. **Cleanup properly** - Dispose instances and listeners
8. **Save/restore tabs** - Per-agent persistence
9. **Log extensively** - Essential for debugging
10. **Validate dimensions** - Before every fit()
