# Git Integration - UI/UX Design Specifications

**For**: Julie (UI/UX Designer)
**Project**: TerminalFlow Git Integration Enhancement
**Style Guide**: Liquid/Glass-morphism with Radix-inspired components

## 🎨 Design Language Overview

### Core Visual Principles
1. **Glass-morphism**: Semi-transparent panels with backdrop blur
2. **Liquid animations**: Smooth, organic transitions using GSAP
3. **Depth hierarchy**: Subtle shadows and elevation layers
4. **Accent gradients**: Dynamic color flows for interactive elements

### Color Palette
```css
/* Primary Git Colors */
--git-primary: #e87d3e;        /* Main Git orange */
--git-secondary: #f28c52;      /* Lighter orange for hover */
--git-success: #4dd4b3;        /* Successful operations */
--git-danger: #ef4444;         /* Destructive operations */
--git-warning: #ffd166;        /* Warnings and conflicts */
--git-info: #8fa6ff;           /* Information and links */

/* Branch Line Colors */
--branch-main: linear-gradient(135deg, #e87d3e, #f28c52);
--branch-feature: linear-gradient(135deg, #4dd4b3, #22c55e);
--branch-fix: linear-gradient(135deg, #8fa6ff, #6366f1);
--branch-release: linear-gradient(135deg, #f77aa6, #ec4899);

/* Glass Effects */
--glass-bg: rgba(15, 17, 26, 0.85);
--glass-border: rgba(255, 255, 255, 0.08);
--glass-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
--glass-blur: blur(12px);
```

## 📐 Component Specifications

### 1. Git Graph View (Phase 2)

#### Layout Structure
```
┌────────────────────────────────────────────┐
│ Git Graph                         [⚙️] [🔍] │
├────────────────────────────────────────────┤
│                                            │
│  ○──┬─ main                               │
│  │  │                                      │
│  ●  ├─ feature/new-ui (current)           │
│  │  │                                      │
│  ○──┴─ develop                            │
│  │                                         │
│  ○ v1.0.0 (tag)                           │
│                                            │
└────────────────────────────────────────────┘
```

#### Visual Specifications
- **Container**: Glass panel with 12px border-radius
- **Graph lines**: 2px stroke with gradient, drop-shadow
- **Commit nodes**:
  - Regular: 10px circle with 2px border
  - Current: 14px with pulse animation
  - Tagged: Diamond shape with glow
- **Branch labels**: Pills with gradient background
- **Hover state**: Scale 1.1x with tooltip showing details

#### GSAP Animations
```javascript
// Commit node appearance
gsap.from(commitNode, {
  scale: 0,
  opacity: 0,
  duration: 0.4,
  ease: "back.out(1.7)",
  stagger: 0.02
});

// Branch line drawing
gsap.fromTo(branchLine,
  { strokeDasharray: "0, 1000" },
  { strokeDasharray: "1000, 0", duration: 1, ease: "power2.inOut" }
);
```

### 2. Branch Management UI (Phase 3)

#### Branch Switcher Design
```
┌──────────────────────────┐
│ 🌿 main       ▼          │
├──────────────────────────┤
│ 📍 Current Branch        │
│ ─────────────────        │
│ 🌿 main                  │
│ 🔄 develop (2 behind)    │
│ ✨ feature/new-ui        │
│ 🐛 fix/bug-123          │
│ ─────────────────        │
│ 🌐 Remote Branches      │
│ origin/staging          │
│ origin/production       │
└──────────────────────────┘
```

#### Quick Actions Bar
```
┌─────────────────────────────────────────────┐
│ [↓ Pull] [↑ Push] [⟲ Fetch] [📦 Stash]    │
│ [+ Branch] [⤵ Merge] [🏷️ Tag] [⚙️]         │
└─────────────────────────────────────────────┘
```

- **Button style**: Glass buttons with icon + text
- **Hover**: Brightness 110%, slight elevation
- **Active**: Inset shadow, scale 0.98
- **Disabled**: Opacity 0.4, cursor not-allowed
- **Tooltips**: Show keyboard shortcuts

### 3. Enhanced Diff Viewer (Phase 4)

#### Split View Layout
```
┌─────────────┬─────────────┐
│  Original   │  Modified   │
├─────────────┼─────────────┤
│ 1 │ line    │ 1 │ line    │
│ 2 │ old     │ 2 │ new     │
│ 3 │ text    │ 3 │ text    │
│   │         │ 4 │ added   │
└─────────────┴─────────────┘
```

#### Visual Elements
- **Line numbers**: Muted color, fixed width
- **Added lines**: Green background with left border
- **Removed lines**: Red background with left border
- **Modified chunks**: Yellow highlight
- **Syntax highlighting**: Using Prism.js themes
- **Navigation**: Mini-map on right side

### 4. Modals & Dialogs

#### Create Branch Modal
```
┌──────────────────────────────────┐
│ Create New Branch         [✕]   │
├──────────────────────────────────┤
│                                  │
│ Branch Name                      │
│ [feature/___________]            │
│                                  │
│ Base Branch                      │
│ [▼ main                    ]     │
│                                  │
│ □ Switch to branch after create  │
│                                  │
│ [Cancel]         [Create Branch] │
└──────────────────────────────────┘
```

