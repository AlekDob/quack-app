---
name: brand-guidelines
description: Quack's design system documenting the actual UI patterns, colors, typography, and component structures used throughout the application. Based on real implementation, not aspirational guidelines.
license: Complete terms in LICENSE.txt
---

# Quack Design System

## Overview

Quack follows a **minimal modern design philosophy** focused on professionalism and clarity:
- **Orange accent color** (#f28c52) as the brand signature
- **SVG icons preferred**, with selective emoji for specific UI contexts
- **Smooth animations** with cubic-bezier easing
- **Consistent drawer patterns** with backdrop blur
- **General Sans** typography for modern feel
- **Dark theme** optimized for long coding sessions

**Keywords**: design system, UI components, drawers, panels, orange accent, Quack branding, icons, professional

---

## Core Principles

### 1. **Minimal & Professional**

Quack is a professional development tool that prioritizes clarity and function over decoration.

**ICON USAGE POLICY**

SVG icons are the **primary choice** for most UI elements, but emoji are acceptable in specific contexts:

**Use SVG Icons For:**
- Navigation elements (arrows, chevrons, menu)
- Action buttons (edit, delete, copy, close)
- Status indicators in lists and tables
- Empty states (large decorative icons)
- Toolbar and header icons

**Emoji Allowed For:**
- Category badges and labels (e.g., `⭐ Featured`, `🤖 AI`, `📊 Analytics`)
- Quick action hints and tips (e.g., `💡 Tip:`, `⚠️ Warning:`)
- Status messages in modals (e.g., `✅ All Good`, `🔧 Recovery Mode`)
- Feature tags in setup wizards
- Tab icons for special views (e.g., `📖` for docs)

**Philosophy**: SVG icons provide precision and scalability for core UI elements. Emoji add warmth and quick recognition for labels, categories, and status messages where visual personality enhances UX.

### 2. **SVG Icon Style Guide**

For SVG icons, follow this minimal, consistent style:

**Size Standards**:
- Small icons: 16x16px (toolbar buttons, inline indicators)
- Medium icons: 20-24px (sidebar, headers)
- Large icons: 48-64px (empty states, modals)

**Style Requirements**:
```tsx
// ✅ CORRECT: Minimal stroke-based icon
<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
  <path d="M8 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
</svg>

// ✅ CORRECT: Using currentColor for theme adaptation
<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5">
  <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round"/>
</svg>
```

**Icon Guidelines**:
- Use **stroke-based** icons, not filled (except for special cases)
- Stroke width: **1.5-2px** for consistency
- Always use **`currentColor`** for easy theming
- Include **`strokeLinecap="round"`** and **`strokeLinejoin="round"`** for softer look
- Keep paths simple - avoid complex details
- Ensure icons are recognizable at small sizes

**Recommended Icon Libraries**:
- **Lucide React**: Minimal, consistent stroke-based icons
- **Heroicons**: Clean, professional SVG icons
- **Feather Icons**: Simple, beautiful open-source icons

**Icon Categories**:
- **Navigation**: arrows, chevrons, menu
- **Actions**: plus, minus, edit, trash, copy
- **Status**: check, x, alert, info
- **Content**: file, folder, terminal, code
- **Communication**: send, message, notification

---

## Color Palette

### Primary Brand Color

**Orange**: The signature Quack color

```css
/* Primary orange */
--accent-color: #f28c52;
--accent-rgb: 242, 140, 82;

/* Orange variations */
--accent-surface: rgba(242, 140, 82, 0.16);        /* 16% for subtle backgrounds */
--accent-surface-strong: rgba(242, 140, 82, 0.3);  /* 30% for hover states */
--accent-border: rgba(242, 140, 82, 0.38);         /* 38% for borders */
--accent-text: #ffecd9;                             /* Light orange for text */

/* Alternative orange tones */
#F4AF8E  /* Lighter peach tone (used in toasts) */
#ffb26f  /* Terminal color option */
#f2a57b  /* Terminal color option */
```

### Base Colors

```css
/* Backgrounds */
--background-primary: #0f1115;                    /* Main app background */
--background-surface: rgba(18, 20, 27, 0.97);    /* Drawer/panel background */
--background-elevated: rgba(20, 22, 28, 0.98);   /* Modal/dropdown background */
--splash-background: #191B44;                     /* Splash screen / loading */

/* Solid surface colors (for opaque backgrounds) */
--surface-solid: #1a1a1a;                        /* Solid dark surface */
--surface-dropdown: #252525;                      /* Dropdown menus */
--surface-deep: #0d0d0d;                         /* Deep black (code blocks) */

/* Text colors */
--text-primary: #e7ebf3;                         /* Main text */
--text-secondary: rgba(255, 255, 255, 0.7);      /* Secondary text */
--text-tertiary: rgba(255, 255, 255, 0.5);       /* Disabled/placeholder */

/* Borders */
--panel-border: rgba(128, 132, 150, 0.32);       /* Standard border */
--panel-border-strong: rgba(128, 132, 150, 0.45); /* Emphasized border */
--border-subtle: rgba(255, 255, 255, 0.08);      /* Very subtle borders */
```

### Additional Terminal Colors

Terminal accent colors used throughout the app:

```css
/* Terminal color palette */
#ffd166  /* Yellow */
#f77aa6  /* Pink */
#4dd4b3  /* Teal/mint - also used for success states */
#8fa6ff  /* Blue/purple */
```

### Semantic Colors

```css
/* Success - Multiple greens used contextually */
#4dd4b3  /* Teal success (terminal palette, buttons) */
#22c55e  /* Tailwind green-500 (tabs, progress, badges) */
#10b981  /* Emerald (git indicators) */
#16a34a  /* Darker green (progress bar gradients) */

/* Info/Links */
#7cc4ff  /* Primary link blue */
#a0d7ff  /* Link hover */
#3b82f6  /* Info blue (used in badges) */

/* Warning */
#f59e0b  /* Amber (warnings, retry actions) */
#fbbf24  /* Lighter amber */

/* Error */
#ef4444  /* Error red */
#dc2626  /* Darker error */
#fca5a5  /* Light red (error text on dark bg) */

/* Agent/Special */
#a78bfa  /* Purple (agent badges) */
#818cf8  /* Indigo (pause actions) */
#8b5cf6  /* Violet (agent indicators) */
```

### Background Gradients

Dark gradients used for terminal backgrounds:

```css
/* Terminal background options */
gradient-orange-dark: linear-gradient(135deg, #1a0f0a 0%, #3d2415 25%, #5a3a25 50%, #3d2415 75%, #1a0f0a 100%);
gradient-blue-dark: linear-gradient(135deg, #0a0f1a 0%, #15243d 25%, #20355a 50%, #15243d 75%, #0a0f1a 100%);
gradient-green-dark: linear-gradient(135deg, #0a1a0f 0%, #15392d 25%, #20564a 50%, #15392d 75%, #0a1a0f 100%);
gradient-purple-dark: linear-gradient(135deg, #160a1a 0%, #2d1539 25%, #4a2056 50%, #2d1539 75%, #160a1a 100%);
gradient-red-dark: linear-gradient(135deg, #1a0a0a 0%, #3d1515 25%, #5a2020 50%, #3d1515 75%, #1a0a0a 100%);
gradient-teal-dark: linear-gradient(135deg, #0a1a1a 0%, #153d3d 25%, #205a5a 50%, #153d3d 75%, #0a1a1a 100%);
gradient-amber-dark: linear-gradient(135deg, #1a150a 0%, #3d3015 25%, #5a4a20 50%, #3d3015 75%, #1a150a 100%);
```

---

## Typography

### Font Family

```css
font-family: 'General Sans', 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
```

**General Sans** provides a modern, friendly appearance while maintaining excellent readability.

### Font Sizes

Based on actual usage patterns in the codebase:

```css
/* Headings */
--text-xl: 18px;      /* Large headings */
--text-lg: 16px;      /* Medium headings */
--text-md: 14px;      /* Small headings / emphasized body */
--text-base: 13px;    /* Default body text */
--text-sm: 12px;      /* Secondary text */
--text-xs: 11px;      /* Labels, captions */
--text-2xs: 10.5px;   /* Very small labels */
--text-3xs: 10px;     /* Tiny labels, uppercase */
--text-4xs: 9px;      /* Minimal text */
```

### Font Weights

```css
--font-regular: 400;  /* Body text */
--font-medium: 500;   /* Most UI elements */
--font-semibold: 600; /* Headings, emphasis */
```

**Note**: General Sans looks best at 400, 500, and 600 weights. Avoid 300 (too light on dark backgrounds) and 700 (too heavy for modern aesthetic).

### Letter Spacing

```css
/* Body text - slightly tighter than default */
letter-spacing: 0.01em;

/* Uppercase labels - more open */
letter-spacing: 0.5px;  /* Used for small labels */
letter-spacing: 0.06em; /* Alternative for labels */
```

---

## Drawer Pattern

All drawers follow this consistent structure. **TelegramSetup.tsx** is the canonical reference implementation.

### HTML Structure

```tsx
<div className={`component-drawer ${open ? "open" : ""}`}>
  <div className="component-drawer-backdrop" onClick={onClose} />

  <div className="component-drawer-panel">
    <header className="component-header">
      <div className="component-header-content">
        {/* Always use SVG icon - never emoji */}
        <svg className="component-icon" width="24" height="24">
          {/* Icon content */}
        </svg>
        <h2>Drawer Title</h2>
      </div>

      <button className="component-close" onClick={onClose} aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 20 20">
          <path
            d="M15 5L5 15M5 5L15 15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </header>

    <div className="component-content">
      {/* Scrollable content */}
    </div>

    <footer className="component-footer">
      {/* Optional footer */}
    </footer>
  </div>
</div>
```

### CSS Pattern

```css
/* Container - always in DOM, controlled by visibility */
.component-drawer {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
  z-index: 1300;
  visibility: hidden;
  transition: visibility 0s linear 0.3s;
}

.component-drawer.open {
  visibility: visible;
  transition-delay: 0s;
}

/* Backdrop - dark overlay with blur */
.component-drawer-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(8, 10, 15, 0.72);
  backdrop-filter: blur(8px);
  pointer-events: auto;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.component-drawer.open .component-drawer-backdrop {
  opacity: 1;
}

/* Panel - slides from right */
.component-drawer-panel {
  position: relative;
  height: 100%;
  width: 520px;
  max-width: 90vw;
  background: rgba(18, 20, 27, 0.97);
  border-left: 1px solid var(--panel-border-strong);
  box-shadow: -18px 0 48px rgba(4, 6, 12, 0.55);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.component-drawer.open .component-drawer-panel {
  transform: translateX(0);
}

/* Header with optional gradient accent */
.component-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: linear-gradient(135deg, rgba(242, 140, 82, 0.08) 0%, rgba(255, 178, 111, 0.08) 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.component-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

/* Close button */
.component-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 6px;
  opacity: 0.7;
  transition: all 0.2s;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.component-close:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.05);
}
```

### React Component Pattern

```tsx
interface ComponentDrawerProps {
  open: boolean;
  onClose: () => void;
}

function ComponentDrawer({ open, onClose }: ComponentDrawerProps) {
  // IMPORTANT: Always render - don't use: if (!open) return null;
  // The drawer container must always be in the DOM for animations to work

  return (
    <div className={`component-drawer ${open ? "open" : ""}`}>
      {/* Drawer content */}
    </div>
  );
}
```

**Key Principle**: Drawers are controlled via CSS classes, not React conditional rendering. This enables smooth open/close animations.

### Alternative Drawer Pattern (Keyframe Animation)

Some drawers use a simpler keyframe-based animation pattern. This is acceptable for drawers that don't require complex visibility transitions:

```css
/* Overlay with fade-in */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Drawer with slide-in animation */
.drawer-panel {
  width: min(900px, 90vw);
  height: 100vh;
  background: #1a1a1a;  /* Solid background alternative */
  display: flex;
  flex-direction: column;
  animation: slideIn 0.25s ease;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.4);
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
```

**When to use each pattern:**
- **CSS Visibility Pattern** (TelegramSetup): For drawers that need to stay in DOM, complex state management, or precise animation control
- **Keyframe Pattern** (TaskDetailsDrawer): For simpler overlays, modals that mount/unmount, or quick implementations

**Reference implementations:**
- CSS Visibility: `TelegramSetup.tsx`, `SavedCommandsDrawer.tsx`, `PreviewDrawer.tsx`
- Keyframe Animation: `TaskDetailsDrawer.tsx`, `SessionDetailsDrawer.tsx`

---

## Button Styles

### Primary Button (Orange)

```css
.button-primary {
  background: linear-gradient(135deg, #f28c52 0%, #ffb26f 100%);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.button-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #e17940 0%, #ffa05d 100%);
  box-shadow: 0 4px 12px rgba(242, 140, 82, 0.3);
  transform: translateY(-1px);
}

.button-primary:active {
  transform: translateY(0);
}

.button-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Secondary Button

```css
.button-secondary {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.9);
  padding: 10px 20px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.button-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(242, 140, 82, 0.5);
  box-shadow: 0 2px 6px rgba(242, 140, 82, 0.2);
}
```

### Success Button (Teal)

```css
.button-success {
  background: rgba(77, 212, 179, 0.9);
  color: #1a1a1a;
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.button-success:hover {
  background: rgba(77, 212, 179, 1);
  box-shadow: 0 6px 16px rgba(77, 212, 179, 0.4);
  transform: translateY(-1px);
}
```

---

## Empty States

### Pattern

```tsx
<div className="empty-state">
  <svg className="empty-state-icon" width="64" height="64" viewBox="0 0 64 64">
    {/* Minimal SVG icon - e.g., inbox, folder, terminal */}
    <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.2"/>
    <path d="M24 32h16M32 24v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
  <div className="empty-state-title">No Items Yet</div>
  <div className="empty-state-description">Create your first item to get started</div>
</div>
```

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-state-icon {
  color: var(--text-secondary);
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.empty-state-description {
  font-size: 14px;
  color: var(--text-secondary);
}
```

---

## Shadows & Depth

### Shadow Scale

```css
/* Subtle shadow for cards */
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

/* Medium shadow for elevated elements */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

/* Strong shadow for drawers/modals */
box-shadow: -18px 0 48px rgba(4, 6, 12, 0.55);

/* Orange glow shadow (for accent elements) */
box-shadow: 0 4px 12px rgba(242, 140, 82, 0.3);

/* Toast/notification shadow */
box-shadow:
  0 8px 32px rgba(0, 0, 0, 0.5),
  0 0 30px rgba(244, 175, 142, 0.5),
  0 0 60px rgba(244, 175, 142, 0.2),
  0 0 0 1px rgba(244, 175, 142, 0.1) inset;
```

### Border Radius

```css
--radius-sm: 4px;    /* Small elements, inputs */
--radius-md: 6px;    /* Standard buttons */
--radius-lg: 8px;    /* Cards, panels */
--radius-xl: 10px;   /* Large cards */
--radius-2xl: 12px;  /* Drawers, modals */
```

---

## Animations

### Timing Functions

```css
/* Standard smooth easing for panels/drawers */
cubic-bezier(0.4, 0, 0.2, 1)  /* 300ms duration */

/* Quick easing for hovers/interactions */
ease  /* 200ms duration */

/* Linear for spinners */
linear  /* Variable duration */
```

### Common Patterns

```css
/* Panel slide-in (drawer) */
transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

/* Opacity fade */
transition: opacity 0.3s ease;

/* Button hover */
transition: all 0.2s ease;

/* Multi-property */
transition: all 0.15s ease;
```

### Keyframe Animations

```css
/* Loading spinner */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Pulse effect */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Bounce effect (for loading dots) */
@keyframes loadingBounce {
  0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

/* Fade in */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide down */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## Interactive States

### Hover Transform Pattern

```css
/* Button/clickable element */
button:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(242, 140, 82, 0.3);
}

