# Feature Specification: Font & Typography Customization

## Problem Statement

Users have requested the ability to increase font size in the chat stream. Currently, all typography in Quack is hardcoded (12px base for markdown, 13px for user messages, 11px for code). Users with different screen sizes, visual preferences, or accessibility needs cannot adjust text size to their comfort level. This is a frequently requested feature (confirmed by Discord community feedback).

## User Stories

### Story 1: Adjust Chat Font Size via Presets

As a Quack user
I want to choose a text size preset (S / M / L / XL) from Settings
So that I can read chat messages comfortably on my screen

**Acceptance Criteria:**
- [ ] Typography section appears in Settings menu between "Appearance" and "Keyboard"
- [ ] Four size presets available: Small (S), Medium (M), Large (L), Extra Large (XL)
- [ ] Medium (M) is the default and matches current hardcoded sizes
- [ ] Changes apply immediately (live preview) without requiring restart
- [ ] Preference persists across app restarts

### Story 2: All UI Regions Scale Proportionally

As a Quack user
I want all text in the app to scale when I change the size preset
So that the entire interface feels consistent

**Acceptance Criteria:**
- [ ] Chat stream (AI assistant messages) scales with preset
- [ ] User message bubbles scale with preset
- [ ] UI elements (sidebar labels, headers, buttons) scale with preset
- [ ] Code blocks and terminal text scale with preset
- [ ] Headings maintain proportional hierarchy (h1 > h2 > h3...)
- [ ] No layout breakage at any preset level

### Story 3: Choose App Font Family

As a Quack user
I want to choose between system font families
So that I can personalize the look of my workspace

**Acceptance Criteria:**
- [ ] Dropdown or selector for UI font family
- [ ] Separate selector for monospace/code font family
- [ ] Available UI fonts: General Sans, Inter, SF Pro, Segoe UI, System Default
- [ ] Available mono fonts: JetBrains Mono, IBM Plex Mono, Fira Code, SF Mono, Menlo, System Monospace
- [ ] Changes apply immediately
- [ ] Preference persists across app restarts

### Story 4: Preview Before Committing

As a Quack user
I want to see a live preview of my font changes in the Settings panel
So that I can evaluate the result before closing settings

**Acceptance Criteria:**
- [ ] A preview block in the Typography settings shows sample text at current settings
- [ ] Preview updates in real-time as user changes preset or font family
- [ ] Preview includes both regular text and code sample

## Non-Functional Requirements

- **Performance**: Font changes must apply in < 50ms (CSS variable swap, no re-render)
- **Accessibility**: XL preset should meet WCAG AA minimum (16px+ body text)
- **Compatibility**: Must work on macOS and Windows (font fallback chains)
- **Storage**: Settings stored in Zustand with persist (localStorage), same as existing preferences
- **No network**: All fonts are system fonts — zero external requests

## Preset Size Scale

| Element | S (Small) | M (Medium/Default) | L (Large) | XL (Extra Large) |
|---------|-----------|---------------------|-----------|-------------------|
| Body/Markdown | 11px | 12px | 14px | 16px |
| User message | 12px | 13px | 15px | 17px |
| Headings h1 | 13px | 14px | 16px | 18px |
| Headings h2-h3 | 12px | 13px | 15px | 17px |
| Code inline | 10px | 11px | 13px | 15px |
| Code blocks | 10px | 11px | 13px | 15px |
| UI labels | 11px | 12px | 14px | 16px |
| Small text/meta | 9px | 10px | 12px | 14px |

## Success Metrics

- Users can change font size in < 3 clicks (Settings → Typography → Preset)
- No layout breakage reported at any preset level
- Feature adopted by 30%+ of active users within 2 weeks

## Clarifications

### Q1: Default preset for new and existing users?
**Answer**: M (Medium) — matches current hardcoded sizes. Zero visual change on upgrade. Existing users see no difference until they actively change it.

### Q2: Settings menu icon for Typography section?
**Answer**: "Aa" text icon (like VS Code/Chrome font settings). Consistent with industry standard.

### Q3: Should the preset also control the integrated terminal?
**Answer**: Yes — the preset controls everything including the terminal. The existing Terminal > Font Size setting in Settings will be synced/overridden by the typography preset. Simpler mental model for the user: one control for all text sizes.

### Q4: Font family selector — how many options?
**Answer**: System fonts only. UI font dropdown: General Sans, Inter, SF Pro, Segoe UI, System Default. Mono font dropdown: JetBrains Mono, IBM Plex Mono, Fira Code, SF Mono, Menlo, System Monospace. All bundled or system-available, zero network requests.

## Out of Scope

- Google Fonts or custom font upload (may be added later)
- Per-element granular font size control (too complex for v1)
- Light/dark theme font variations
- Font weight customization
- Line height customization (follows font size proportionally)
