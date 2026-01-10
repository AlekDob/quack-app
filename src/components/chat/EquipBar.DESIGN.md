# EquipBar - Visual Design Reference

## Component Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Chat Footer                                                          │
├─────────────────────────────────────────────────────────────────────┤
│  [⭐ Skills ▼]  [🤖 Droids ▼]  [> Commands ▼]  [Textarea...] [Send] │
└─────────────────────────────────────────────────────────────────────┘
```

## Button States

### Default
```
┌─────────────────┐
│ ⭐ Skills ▼     │  transparent bg, subtle border
└─────────────────┘
```

### Hover
```
┌─────────────────┐
│ ⭐ Skills ▼     │  orange border, slight lift
└─────────────────┘
```

### Active (Open)
```
┌─────────────────┐
│ ⭐ Skills ▼     │  orange bg (12% opacity), orange border
└─────────────────┘
     ↑
┌─────────────────────┐
│ ⭐ frontend-dev     │
│ ⭐ backend-eng      │
│ ⭐ test-engineer    │
└─────────────────────┘
```

### Disabled
```
┌─────────────────┐
│ ⭐ Skills ▼     │  30% opacity, no pointer
└─────────────────┘
```

## Popover Design

```
┌──────────────────────────┐
│  Popover                 │  ← Dark background (rgba(18, 20, 27, 0.97))
├──────────────────────────┤     Subtle border + shadow
│  ⭐ skill-1              │  ← Item (transparent → orange on hover)
│  ⭐ skill-2              │
│  ⭐ skill-3              │
│  ⭐ skill-4              │
│  ⭐ skill-5              │
└──────────────────────────┘
        ↓
   Opens upward from button
   6px gap from button bottom
```

## Color Palette

```css
/* Accent */
--accent: #f28c52;              /* Orange primary */
--accent-surface: rgba(242, 140, 82, 0.12);   /* Button active */
--accent-border: rgba(242, 140, 82, 0.4);     /* Border hover */
--accent-hover: rgba(242, 140, 82, 0.15);     /* Item hover */

/* Background */
--bg-dark: rgba(18, 20, 27, 0.97);            /* Popover bg */
--bg-transparent: transparent;                /* Button default */
--bg-hover: rgba(255, 255, 255, 0.05);        /* Button hover */

/* Borders */
--border: rgba(255, 255, 255, 0.12);          /* Default border */

/* Text */
--text-muted: rgba(255, 255, 255, 0.65);      /* Button text */
--text-bright: rgba(255, 255, 255, 0.9);      /* Hover text */
--text-accent: #f28c52;                       /* Active text */
```

## Typography Scale

```css
/* Buttons */
font-size: 11px;
font-weight: 500;
line-height: 1;

/* Items in popover */
font-size: 12px;
font-weight: 400;
line-height: 1.2;

/* Empty state */
font-size: 11px;
font-style: italic;
opacity: 0.4;
```

## Spacing System

```css
/* Button */
padding: 0 10px;
height: 32px;
gap: 6px;          /* Between icon, text, chevron */
border-radius: 6px;

/* Popover */
padding: 6px;
border-radius: 8px;
bottom: calc(100% + 6px);  /* 6px gap from button */
min-width: 180px;
max-width: 240px;
max-height: 280px;         /* Scrollable if needed */

/* Item */
padding: 8px 10px;
gap: 8px;          /* Between icon and text */
border-radius: 6px;
```

## Icon Specifications

### Button Icons (14x14)
```svg
<!-- Star (Skills) -->
<svg width="14" height="14" viewBox="0 0 24 24">
  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
</svg>

<!-- Robot (Droids) -->
<svg width="14" height="14" viewBox="0 0 24 24">
  <rect x="4" y="8" width="16" height="12" rx="2" />
  <path d="M8 6V4M16 6V4M9 12H15M9 16H15" />
</svg>

<!-- Terminal (Commands) -->
<svg width="14" height="14" viewBox="0 0 24 24">
  <path d="M4 17L10 11L4 5M12 19H20" />
</svg>

