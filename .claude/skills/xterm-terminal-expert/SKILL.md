---
name: xterm-terminal-expert
description: Expert guide for XTerm.js terminal integration in React applications. Use this skill when working with XTerm.js terminals, facing rendering issues, managing terminal instances in React, or implementing terminal tabs. Covers common pitfalls, DOM lifecycle management, canvas rendering problems, and best practices learned from production debugging.
---

# XTerm.js Terminal Expert

This skill provides expert knowledge for integrating and managing XTerm.js terminals in React applications, with a focus on solving common rendering and lifecycle issues.

## When to Use This Skill

Use this skill when:
- Implementing XTerm.js terminals in React components
- Encountering rendering issues (blank screens, duplicate content, sizing problems)
- Managing multiple terminal instances with tab switching
- Dealing with React component mount/unmount lifecycle with XTerm
- Implementing terminal persistence across component remounts
- Troubleshooting canvas rendering or buffer synchronization issues

## Core Principles

### 1. XTerm Instance Lifecycle

**Critical Rule**: XTerm instances should be created ONCE and never recreated. Once `xterm.open(container)` is called, the instance is permanently bound to a DOM element.

**Implementation Pattern**:
```typescript
// Store instances OUTSIDE React lifecycle
const terminalInstances = new Map<string, {
  xterm: XTerm;
  fitAddon: FitAddon;
  // ... other addons and listeners
}>();

// In component, use ref to prevent re-initialization
const initializedRef = useRef(false);

useEffect(() => {
  if (initializedRef.current) return;

  const instance = terminalInstances.get(terminalId);
  if (!instance) {
    // Create new instance ONLY if it doesn't exist
    createXtermInstance();
    initializedRef.current = true;
  } else {
    // Reuse existing instance (see DOM re-attachment section)
    reattachExistingInstance(instance);
    initializedRef.current = true;
  }
}, [terminalId]);
```

### 2. Visibility Management - The Critical Decision

**The Problem**: When using multiple terminals with tab switching, how to hide inactive terminals?

**❌ WRONG APPROACHES**:

1. **`display: none`** - Breaks XTerm completely
   - XTerm cannot calculate dimensions when `display: none`
   - Canvas becomes corrupted
   - `fitAddon.fit()` fails silently
   - Content disappears on return

2. **`visibility: hidden`** - Causes rendering artifacts
   - Creates duplicate content issues
   - Buffer synchronization problems
   - Strange rendering artifacts at bottom of terminal

3. **Mount/Unmount** - Completely breaks XTerm lifecycle
   - XTerm instances cannot be reattached after unmounting
   - Loses all terminal state and history
   - Requires complete recreation (expensive and loses data)

**✅ CORRECT APPROACH: `opacity: 0/1`**

```typescript
<div
  style={{
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: isActive ? 1 : 0,           // Hide visually
    pointerEvents: isActive ? 'auto' : 'none',  // Disable interactions
    zIndex: isActive ? 1 : -1,            // Layer management
  }}
>
  <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />
</div>
```

**Why `opacity` works**:
- Terminal remains fully rendered in DOM
- Dimensions stay valid for XTerm calculations
- Canvas remains intact
- No buffer corruption
- Instant switching without re-initialization
- No rendering artifacts

### 3. DOM Re-attachment After React Remount

**The Problem**: When a React component unmounts and remounts (e.g., switching between agents), the XTerm instance still exists in the global Map, but it's attached to the OLD DOM element that was removed.

**The Solution**: Re-attach the existing XTerm element to the new container.

```typescript
const instance = terminalInstances.get(terminalId);

if (instance && instance.xterm.element) {
  // Clear the new container
  terminalRef.current.innerHTML = '';

  // Move the existing XTerm element (with its canvas and buffer)
  terminalRef.current.appendChild(instance.xterm.element);

  // Fit to new container dimensions
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      instance.fitAddon.fit();
    });
  });
}
```

**Why this works**:
- `instance.xterm.element` contains the entire XTerm DOM structure (canvas, buffer, etc.)
- Moving it preserves all state and history
- No need to call `open()` again (which would fail)
- Double RAF ensures DOM is ready before fitting

### 4. Terminal Sizing and Fitting

**Critical Rules**:
1. Only call `fit()` when terminal is visible (`opacity: 1`)
2. Use `requestAnimationFrame` to ensure DOM is ready
3. Validate container has non-zero dimensions before fitting
4. Call `fit()` when terminal becomes active
5. Debounce window resize events

**Implementation**:
```typescript
// Fit when terminal becomes active
useEffect(() => {
  if (!isActive || !initializedRef.current) return;

  const timer = setTimeout(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const instance = terminalInstances.get(terminalId);
        if (instance && terminalRef.current) {
          const rect = terminalRef.current.getBoundingClientRect();

          // Validate dimensions
          if (rect.width > 0 && rect.height > 0) {
            instance.fitAddon.fit();
          }
        }
      });
    });
  }, 100); // Allow opacity transition to complete

  return () => clearTimeout(timer);
}, [isActive, terminalId]);
```

