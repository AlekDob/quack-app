# Implementation Plan: Font & Typography Customization

## Architecture Overview

CSS custom properties (variables) as the single source of truth for all font sizes. Zustand store holds user preference, applies CSS variables on `<html>` root. All components consume CSS variables — zero prop drilling, instant application.

```
User selects preset → Zustand store updates → CSS variables set on :root → All components auto-update
```

## Technology Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Font size mechanism | CSS custom properties | Instant cascade, no re-renders, works with existing CSS |
| State management | Zustand settingsStore | Already exists, has persist middleware, migration support |
| Preset system | 4 named presets (S/M/L/XL) | Simple, opinionated, prevents bad choices |
| Font family | System font stacks | Zero overhead, cross-platform, already available |

## CSS Variable Schema

New variables to add to `:root` in `index.css`:

```css
:root {
  /* Typography - Font Families */
  --font-ui: 'General Sans', 'Inter', 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'IBM Plex Mono', 'Fira Code', monospace;

  /* Typography - Font Sizes (M preset = current defaults) */
  --fs-body: 12px;          /* markdown body, UI labels */
  --fs-user-msg: 13px;      /* user message bubbles */
  --fs-h1: 14px;            /* heading 1 */
  --fs-h2: 13px;            /* heading 2-3 */
  --fs-h4: 11px;            /* heading 4-5 */
  --fs-h6: 10px;            /* heading 6 */
  --fs-code: 11px;          /* inline code, code blocks */
  --fs-small: 10px;         /* meta text, timestamps */
  --fs-terminal: 14px;      /* terminal emulator */
}
```

## Preset Definitions (TypeScript)

```typescript
type FontSizePreset = 'S' | 'M' | 'L' | 'XL';

const FONT_SIZE_PRESETS: Record<FontSizePreset, Record<string, number>> = {
  S:  { body: 11, userMsg: 12, h1: 13, h2: 12, h4: 10, h6: 9,  code: 10, small: 9,  terminal: 12 },
  M:  { body: 12, userMsg: 13, h1: 14, h2: 13, h4: 11, h6: 10, code: 11, small: 10, terminal: 14 },
  L:  { body: 14, userMsg: 15, h1: 16, h2: 15, h4: 13, h6: 12, code: 13, small: 12, terminal: 16 },
  XL: { body: 16, userMsg: 17, h1: 18, h2: 17, h4: 15, h6: 14, code: 15, small: 14, terminal: 18 },
};
```

## Store Changes

### settingsStore.ts

Add new `typography` section to `SettingsState`:

```typescript
interface TypographySettings {
  fontSizePreset: FontSizePreset;  // 'S' | 'M' | 'L' | 'XL'
  fontFamilyUI: string;            // font-family for UI text
  fontFamilyMono: string;          // font-family for code/terminal
}
```

Default:
```typescript
typography: {
  fontSizePreset: 'M',
  fontFamilyUI: "'General Sans', 'Inter', 'Segoe UI', system-ui, sans-serif",
  fontFamilyMono: "'JetBrains Mono', 'IBM Plex Mono', 'Fira Code', monospace",
}
```

### CSS Application Function

```typescript
function applyTypography(settings: TypographySettings): void {
  const root = document.documentElement;
  const sizes = FONT_SIZE_PRESETS[settings.fontSizePreset];

  root.style.setProperty('--fs-body', `${sizes.body}px`);
  root.style.setProperty('--fs-user-msg', `${sizes.userMsg}px`);
  // ... all variables
  root.style.setProperty('--font-ui', settings.fontFamilyUI);
  root.style.setProperty('--font-mono', settings.fontFamilyMono);
}
```

Called on:
1. App startup (from persisted settings)
2. Settings change (live preview)

## Component Changes

### Files to Modify (CSS variable adoption)

| File | Current | Change to |
|------|---------|-----------|
| `src/index.css` | `font-family: 'General Sans'...` | `font-family: var(--font-ui)` |
| `src/components/MarkdownText.css` | `font-size: 12px` hardcoded | `font-size: var(--fs-body)` |
| `src/components/ChatMessage.tsx` | `fontSize: '13px'` inline | `fontSize: 'var(--fs-user-msg)'` |
| `src/components/StreamMessage.tsx` | Various hardcoded sizes | CSS variables |
| Terminal config in settingsStore | `fontSize: 14` | Read from `--fs-terminal` / sync with preset |

### New Files

| File | Purpose |
|------|---------|
| `src/components/settings/categories/TypographySettings.tsx` | Typography settings panel |
| `src/constants/typography.ts` | Preset definitions, font lists, `applyTypography()` |

## UI Design: Typography Settings Panel

```
┌─────────────────────────────────────────┐
│  Typography                              │
│  Customize fonts and text size           │
│                                          │
│  TEXT SIZE                               │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│  │ S  │ │ M  │ │ L  │ │ XL │           │
│  │    │ │ ✓  │ │    │ │    │           │
│  └────┘ └────┘ └────┘ └────┘           │
│                                          │
│  UI FONT                                 │
│  ┌─────────────────────────────┐        │
│  │ General Sans            ▾   │        │
│  └─────────────────────────────┘        │
│                                          │
│  CODE FONT                               │
│  ┌─────────────────────────────┐        │
│  │ JetBrains Mono          ▾   │        │
│  └─────────────────────────────┘        │
│                                          │
│  PREVIEW                                 │
│  ┌─────────────────────────────────┐    │
│  │ The quick brown fox jumps over  │    │
│  │ the lazy duck. 🦆               │    │
│  │                                  │    │
│  │ const quack = "hello world";    │    │
│  └─────────────────────────────────┘    │
│                                          │
│  ⟲ Reset to defaults                    │
└─────────────────────────────────────────┘
```

## Terminal Sync Strategy

The preset overrides `terminal.fontSize` and `terminal.fontFamily` in settingsStore. When user changes preset:

1. Update `typography.fontSizePreset`
2. Sync `terminal.fontSize = PRESETS[preset].terminal`
3. Sync `terminal.fontFamily` from `typography.fontFamilyMono`
4. Existing Terminal settings UI shows synced values (read-only hint: "Controlled by Typography preset")

## Migration (settingsStore version bump)

Current version: 5 → New version: 6

Migration function:
```typescript
if (version === 5) {
  return {
    ...state,
    typography: {
      fontSizePreset: 'M',
      fontFamilyUI: "'General Sans', 'Inter', 'Segoe UI', system-ui, sans-serif",
      fontFamilyMono: state.terminal?.fontFamily || "'JetBrains Mono'...",
    }
  };
}
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Layout breakage at XL | Test all views at all presets. Use relative spacing where possible. |
| Terminal not updating live | Terminal component listens to store changes via `useEffect` |
| Inline styles override CSS vars | Grep for hardcoded `fontSize` in inline styles, convert to CSS vars |
| Font not available on Windows | Full fallback chains in all font stacks |

## Constitution Alignment

- ✅ **Simplicity**: 4 presets, no complex sliders
- ✅ **UX First**: User-requested feature, immediate visual feedback
- ✅ **Code Quality**: CSS variables = DRY, no prop drilling
- ✅ **TypeScript strict**: Typed presets, typed settings
- ✅ **Files < 300 lines**: TypographySettings.tsx ~120 lines, typography.ts ~60 lines