button:active {
  transform: translateY(0);
}

/* Disabled state */
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Focus States

```css
/* Input/textarea focus */
input:focus,
textarea:focus {
  outline: none;
  border-color: var(--accent-border);
  box-shadow: 0 0 0 3px rgba(242, 140, 82, 0.1);
}

/* Button focus (keyboard navigation) */
button:focus-visible {
  outline: 2px solid var(--accent-color);
  outline-offset: 2px;
}
```

---

## Toast Notifications

Using **Sonner** library with custom Quack styling:

```css
/* Toast container */
background: rgba(0, 0, 0, 0.85);
border: 1px solid rgba(244, 175, 142, 0.2);
box-shadow:
  0 8px 32px rgba(0, 0, 0, 0.5),
  0 0 30px rgba(244, 175, 142, 0.5);

/* Toast text */
color: rgba(255, 255, 255, 0.95);

/* Success toast */
border-color: rgba(244, 175, 142, 0.4);
```

---

## Best Practices

### DO

- **Use SVG icons for core UI**: Navigation, actions, toolbars, empty states
- **Use emoji for labels/badges**: Categories, tips, status messages, feature tags
- **Apply orange accent consistently**: Primary actions, brand moments, hover states
- **Use General Sans typography**: Modern, professional, excellent readability
- **Choose appropriate drawer pattern**: CSS visibility for complex, keyframes for simple
- **Apply backdrop-filter: blur()**: 8px for drawers, 4px for lighter overlays
- **Use cubic-bezier for panels**: Smooth, professional animation timing
- **Maintain consistent spacing**: 8px grid system for predictable layouts
- **Use semantic color names**: Success (green/teal), warning (amber), error (red), info (blue)
- **Keep SVG icons minimal**: Simple shapes, consistent stroke width (1.5-2px)