### 5. Container Flex Layout

**Critical for Width**: The terminal container MUST use `display: flex` to occupy available space.

```typescript
// Parent container wrapping all terminals
<div style={{
  display: 'flex',           // CRITICAL
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  position: 'relative',
  overflow: 'hidden',
}}>
  {/* All terminal components here */}
</div>
```

**Why**:
- `display: block` doesn't expand to fill flex parent
- Terminals end up with minimal width (causes character-per-line wrapping)
- `display: flex` with `flex: 1` properly fills available space

### 6. Initial Zsh Prompt Cleanup

**The Problem**: Zsh shows a `%` symbol at the start if there's no previous newline.

**The Solution**: Send a carriage return after terminal initialization.

```typescript
// After xterm.open() and initial fit
setTimeout(() => {
  xterm.write('\r');  // Carriage return clears the %
}, 50);
```

## Common Issues and Solutions

For detailed troubleshooting of specific issues, see:
- `references/rendering-issues.md` - Comprehensive guide to all rendering problems
- `references/react-integration.md` - React-specific patterns and pitfalls
- `references/sizing-and-fitting.md` - Detailed fitting and resize strategies

## Quick Reference Checklist

When implementing XTerm terminals in React:

- [ ] Store XTerm instances in global Map (outside React)
- [ ] Use `initializedRef` to prevent re-initialization
- [ ] Never use `display: none` or mount/unmount patterns
- [ ] Use `opacity: 0/1` for visibility toggling
- [ ] Set `position: absolute` on terminal wrappers
- [ ] Implement DOM re-attachment for existing instances
- [ ] Use double RAF before calling `fit()`
- [ ] Validate container dimensions before fitting
- [ ] Only fit when terminal is active
- [ ] Use `display: flex` on parent container
- [ ] Send `\r` to clear initial zsh `%` symbol
- [ ] Implement proper cleanup on terminal disposal

## Key Patterns

### Complete Terminal Component Structure

```typescript
const terminalInstances = new Map<string, TerminalInstance>();

function AgentTerminalTab({ terminalId, color, isActive }: Props) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  // Initialize ONCE
  useEffect(() => {
    if (!terminalRef.current || initializedRef.current) return;

    const instance = terminalInstances.get(terminalId);
    if (!instance) {
      createXtermInstance(terminalId, terminalRef.current, color);
    } else {
      // Re-attach existing instance
      terminalRef.current.innerHTML = '';
      terminalRef.current.appendChild(instance.xterm.element);
    }
    initializedRef.current = true;
  }, [terminalId, color]);

  // Fit when active
  useEffect(() => {
    if (!isActive || !initializedRef.current) return;

    const timer = setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const instance = terminalInstances.get(terminalId);
          if (instance && terminalRef.current) {
            const rect = terminalRef.current.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              instance.fitAddon.fit();
            }
          }
        });
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [isActive, terminalId]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: isActive ? 1 : 0,
        pointerEvents: isActive ? 'auto' : 'none',
        zIndex: isActive ? 1 : -1,
        background: '#1e1e1e',
      }}
    >
      <div
        ref={terminalRef}
        style={{
          width: '100%',
          height: '100%',
          background: '#1e1e1e',
          position: 'relative',
        }}
      />
    </div>
  );
}
```

### Rendering All Terminals

```typescript
// In parent component - render ALL terminals, toggle with opacity
<div style={{
  flex: 1,
  minHeight: 0,
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',           // CRITICAL
  flexDirection: 'column',
}}>
  {tabs
    .filter(t => t.type === 'agent-terminal' && t.terminalId)
    .map(tab => {
      const terminal = agentTerminals.find(t => t.id === tab.terminalId);
      if (!terminal) return null;

      return (
        <AgentTerminalTab
          key={terminal.id}
          terminalId={terminal.id}
          color={terminal.color}
          isActive={activeTabId === tab.id}
        />
      );
    })
  }
</div>
```

## Debugging Tips

1. **Add comprehensive logging**: Log every fit() call with dimensions
2. **Check container dimensions**: Always log `getBoundingClientRect()` before fitting
3. **Verify instance existence**: Log when finding/creating instances
4. **Watch opacity transitions**: Log when terminals become active/inactive
5. **Monitor DOM re-attachment**: Log when moving XTerm elements between containers

## Production Lessons

These patterns were learned through extensive debugging in production:
- Spent hours fighting `display: none` and `visibility: hidden` issues
- Discovered `opacity` solution after trying many alternatives
- Learned DOM re-attachment pattern to solve agent-switching bug
- Found flex layout requirement after debugging character-per-line wrapping
- Identified need for double RAF through timing experiments

The documented patterns represent battle-tested solutions to real-world problems.