<!-- Chevron Down (10x10) -->
<svg width="10" height="10" viewBox="0 0 24 24">
  <path d="M6 9L12 15L18 9" />
</svg>
```

All icons:
- **Stroke-based** (no fill)
- **Stroke width:** 2px
- **Color:** currentColor (inherits from button)
- **Opacity:** 0.7 default, 1.0 on hover

### Item Icons (12x12)
Same icons scaled to 12x12 for list items.

## Animation Timing

```css
/* Button transitions */
transition: all 0.2s ease;

/* Hover lift */
transform: translateY(-1px);

/* Active press */
transform: scale(0.98);

/* Popover entrance */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
animation: slideUp 0.15s ease-out;
```

## Responsive Breakpoints

```css
/* Mobile (< 768px) */
@media (max-width: 768px) {
  /* Hide text labels, show icons only */
  .equip-bar-button span {
    display: none;
  }

  /* Smaller buttons */
  height: 28px;
  padding: 0 8px;

  /* Narrower popover */
  min-width: 160px;
}
```

## Interaction Flow

```
1. User clicks button
   └─→ Popover opens (slideUp animation)
   └─→ Button gets .active class
   └─→ Click outside listener added

2. User hovers over item
   └─→ Orange background (15% opacity)
   └─→ Text color changes to orange
   └─→ Icon opacity increases to 1.0

3. User clicks item
   └─→ onInsert callback fires
   └─→ Popover closes
   └─→ Button loses .active class
   └─→ Focus returns to textarea

4. User clicks outside
   └─→ Popover closes
   └─→ Button loses .active class
```

## Accessibility Notes

- **Keyboard navigation:** Not implemented (future enhancement)
- **ARIA labels:** Should be added for screen readers
- **Focus states:** Inherit from button:focus
- **Color contrast:** Meets WCAG AA (4.5:1 minimum)

## Example Screenshots

```
State: All closed
┌────────────────────────────────────────────────────┐
│ [⭐ Skills ▼] [🤖 Droids ▼] [> Commands ▼]       │
└────────────────────────────────────────────────────┘

State: Skills open
┌─────────────────┐
│ ⭐ skill-1      │
│ ⭐ skill-2      │
│ ⭐ skill-3      │
└─────────────────┘
┌────────────────────────────────────────────────────┐
│ [⭐ Skills ▼] [🤖 Droids ▼] [> Commands ▼]       │
└────────────────────────────────────────────────────┘

State: Droids open, Skills closed
                   ┌──────────────────┐
                   │ 🤖 droid-1       │
                   │ 🤖 droid-2       │
                   └──────────────────┘
┌────────────────────────────────────────────────────┐
│ [⭐ Skills ▼] [🤖 Droids ▼] [> Commands ▼]       │
└────────────────────────────────────────────────────┘

State: Empty (disabled)
┌────────────────────────────────────────────────────┐
│ [⭐ Skills ▼] [🤖 Droids ▼] [> Commands ▼]       │
│  ↑ disabled    ↑ disabled   ↑ disabled            │
└────────────────────────────────────────────────────┘
```

## Integration Context

```
Chat Footer Layout (flexbox):
┌─────────────────────────────────────────────────────────────┐
│ [EquipBar] ← → [Textarea (flex: 1)] → [Attach] [Send]     │
└─────────────────────────────────────────────────────────────┘
       ↓             ↓                        ↓        ↓
    Fixed       Flexible                  Fixed    Fixed
```

## Shadow & Backdrop Blur

```css
/* Popover depth */
box-shadow:
  0 8px 24px rgba(0, 0, 0, 0.6),    /* Large soft shadow */
  0 0 0 1px rgba(255, 255, 255, 0.05); /* Subtle rim light */

backdrop-filter: blur(20px);         /* Glassmorphism effect */
```

## Z-Index Stack

```
Popover:     z-index: 1000;
Button:      z-index: auto;
Chat Input:  z-index: auto;
```

Ensure no conflicts with:
- Chat settings menu
- File picker
- Emoji picker (if exists)
- Other popovers

---

**Design Version:** 1.0
**Created:** 2026-01-10
**By:** Agent Jack
