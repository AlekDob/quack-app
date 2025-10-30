# XTerm.js Sizing and Fitting Strategies

Complete guide to terminal sizing, the `fit()` addon, and solving dimension-related issues.

## Understanding XTerm Sizing

### Two Dimension Systems

XTerm operates with two independent dimension systems:

1. **Pixel Dimensions** (CSS)
   - Controlled by container element
   - Set via `width` and `height` CSS properties
   - Determines physical space on screen

2. **Character Dimensions** (Cols/Rows)
   - Controlled by XTerm
   - Determined by `cols` (columns) and `rows`
   - Represents how many characters fit

**Critical Rule**: These must stay synchronized! This is what `fitAddon.fit()` does.

### The `fit()` Function

```typescript
const fitAddon = new FitAddon();
xterm.loadAddon(fitAddon);

// Later:
fitAddon.fit();  // Synchronizes character dimensions to pixel dimensions
```

**What `fit()` does**:
1. Measures container pixel dimensions
2. Calculates how many characters fit (based on font size)
3. Calls `xterm.resize(cols, rows)` with calculated values
4. Backend PTY is notified of new dimensions

**When `fit()` fails silently**:
- Container has `display: none` (dimensions are 0x0)
- Container not in DOM yet
- Container has zero width or height
- XTerm instance disposed
- Called too quickly in succession

## Sizing Strategy 1: Initial Creation

When first creating a terminal, proper sizing sequence is critical.

### Correct Sequence

```typescript
async function createXtermInstance(
  terminalId: string,
  container: HTMLDivElement,
  color: string
) {
  // 1. Create XTerm instance
  const xterm = new XTerm({
    // No initial rows/cols - will be set by fit()
    cursorBlink: true,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, monospace',
    theme: { /* ... */ },
  });

  // 2. Create and load fit addon
  const fitAddon = new FitAddon();
  xterm.loadAddon(fitAddon);

  // 3. Open terminal (attaches to DOM)
  xterm.open(container);

  // 4. Wait for layout with RAF, then fit
  requestAnimationFrame(() => {
    const rect = container.getBoundingClientRect();
    console.log(`Initial container: ${rect.width}x${rect.height}`);

    if (rect.width > 0 && rect.height > 0) {
      try {
        fitAddon.fit();
        const { cols, rows } = xterm;
        console.log(`Initial fit: ${cols} cols x ${rows} rows`);
      } catch (error) {
        console.error('Initial fit failed:', error);
      }
    } else {
      console.warn('Container has zero dimensions, skipping initial fit');
    }
  });

  // 5. Handle subsequent data writes
  // ...
}
```

**Key points**:
- Don't set `rows`/`cols` in constructor - let `fit()` determine them
- Use RAF to ensure container has rendered
- Validate dimensions before fitting
- Log dimensions for debugging

## Sizing Strategy 2: Activation After Hidden

When terminal becomes visible after being hidden (opacity 0→1), must refit.

### Timing is Critical

```typescript
useEffect(() => {
  if (!isActive || !initializedRef.current) {
    return;
  }

  // Step 1: Wait for opacity transition (CSS)
  const timer = setTimeout(() => {
    // Step 2: First RAF - browser processes styles
    requestAnimationFrame(() => {
      // Step 3: Second RAF - layout is stable
      requestAnimationFrame(() => {
        const instance = terminalInstances.get(terminalId);
        if (instance && terminalRef.current) {
          const rect = terminalRef.current.getBoundingClientRect();

          if (rect.width > 0 && rect.height > 0) {
            try {
              instance.fitAddon.fit();

              const { cols, rows } = instance.xterm;
              console.log(`Activation fit: ${cols}x${rows}`);
            } catch (error) {
              console.error('Activation fit failed:', error);
            }
          }
        }
      });
    });
  }, 100); // Wait for opacity transition

  return () => clearTimeout(timer);
}, [isActive, terminalId]);
```

**Why this timing**:
1. **100ms timeout**: CSS transition for opacity takes time
2. **First RAF**: Browser processes new opacity value
3. **Second RAF**: Layout recalculated, dimensions finalized
4. **Then fit**: Now safe to read dimensions and fit

**If you skip timing**:
- Might read old dimensions (from before transition)
- `fit()` calculates wrong cols/rows
- Terminal appears misaligned

## Sizing Strategy 3: Window Resize

When window resizes, active terminal must resize too.

### Debounced Resize Listener

