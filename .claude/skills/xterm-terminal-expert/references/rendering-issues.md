# XTerm.js Rendering Issues - Complete Troubleshooting Guide

This document catalogs all rendering issues encountered with XTerm.js and their solutions, based on real production debugging.

## Issue 1: Blank/Black Screen When Switching Tabs

### Symptoms
- Terminal shows content initially
- Switching to another terminal and back shows blank black screen
- No error in console
- Terminal is "alive" (can type, commands execute) but nothing visible

### Root Cause
Using `display: none` to hide inactive terminals. When `display: none`:
- XTerm canvas becomes detached
- Dimensions become invalid (0x0)
- `fitAddon.fit()` fails silently
- Canvas never redraws

### Failed Solutions Tried
1. **Calling `fit()` on tab switch** - Doesn't help, canvas already corrupted
2. **Calling `refresh()`** - Canvas is dead, refresh does nothing
3. **Using `visibility: hidden`** - Creates different problems (see Issue 2)
4. **Detach/reattach DOM element** - XTerm doesn't support this pattern

### Working Solution
Use `opacity: 0/1` instead of `display: none`:

```typescript
<div style={{
  opacity: isActive ? 1 : 0,           // Visual hiding
  pointerEvents: isActive ? 'auto' : 'none',  // Disable interactions
  zIndex: isActive ? 1 : -1,            // Prevent click capture
}}>
```

**Why it works**:
- Terminal remains in layout flow
- Canvas stays valid
- Dimensions remain correct
- Instant show/hide with no reinitialization

## Issue 2: Duplicate Content at Bottom of Terminal

### Symptoms
- Terminal shows normal content
- At bottom, see duplicate of last few lines
- Sometimes shows old prompt repeated
- Content appears "doubled" or "echoed"

### Root Cause
Using `visibility: hidden` with `refresh()` calls. The combination causes:
- Buffer writes happening twice
- Viewport refresh triggering duplicate renders
- Canvas painting same content multiple times

### Failed Solutions Tried
1. **Remove `refresh()` calls** - Reduced but didn't eliminate duplicates
2. **Throttle fit operations** - Didn't address root cause
3. **Change timing of refresh** - Symptoms just moved around

### Working Solution
Switch from `visibility: hidden/visible` to `opacity: 0/1`:

```typescript
// WRONG - causes duplicates
style={{ visibility: isActive ? 'visible' : 'hidden' }}

// CORRECT - no duplicates
style={{ opacity: isActive ? 1 : 0 }}
```

Remove any manual `refresh()` calls:
```typescript
// DON'T DO THIS with opacity
instance.xterm.refresh(0, instance.xterm.rows - 1);

// opacity handles visibility without needing refresh
```

## Issue 3: Character-Per-Line Wrapping (Terminal Too Narrow)

### Symptoms
- Typing one character creates a new line
- Terminal appears extremely narrow (few columns)
- Running commands shows bizarre vertical output
- Console logs show terminal has only ~10 columns

### Root Cause
Container using `display: block` doesn't expand to fill flex parent properly.

### Visual Example
```
$ c  ← typed 'c'
l    ← typed 'l'
a    ← typed 'a'
u    ← typed 'u'
d    ← typed 'd'
e    ← typed 'e'
```

Each character wraps because terminal thinks it only has 1-2 columns.

### Working Solution
Use `display: flex` on parent container:

```typescript
// Parent container wrapping all terminals
<div style={{
  display: 'flex',           // CRITICAL - not 'block'!
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  position: 'relative',
  overflow: 'hidden',
}}>
  {/* Terminal components */}
</div>
```

**Why it works**:
- `display: flex` with `flex: 1` properly expands to available space
- Terminal container gets full width
- `fitAddon.fit()` calculates correct column count (80-120 instead of 10)

## Issue 4: Blank Screen After Agent Switch

### Symptoms
- Create terminal in Agent A
- Switch to Agent B (terminal disappears - expected)
- Switch back to Agent A
- Terminal tab appears but shows blank screen
- Console shows `fit()` being called with correct dimensions
- Other agents' terminals work fine

### Root Cause
React component remounts when switching agents, creating NEW DOM element. Old XTerm instance still exists in global Map but is attached to OLD (removed) DOM element.