- **Modal overlay**: Dark with blur backdrop
- **Input fields**: Glass style with focus glow
- **Buttons**: Primary action with gradient
- **Validation**: Real-time with inline errors

## 🎬 Animation Specifications

### Transition Timings
```javascript
const animations = {
  // Micro-interactions (instant feedback)
  hover: { duration: 0.2, ease: "power1.out" },

  // State changes (smooth transitions)
  stateChange: { duration: 0.4, ease: "power2.inOut" },

  // Complex animations (graphs, trees)
  complex: { duration: 0.6, ease: "power3.inOut" },

  // Page transitions
  page: { duration: 0.8, ease: "expo.inOut" }
};
```

### Key Animation Patterns

#### 1. Branch Switch Animation
```javascript
// Fade out current view
gsap.to(currentView, {
  opacity: 0,
  filter: "blur(8px)",
  scale: 0.95,
  duration: 0.3
});

// Fade in new view
gsap.fromTo(newView,
  { opacity: 0, filter: "blur(8px)", scale: 1.05 },
  { opacity: 1, filter: "blur(0px)", scale: 1, duration: 0.4 }
);
```

#### 2. Commit Node Interactions
```javascript
// Hover effect
onHover: {
  scale: 1.2,
  boxShadow: "0 0 20px rgba(232, 125, 62, 0.5)",
  duration: 0.2
}

// Click ripple
onClick: {
  immediate: { scale: 0.9 },
  then: { scale: 1.1, opacity: 0.8 },
  finally: { scale: 1, opacity: 1 }
}
```

## 📱 Responsive Behavior

### Breakpoints
- **Desktop**: > 1200px (full feature set)
- **Tablet**: 768px - 1200px (condensed layout)
- **Mobile**: < 768px (stacked layout)

### Adaptive Layouts
```css
/* Desktop: Side-by-side */
.git-panel {
  display: grid;
  grid-template-columns: 300px 1fr 400px;
}

/* Tablet: Collapsible sidebar */
@media (max-width: 1200px) {
  .git-panel {
    grid-template-columns: 250px 1fr;
  }
  .git-history { display: none; } /* Toggle-able */
}

/* Mobile: Stacked */
@media (max-width: 768px) {
  .git-panel {
    grid-template-columns: 1fr;
  }
}
```

## 🎯 Interaction States

### Component States
1. **Default**: Base appearance
2. **Hover**: Elevated, brightened
3. **Active/Pressed**: Inset, scaled down
4. **Focus**: Ring outline for accessibility
5. **Disabled**: Reduced opacity, no interactions
6. **Loading**: Skeleton screens or spinners
7. **Error**: Red accent with shake animation

### Loading States
```jsx
// Skeleton for commit list
<div className="commit-skeleton">
  <div className="skeleton-circle" />
  <div className="skeleton-lines">
    <div className="skeleton-text" style={{width: '80%'}} />
    <div className="skeleton-text" style={{width: '60%'}} />
  </div>
</div>
```

## 🔧 Component Library Integration

### Radix UI Components to Use
- **Dialog**: For modals (branch create, merge conflicts)
- **Dropdown Menu**: For context menus
- **Select**: For branch selection
- **Tabs**: For diff view modes
- **Tooltip**: For hover information
- **Toggle Group**: For view switchers

### Custom Components Needed
- **GitGraph**: Custom SVG-based graph renderer
- **DiffViewer**: Custom diff display with syntax
- **BranchLine**: Custom SVG path drawer
- **CommitNode**: Custom interactive node component

## 📊 Performance Guidelines

### Rendering Optimizations
1. **Virtual Scrolling**: For lists > 100 items
2. **Lazy Loading**: Load graph nodes on demand
3. **Memoization**: Cache expensive computations
4. **Web Workers**: Graph calculations off main thread
5. **GPU Acceleration**: Transform3d for animations

### Animation Performance
```css
/* Use GPU-accelerated properties */
.animated-element {
  will-change: transform, opacity;
  transform: translateZ(0); /* Force GPU layer */
}

/* Avoid animating expensive properties */
/* ❌ Don't: */ animation: width, height, padding;
/* ✅ Do: */ animation: transform, opacity;
```

## 🎨 Final Visual Checklist

### Must-Have Elements
- [ ] Glass-morphism on all panels
- [ ] Smooth GSAP transitions
- [ ] Consistent color palette
- [ ] Clear visual hierarchy
- [ ] Responsive layouts
- [ ] Accessibility features
- [ ] Loading states
- [ ] Error states
- [ ] Empty states
- [ ] Keyboard navigation

### Nice-to-Have Enhancements
- [ ] Particle effects for major actions
- [ ] Sound effects for operations
- [ ] Theme customization
- [ ] Animated backgrounds
- [ ] Custom cursors
- [ ] Easter eggs

---

This design specification provides comprehensive guidelines for implementing the Git integration UI. Focus on maintaining visual consistency with TerminalFlow's existing design language while introducing new Git-specific components that feel native to the application.