```typescript
useEffect(() => {
  // Only active terminal listens
  if (!isActive) {
    return;
  }

  let resizeTimeout: number;

  const handleResize = () => {
    // Clear previous timeout
    clearTimeout(resizeTimeout);

    // Debounce: wait for resize to finish
    resizeTimeout = window.setTimeout(() => {
      const instance = terminalInstances.get(terminalId);

      if (instance && terminalRef.current) {
        const rect = terminalRef.current.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0) {
          requestAnimationFrame(() => {
            try {
              instance.fitAddon.fit();

              const { cols, rows } = instance.xterm;
              console.log(`Resize fit: ${cols}x${rows}`);
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

**Debouncing benefits**:
- Resize fires many events per second
- Debouncing waits for user to finish resizing
- Reduces fit() calls from 100+ to 1
- Prevents performance issues

**Why only active terminal**:
- Hidden terminals don't need to resize
- Reduces event listeners (only 1 active at time)
- Will refit when activated anyway

## Sizing Strategy 4: Container Layout

Container CSS is critical for correct sizing.

### Parent Container

```typescript
<div style={{
  display: 'flex',         // CRITICAL - enables proper expansion
  flexDirection: 'column',
  flex: 1,                  // Takes available space
  minHeight: 0,             // Allows shrinking below content
  position: 'relative',     // For absolute children
  overflow: 'hidden',       // Prevents scrollbars
}}>
  {/* Terminal components */}
</div>
```

**Why these styles**:
- `display: flex`: Enables `flex: 1` to work on children
- `flexDirection: column`: Stacks terminals vertically
- `flex: 1`: Expands to fill parent
- `minHeight: 0`: Allows flexbox shrinking
- `position: relative`: Anchor for absolute terminals
- `overflow: hidden`: Clean edges, no scrollbars

**Common mistake**: Using `display: block` causes terminals to not expand properly.

### Terminal Wrapper

```typescript
<div style={{
  position: 'absolute',     // Overlaps with other terminals
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  opacity: isActive ? 1 : 0,
  pointerEvents: isActive ? 'auto' : 'none',
  zIndex: isActive ? 1 : -1,
  background: '#1e1e1e',
}}>
  <div
    ref={terminalRef}
    style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      background: '#1e1e1e',
    }}
  />
</div>
```

**Why these styles**:
- `position: absolute`: All terminals in same space
- `top/left/right/bottom: 0`: Fills parent
- `opacity`: Controls visibility
- `pointerEvents`: Disables hidden terminals
- `zIndex`: Layers active terminal on top

### XTerm Container

```typescript
<div
  ref={terminalRef}
  style={{
    width: '100%',       // Fill wrapper
    height: '100%',      // Fill wrapper
    position: 'relative', // For XTerm's internal positioning
    background: '#1e1e1e',
  }}
/>
```

**Why these styles**:
- `width/height: 100%`: Use all available space
- `position: relative`: Required for XTerm
- `background`: Matches XTerm theme

## Dimension Validation

Always validate before fitting.

### Validation Pattern

```typescript
function safeFit(
  instance: TerminalInstance,
  container: HTMLDivElement
): boolean {
  // 1. Check instance exists
  if (!instance || !instance.fitAddon) {
    console.warn('No instance or fitAddon');
    return false;
  }

  // 2. Check container in DOM
  if (!container || !container.isConnected) {
    console.warn('Container not in DOM');
    return false;
  }

  // 3. Check dimensions
  const rect = container.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    console.warn(`Zero dimensions: ${rect.width}x${rect.height}`);
    return false;
  }

  // 4. Check visibility
  const computed = getComputedStyle(container);
  if (computed.display === 'none') {
    console.warn('Container has display: none');
    return false;
  }

  // 5. Actually fit
  try {
    instance.fitAddon.fit();
    const { cols, rows } = instance.xterm;
    console.log(`Fit successful: ${cols}x${rows}`);
    return true;
  } catch (error) {
    console.error('Fit failed:', error);
    return false;
  }
}
```

### Common Validation Failures

**Zero dimensions**:
```typescript
rect.width === 0 || rect.height === 0
// Causes: display:none, not rendered yet, no space allocated
```

**Display none**:
```typescript
getComputedStyle(container).display === 'none'
// Causes: Intentionally hidden, parent hidden, conditional rendering
```

**Not in DOM**:
```typescript
!container.isConnected
// Causes: Component unmounted, element detached, React removing
```

## Sizing Troubleshooting

### Issue: Terminal Too Narrow (Few Columns)

**Symptoms**: Every character wraps to new line

**Check**:
```typescript
console.log('Container:', container.getBoundingClientRect());
console.log('Terminal:', xterm.cols, 'x', xterm.rows);
```

**Common causes**:
1. Parent using `display: block` instead of `flex`
2. Container has `max-width` or `width: auto`
3. Flex properties not set correctly

**Fix**: Ensure parent has `display: flex` and container has `width: 100%`.

### Issue: Terminal Too Tall (Many Rows)

**Symptoms**: Lots of empty space at bottom

**Check**:
```typescript
console.log('Container height:', container.clientHeight);
console.log('Terminal rows:', xterm.rows);
```

**Common causes**:
1. Container taller than needed
2. Font size too small
3. Line height incorrect

**Fix**: Let `fit()` determine rows based on actual height.

### Issue: fit() Does Nothing

**Symptoms**: Dimensions never change after `fit()`

**Check**:
```typescript
const before = { cols: xterm.cols, rows: xterm.rows };
fitAddon.fit();
const after = { cols: xterm.cols, rows: xterm.rows };
console.log('Before:', before, 'After:', after);
```

**Common causes**:
1. Container has zero dimensions
2. Called too early (DOM not ready)
3. Container has `display: none`
4. Font not loaded yet

**Fix**: Use RAF, validate dimensions, ensure visibility.

### Issue: fit() Throws Error

**Symptoms**: Exception when calling `fit()`

**Error types**:
- `Cannot read property 'dimensions' of undefined` → XTerm not initialized
- `Container dimensions are invalid` → Zero or negative dimensions
- `fitAddon.fit is not a function` → FitAddon not loaded

**Fix**: Add try/catch, validate state, ensure addons loaded.

## Advanced: Manual Resize

Sometimes need to manually set dimensions instead of fitting.

### When to Use Manual Resize

- Specific cols/rows required (e.g., matching recording)
- Container doesn't exist yet
- Need to set dimensions before attaching to DOM

### Manual Resize Pattern

```typescript
// Set specific dimensions
xterm.resize(80, 24);  // Standard 80x24