**Timeline**:
1. Agent A mounted → XTerm attached to `<div id="old-element">`
2. Switch to Agent B → React unmounts Agent A component, removes `<div id="old-element">`
3. Switch back to Agent A → React mounts new component with `<div id="new-element">`
4. XTerm still references `<div id="old-element">` (doesn't exist!)
5. Canvas renders to non-existent element = blank screen

### Failed Solutions Tried
1. **Call `fit()` on mount** - Fits to new element but XTerm still attached to old
2. **Call `refresh()`** - XTerm refreshes old element, not new one
3. **Force resize cycle** - Same issue, wrong element
4. **Delay with RAF** - Timing doesn't matter, element is wrong

### Working Solution
Re-attach the existing XTerm element to the new container:

```typescript
const instance = terminalInstances.get(terminalId);

if (instance) {
  console.log('Terminal exists, re-attaching to new DOM element');

  if (terminalRef.current && instance.xterm.element) {
    // Clear new container
    terminalRef.current.innerHTML = '';

    // CRITICAL: Move XTerm's DOM element to new container
    terminalRef.current.appendChild(instance.xterm.element);

    console.log('XTerm element re-attached');

    // Fit to new container dimensions
    if (isActive) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          instance.fitAddon.fit();
          console.log('Re-attached terminal fitted');
        });
      });
    }
  }
}
```

**Why it works**:
- `instance.xterm.element` contains entire XTerm structure (canvas, scrollbar, etc.)
- Moving it with `appendChild()` preserves all state
- Terminal now renders in correct container
- `fit()` works because terminal is in correct place

**Key insight**: XTerm's canvas and buffer are stored in `instance.xterm.element`. Moving this element is safe and preserves everything.

## Issue 5: Initial Zsh `%` Symbol

### Symptoms
- New terminal shows `%` at start
- Symbol appears before any prompt
- Doesn't affect functionality but looks unprofessional

### Root Cause
Zsh shows `%` when there's no newline before the prompt (marks incomplete line).

### Working Solution
Write carriage return after terminal creation:

```typescript
// After xterm.open() and initial fit
setTimeout(() => {
  xterm.write('\r');
}, 50);
```

**Why it works**:
- `\r` (carriage return) moves cursor to start of line
- Overwrites the `%` symbol
- Terminal appears clean from start

## Issue 6: All Terminals Show Same Content

### Symptoms
- Create 3 terminals
- Each shows identical content
- Typing in one affects all others
- They're not independent

### Root Cause
Mount/unmount pattern causing XTerm instance confusion. When component unmounts:
1. XTerm instance removed from DOM
2. On remount, trying to reuse same instance
3. All terminals end up sharing one instance

### Working Solution
1. **Never unmount terminal components** - render all with opacity toggle
2. **Use unique keys** - `key={terminal.id}` ensures React tracks correctly
3. **Initialize only once** - use `initializedRef` to prevent re-creation

```typescript
// Render ALL terminals
{tabs
  .filter(t => t.type === 'agent-terminal')
  .map(tab => (
    <AgentTerminalTab
      key={tab.terminalId}  // Unique key!
      terminalId={tab.terminalId}
      isActive={activeTabId === tab.id}
    />
  ))
}
```

## Prevention Checklist

Before implementing XTerm terminals:
- [ ] Plan to use `opacity` for visibility (not `display` or `visibility`)
- [ ] Store instances in global Map outside React
- [ ] Never mount/unmount terminal components
- [ ] Use `position: absolute` for overlapping terminals
- [ ] Plan parent container with `display: flex`
- [ ] Implement DOM re-attachment logic
- [ ] Add comprehensive logging for debugging

## Debugging Workflow

When encountering rendering issues:

1. **Check visibility method**
   - Open DevTools → Elements
   - Find terminal container
   - Is it using `opacity`, `visibility`, or `display`?
   - If `display: none` → That's the problem!

2. **Check dimensions**
   - Log `getBoundingClientRect()` before `fit()`
   - Are width/height > 0?
   - Log terminal cols/rows after `fit()`
   - Do they match expected values?

3. **Check DOM attachment**
   - Log `instance.xterm.element.parentElement`
   - Is it the current container ref?
   - If null or wrong parent → Re-attachment needed

4. **Check render count**
   - Add log in component render
   - Are terminals rendering multiple times?
   - Are they all unique instances?

5. **Check React keys**
   - Ensure each terminal has unique key
   - Keys based on stable IDs (not index)

## Summary: Golden Rules

1. **Never use `display: none`** - Always use `opacity: 0`
2. **Never unmount terminals** - Keep them rendered, toggle opacity
3. **Always re-attach after remount** - Move `xterm.element` to new container
4. **Use `display: flex` on parent** - Ensures proper width calculation
5. **Fit only when visible** - Check `isActive` before calling `fit()`
6. **Double RAF before fit** - Ensures DOM is ready
7. **Log everything** - Comprehensive logging saves hours
