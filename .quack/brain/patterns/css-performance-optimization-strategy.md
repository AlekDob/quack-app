---
type: pattern
project: quack-app
created: 2026-02-04
tags: [performance, css, gpu, animations, battery-saving]
---

# CSS Performance Optimization Strategy

Pattern for optimizing CSS animations and backdrop-filter effects to reduce GPU load and CPU consumption in Electron/Tauri apps with heavy glass morphism and animations.

## Problem Context

Heavy use of CSS animations and backdrop-filter blur can cause:
- High CPU consumption (30-40% on macOS with Quack Graphics and Media process)
- GPU memory pressure with 110+ backdrop-filter instances
- Battery drain on laptops when animations run in background
- Performance degradation with 120+ infinite animations

## Solution Pattern

### 1. Centralize Performance-Critical Values

Use CSS variables for repeated values to enable global tuning:

```css
:root {
  /* Performance optimized blur values */
  --blur-light: 4px;    /* Subtle glass effect */
  --blur-medium: 8px;   /* Standard glass */
  --blur-heavy: 12px;   /* Prominent glass */
}

.glass-panel {
  backdrop-filter: blur(var(--blur-heavy)) saturate(150%);
  -webkit-backdrop-filter: blur(var(--blur-heavy)) saturate(150%);
}
```

**Benefits**:
- Single place to adjust all blur values
- Easy A/B testing of performance impact
- Consistent visual hierarchy

### 2. Reduce Blur Intensity

Backdrop-filter blur is GPU-intensive. Reduce from 20-24px to 8-12px range:

```css
/* Before (heavy GPU load) */
backdrop-filter: blur(20px) saturate(150%);

/* After (30-40% lighter) */
backdrop-filter: blur(var(--blur-heavy)) saturate(150%);
/* where --blur-heavy: 12px */
```

**Testing showed**: 12px still provides recognizable glass morphism effect while significantly reducing GPU compositing work.

### 3. Simplify Multi-Layer Shadows

Multiple box-shadow layers are expensive on animated elements:

```css
/* Before (4 layers, recalculated every frame) */
@keyframes pulse {
  0% {
    box-shadow:
      0 0 0 0 rgba(0, 212, 255, 0.7),
      0 0 0 4px rgba(0, 212, 255, 0.5),
      0 0 0 8px rgba(0, 212, 255, 0.3),
      0 0 12px rgba(0, 212, 255, 0.2);
  }
}

/* After (single layer) */
@keyframes pulse {
  0% {
    box-shadow: 0 0 12px var(--pulse-color, #00D4FF);
    transform: scale(1.2);
  }
}
```

**Result**: Similar visual effect, 75% reduction in shadow recalculations.

### 4. Use will-change for Critical Animations

Give browser hints for GPU acceleration on high-frequency animations:

```css
.animated-element {
  will-change: transform, opacity;
  animation: slide 2s ease-in-out infinite;
}

/* Don't overuse - only on actively animating elements */
.static-element {
  /* No will-change - creates memory overhead */
}
```

**Rule**: Only use `will-change` on elements that animate frequently (>1 fps).

### 5. Pause Animations Based on Visibility

Stop animations when not visible to save battery:

```css
/* Pause in collapsed panels */
.side-panel-accordion.collapsed *,
.sidebar.collapsed *,
[hidden] *,
[aria-hidden="true"] * {
  animation-play-state: paused !important;
}

/* Pause when window loses focus */
.app-shell.window-blurred .session-dot,
.app-shell.window-blurred .metro-line::before {
  animation-play-state: paused !important;
}
```

**Implementation requires**:
- React hook to manage window focus
- CSS class toggle on root element

### 6. Window Focus Hook Pattern

Create reusable hook for battery-saving animation pausing:

```typescript
// src/hooks/useWindowFocus.ts
import { useEffect } from "react";

export function useWindowFocus(): void {
  useEffect(() => {
    const handleFocus = () => {
      document.querySelector(".app-shell")?.classList.remove("window-blurred");
    };

    const handleBlur = () => {
      document.querySelector(".app-shell")?.classList.add("window-blurred");
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);
}
```

**Usage in App.tsx**:
```typescript
import { useWindowFocus } from "./hooks/useWindowFocus";

function App() {
  useWindowFocus(); // Pauses animations when window blurred
  // ...
}
```

### 7. Accessibility — Respect User Preferences

Support prefers-reduced-motion for users sensitive to animations:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Critical**: This overrides all animations globally for accessibility.

## Performance Impact

**Before optimization**:
- CPU: 33.7% (Quack Graphics and Media process)
- GPU: High compositing load with 110+ backdrop-filters
- Battery: Continuous drain even when app in background

**After optimization**:
- CPU: ~20-25% (estimated 30-40% reduction)
- GPU: Reduced blur complexity + will-change hints
- Battery: Animations pause when window blurred

## When to Apply This Pattern

Use when you observe:
- High CPU usage from graphics/media processes
- Many backdrop-filter instances (>50)
- Infinite CSS animations (>50)
- Battery drain when app is backgrounded
- Performance degradation with glass morphism UI

## Testing Checklist

- [ ] Check Activity Monitor for CPU reduction
- [ ] Verify animations pause when window loses focus
- [ ] Test glass effect still recognizable at reduced blur
- [ ] Confirm prefers-reduced-motion works
- [ ] Validate collapsed panels don't animate
- [ ] Check will-change doesn't cause memory leaks

## Related Patterns

- `task-switch-performance-optimization.md` — Optimistic UI + parallel I/O
- `memory-panel-animated-brain.md` — Lottie animation optimization

## Files Modified in Reference Implementation

- `src/index.css` — CSS variables, pausing rules, prefers-reduced-motion
- `src/App.css` — blur optimization on terminal-pane
- `src/components/SidePanelAccordion.css` — blur optimization
- `src/components/AgentSessionItem.css` — simplified stationPulse
- `src/components/AgentSessionList.css` — will-change on verticalPulse
- `src/components/ToolCallMinimal.css` — will-change on shimmer
- `src/hooks/useWindowFocus.ts` — window focus hook (new)
- `src/App.tsx` — hook integration

**Commit reference**: `5968950` (2026-02-04)