### DON'T

- **Don't use emoji for core UI elements**: Buttons, navigation, action icons
- **Don't use inconsistent orange tones**: Stick to #f28c52 family
- **Don't apply heavy animations**: Keep transitions smooth and subtle
- **Don't forget hover states**: Every interactive element needs feedback
- **Don't mix drawer patterns randomly**: Be consistent within feature areas
- **Don't use complex icons**: Keep SVG icons simple and recognizable
- **Don't use harsh borders**: Keep opacity low (0.08, 0.12, 0.32)
- **Don't forget disabled states**: Reduce opacity to 0.5 for disabled elements

---

## Reference Examples

### Perfect Implementations

- **TelegramSetup.tsx** + **TelegramSetup.css**: Canonical drawer implementation
- **index.css**: Core color system and CSS variables
- **sonner-custom.css**: Toast notification styling with orange accent

### Component Patterns

- **Drawer pattern**: TelegramSetup (canonical), SavedCommandsDrawer, PreviewDrawer, FilePreviewDrawer
- **Button styles**: Primary (orange), secondary (transparent), success (teal)
- **Empty states**: Clean SVG icons with minimal text
- **Typography**: ChatInput, ToolCallCard, MessageList
- **SVG Icons**: Lucide React or Heroicons for consistent minimal style

