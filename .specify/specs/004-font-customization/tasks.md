# Implementation Tasks: Font & Typography Customization

## Phase 1: Foundation (CSS Variables + Constants)

- [ ] 1.1 Create `src/constants/typography.ts` with preset definitions
  - Define `FontSizePreset` type and `FONT_SIZE_PRESETS` map
  - Define `UI_FONT_OPTIONS` and `MONO_FONT_OPTIONS` arrays
  - Export `applyTypography()` function that sets CSS variables on `:root`
  - **Depends on**: None
  - **Requirement**: R1.1, R2.1

- [ ] 1.2 Add CSS custom properties to `src/index.css`
  - Add `--font-ui`, `--font-mono`, `--fs-body`, `--fs-user-msg`, `--fs-h1`, `--fs-h2`, `--fs-h4`, `--fs-h6`, `--fs-code`, `--fs-small`, `--fs-terminal` to `:root`
  - Replace existing hardcoded `font-family` on `:root` with `var(--font-ui)`
  - Set initial values to M preset (current defaults)
  - **Depends on**: 1.1
  - **Requirement**: R1.1

## Phase 2: Store Integration

- [ ] 2.1 Add `typography` section to `settingsStore.ts`
  - Add `TypographySettings` interface
  - Add default values (M preset, current font families)
  - Add setter actions: `setFontSizePreset`, `setFontFamilyUI`, `setFontFamilyMono`
  - Bump store version 5 → 6 with migration
  - **Depends on**: 1.1
  - **Requirement**: R1.5, R3.3

- [ ] 2.2 [P] Call `applyTypography()` on app startup
  - In `App.tsx` or root component, read typography settings and apply on mount
  - Ensure CSS variables are set before first render (useLayoutEffect)
  - **Depends on**: 1.1, 2.1
  - **Requirement**: R1.4

- [ ] 2.3 [P] Sync terminal settings with typography preset
  - When preset changes, update `terminal.fontSize` and `terminal.fontFamily`
  - Add hint in Terminal settings: "Sincronizzato con Typography"
  - **Depends on**: 2.1
  - **Requirement**: Q3

## Phase 3: CSS Migration (Hardcoded → Variables)

- [ ] 3.1 Migrate `src/components/MarkdownText.css`
  - Replace all hardcoded `font-size` values with CSS variables
  - Replace hardcoded `font-family` for code elements with `var(--font-mono)`
  - Test heading hierarchy maintained
  - **Depends on**: 1.2
  - **Requirement**: R2.1, R2.5

- [ ] 3.2 [P] Migrate `src/components/ChatMessage.tsx`
  - Replace inline `fontSize: '13px'` with `var(--fs-user-msg)`
  - **Depends on**: 1.2
  - **Requirement**: R2.2

- [ ] 3.3 [P] Migrate `src/components/StreamMessage.tsx`
  - Replace hardcoded font sizes with CSS variables
  - **Depends on**: 1.2
  - **Requirement**: R2.1

- [ ] 3.4 [P] Grep and fix remaining hardcoded font sizes across components
  - Search for `fontSize:` and `font-size:` patterns in src/
  - Convert sidebar labels, headers, buttons to CSS variables
  - **Depends on**: 1.2
  - **Requirement**: R2.3

## Phase 4: Settings UI

- [ ] 4.1 Create `src/components/settings/categories/TypographySettings.tsx`
  - Size preset selector (4 cards: S / M / L / XL with checkmark)
  - UI font dropdown
  - Mono font dropdown
  - Live preview block (sample text + code)
  - Reset to defaults button
  - **Depends on**: 2.1, 1.1
  - **Requirement**: R1.1, R1.2, R1.3, R3.1, R3.2, R4.1, R4.2, R4.3

- [ ] 4.2 Register Typography in Settings navigation
  - Add "Typography" entry with "Aa" icon to settings categories
  - Position between "Appearance" and "Keyboard"
  - **Depends on**: 4.1
  - **Requirement**: R1.1

## Phase 5: Testing & Polish

- [ ] 5.1 Visual QA at all 4 presets
  - Test chat view, sidebar, terminal, code blocks at S/M/L/XL
  - Verify no layout overflow or text clipping
  - Verify heading hierarchy preserved
  - **Depends on**: 3.1, 3.2, 3.3, 3.4, 4.1
  - **Requirement**: R2.6

- [ ] 5.2 Cross-platform font fallback verification
  - Verify font stacks work on macOS (SF Pro, SF Mono available)
  - Verify font stacks work on Windows (Segoe UI, Consolas available)
  - **Depends on**: 5.1
  - **Requirement**: NFR-Compatibility

- [ ] 5.3 Persistence and migration test
  - Fresh install → defaults to M
  - Existing user upgrade → migrates to M, no visual change
  - Change preset → close/reopen → preset persisted
  - **Depends on**: 2.1, 5.1
  - **Requirement**: R1.5

## Notes

- `[P]` indicates tasks that can be parallelized
- Phase 3 tasks (3.1-3.4) can all run in parallel
- Phase 4 can start as soon as Phase 2 is done (doesn't need Phase 3)
- Estimated total: ~3-4 hours of implementation