// Or calculate from pixels
const charWidth = 9;   // Approximate, depends on font
const charHeight = 17;

const cols = Math.floor(pixelWidth / charWidth);
const rows = Math.floor(pixelHeight / charHeight);

xterm.resize(cols, rows);
```

**Caution**: Manual resize disconnects from container size. Use `fit()` when possible.

## Logging Strategy

Comprehensive logging is essential for debugging sizing issues.

### What to Log

```typescript
// On fit
console.log(`🦆 [Term] Fitting: ${terminalId}`);
console.log(`  Container: ${rect.width}x${rect.height}px`);
console.log(`  Terminal: ${cols}x${rows} chars`);
console.log(`  Font: ${fontSize}px`);

// On failure
console.warn(`⚠️ [Term] Fit skipped: ${terminalId}`);
console.warn(`  Reason: ${reason}`);
console.warn(`  Container: ${rect.width}x${rect.height}px`);
console.warn(`  Display: ${computed.display}`);
console.warn(`  Opacity: ${computed.opacity}`);

// On resize
console.log(`🦆 [Term] Window resized`);
console.log(`  Old: ${oldCols}x${oldRows}`);
console.log(`  New: ${newCols}x${newRows}`);
```

### Debugging with DevTools

1. **Elements panel**: Inspect container dimensions
2. **Console**: Check logged dimensions
3. **Sources**: Set breakpoints before `fit()`
4. **Performance**: Record resize performance

## Summary: Sizing Rules

1. **Never set initial rows/cols** - Let `fit()` calculate
2. **Use RAF before first fit** - Ensure DOM ready
3. **Validate dimensions** - Check > 0 before fitting
4. **Fit when active** - Don't fit hidden terminals
5. **Debounce resize** - 200ms delay minimum
6. **Use flex layout** - `display: flex` on parent
7. **Double RAF on activation** - Wait for opacity transition
8. **Log everything** - Dimensions, success, failures
9. **Handle errors** - Try/catch around `fit()`
10. **Only fit once** - Don't call repeatedly

## Quick Reference: fit() Timing

| Scenario | Timing | Pattern |
|----------|--------|---------|
| Initial creation | 1x RAF after `open()` | `requestAnimationFrame(() => fit())` |
| Activation (0→1 opacity) | 100ms + 2x RAF | `setTimeout(() => RAF(() => RAF(() => fit())), 100)` |
| Window resize | 200ms debounce + 1x RAF | `setTimeout(() => RAF(() => fit()), 200)` |
| Tab switch (same agent) | Immediate + 2x RAF | `RAF(() => RAF(() => fit()))` |
| Agent switch | 100ms + 2x RAF | Same as activation |

**General rule**: When in doubt, use double RAF with 100ms delay. It's safe for all scenarios.