---

## Accessibility

### Color Contrast

All text colors meet WCAG AA standards for contrast on dark backgrounds:
- `#e7ebf3` on `#0f1115`: 14.5:1 (AAA)
- `rgba(255,255,255,0.7)` on `#0f1115`: 10.2:1 (AAA)
- `#f28c52` on `#0f1115`: 4.8:1 (AA)

### Keyboard Navigation

```tsx
// All interactive elements support keyboard
<button onClick={handleClick} aria-label="Close">
  {/* SVG icon */}
</button>

// Focus visible states
button:focus-visible {
  outline: 2px solid var(--accent-color);
}
```

### Screen Readers

```tsx
// Provide accessible labels
<button aria-label="Open settings">
  <svg>...</svg>
</button>

// Use semantic HTML
<header>
  <h2>Panel Title</h2>
</header>
```

---

## Integration Checklist

When creating new UI components:

1. Use orange (#f28c52) for primary actions and brand moments
2. Choose appropriate drawer pattern (CSS visibility OR keyframe animation)
3. Apply General Sans typography with appropriate weights
4. Use SVG icons for core UI, emoji for labels/badges/tips
5. Implement smooth animations (0.3s cubic-bezier for panels, 0.2s ease for interactions)
6. Add backdrop-filter: blur() for overlays (8px standard, 4px light)
7. Include hover states with subtle transform and shadow
8. Apply consistent border radius (6-12px range)
9. Use semantic spacing (8px grid system)
10. Keep SVG icons minimal (stroke-based, 1.5-2px width)
11. Test keyboard navigation and screen reader support
12. Use appropriate success color (#22c55e for Tailwind contexts, #4dd4b3 for teal accents)

---

*Quack Design System v2.1 - Updated from Real Implementation*
*Last Update: December 2025*
*Based on Quack App codebase analysis*

## Changelog

### v2.1 (December 2025)
- **Icon Policy**: Updated to allow emoji in specific contexts (labels, badges, tips, status messages)
- **Colors**: Added solid surface colors (#1a1a1a, #252525), splash background (#191B44), expanded semantic colors
- **Drawer Patterns**: Documented alternative keyframe animation pattern alongside CSS visibility pattern
- **Success Colors**: Documented multiple green variants (#22c55e Tailwind, #4dd4b3 teal, #10b981 emerald)
- **Best Practices**: Updated to reflect actual codebase patterns
