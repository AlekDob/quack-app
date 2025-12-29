# Keyboard Shortcuts Settings Panel - Clarifying Questions

**Date**: 2025-12-25
**User Request**: Build a "Keyboard Shortcuts" section in Settings
**Initial Scope**: Add Cmd+K shortcut to toggle between Agents view and Kanban view with customization

---

## Feature Specifications to Clarify

### 1. UI/UX Pattern for Customization

**Question 1.1: How should users edit keyboard shortcuts?**
- *Option A*: **Inline editing** - Click on shortcut key in list → Input field appears → Type new combination
- *Option B*: **Modal dialog** - Click "Edit" button → Opens modal with instruction overlay showing current shortcut → Type new one
- *Option C*: **Interactive record** - Click shortcut field → Records actual keypress (user presses the keys they want) → Displays the recorded combination
- *Option D*: **Hybrid** - Hover → See current shortcut + click → Modal with record mode

**Why it matters**: Inline editing is fastest for power users. Modal with key recording is most discoverable for casual users. Recording actual keypresses prevents user confusion about key names (Option C pattern used by VS Code, Discord, etc.)

---

### 2. Scope of First Implementation

**Question 2.1: Should Cmd+K be the ONLY customizable shortcut, or part of a preset list?**
- *Option A*: **Start minimal** - Only Cmd+K → shortcut customization works, only 1 shortcut in Settings
- *Option B*: **Multiple defaults** - Include common shortcuts (Cmd+K for view toggle, Cmd+J for AI, Cmd+? for help) → all customizable together
- *Option C*: **Extensible system** - Build architecture that supports unlimited shortcuts (future-proof but more complex)

**Why it matters**: Option A is MVP. Option B gives users more control. Option C requires more planning but scales better.

---

### 3. Default Behavior & Reset

**Question 3.1: What happens if user disables a shortcut?**
- Should users be able to completely disable Cmd+K (set to "None")?
- Or should at least one method always be available (hotkey OR menu item)?

**Question 3.2: Should there be a "Reset to Defaults" button in Settings?**
- *Option A*: Yes - one click to restore all defaults
- *Option B*: Per-shortcut reset - reset individual shortcuts only
- *Option C*: No reset option - user must manually re-edit

**Why it matters**: Reset helps users who accidentally break their workflow. Per-shortcut is more granular but harder to discover.

---

### 4. Cross-Platform Behavior (Mac vs Windows/Linux)

**Question 4.1: How should the shortcut behave across platforms?**
- *Option A*: **Mac-first design** - Cmd+K on Mac, Ctrl+K on Windows/Linux (auto-convert)
- *Option B*: **Identical everywhere** - Cmd+K displays as "Cmd+K" on all platforms (users see same label)
- *Option C*: **Platform selectors** - Settings show "Cmd/Ctrl" dropdown + key selector (users pick platform)
- *Option D*: **Auto-detect but show modifier** - Show "Cmd" on Mac, "Ctrl" on Windows in Settings UI

**Why it matters**:
- Option A (most user-friendly): Respects platform conventions. Cmd is Mac native, Ctrl is Windows standard.
- Option B: Confusing on Windows (Cmd key doesn't exist).
- Option C: Most flexible but cluttered.
- Option D: Best UX → Show what users actually press.

**Question 4.2: What about Linux users?**
- Should Cmd+K map to Super/Meta key or stay Ctrl?
- Should it be customizable per-Linux distro or generic?

---

### 5. Shortcut Conflict Detection

**Question 5.1: Should Quack detect conflicts with system shortcuts?**
- *Option A*: **No detection** - User can set conflicting shortcuts (their problem)
- *Option B*: **Warn only** - Show warning if conflicts exist (Cmd+Q is quit, etc.) but allow it
- *Option C*: **Prevent conflicts** - Block user from setting conflicting shortcuts entirely
- *Option D*: **Whitelist known conflicts** - Allow Cmd+Q, Cmd+W but warn on others

**Why it matters**:
- Option A: Simplest but frustrating (shortcut doesn't work because OS intercepts it).
- Option B: Informs user without limiting them.
- Option C: User-proof but overly restrictive.
- Option D: Best balance → Know Mac/Windows reserved shortcuts, allow intentional overrides.

**Question 5.2: What about other Quack shortcuts?**
- If Cmd+J is already reserved for AI Assistant, should Cmd+K be blocked if user tries to set it to Cmd+J?
- Should there be a global shortcut registry in Settings showing ALL shortcuts used?

---

### 6. Visual Design & Discoverability

**Question 6.1: Where should "Keyboard Shortcuts" appear in Settings?**
- *Option A*: **Top-level tab** - "Settings > Keyboard Shortcuts" (prominent, dedicated space)
- *Option B*: **Nested under General** - "Settings > General > Keyboard Shortcuts" (keeps UI compact)
- *Option C*: **Floating reference panel** - Accessible from Help menu or Cmd+? (learnable shortcut)
- *Option D*: **Combination** - Settings panel + Quick reference from Help (discoverable + accessible)

**Question 6.2: How should shortcuts be displayed?**
- Show only active shortcuts (toggles "Show disabled")?
- Group by category (View, Edit, Navigation)?
- Search/filter capability?
- Show current shortcut hint when hovering buttons throughout app?

---

### 7. Future Shortcuts Roadmap

**Question 7.1: What other shortcuts do you want to implement next?**
- View/Navigation: Cmd+1-6 (switch between views), Cmd+Shift+K (reverse toggle), Cmd+L (focus search)
- Terminal: Cmd+N (new terminal), Cmd+W (close terminal)
- Git: Cmd+G (open git panel), Cmd+Shift+P (run command)
- AI: Already have Cmd+J for AI Assistant
- Other: Cmd+S (save), Cmd+Z (undo)

**Why it matters**: Understanding the full shortcut strategy helps design a system that scales.

---

### 8. Storage & Persistence

**Question 8.1: Should custom shortcuts be stored per-user globally or per-project?**
- *Option A*: **Global only** - One customization shared across all projects (simple)
- *Option B*: **Project-scoped** - Each project can have custom shortcuts (complex but flexible)
- *Option C*: **Global default + project override** - Default shortcuts globally, optional per-project customization

**Question 8.2: Where to store settings?**
- Tauri Store (quack-keyboard-shortcuts.json)?
- Application config directory (~/.quack/)?
- Sync with cloud (future)?

---

### 9. Testing & Edge Cases

**Question 9.1: Should the implementation handle these edge cases?**
- User presses invalid combination (no modifier + regular key)?
- User tries to set empty/null shortcut?
- Rapid toggle (press Cmd+K twice quickly)?
- Shortcut while focused in text input (should it work)?
- Shortcut during modal/dialog open (should it work)?

---

### 10. Help & Discoverability

**Question 10.1: How should users discover the Cmd+K shortcut initially?**
- *Option A*: Tooltip on Agents/Kanban toggle buttons ("Press Cmd+K to toggle")
- *Option B*: Welcome modal on first launch showing main shortcuts
- *Option C*: Settings → Keyboard Shortcuts → Shows default shortcuts with descriptions
- *Option D*: Help menu → "Keyboard Shortcuts" reference panel
- *Option E*: Show hint badge next to buttons (small "Cmd+K" indicator)

**Question 10.2: Should shortcuts have descriptions?**
- "Toggle between Agents view and Kanban board" (helps new users)
- Just display the key combination (keeps UI minimal)

---

## Recommended Approach (To Confirm)

Based on Quack's philosophy (AI-first, minimal, powerful), I'd suggest:

1. **UI**: Inline editing with key-recording mode (record actual keypresses)
2. **Scope**: Start with Cmd+K only, build extensible architecture
3. **Platform**: Auto-convert Cmd (Mac) ↔ Ctrl (Windows/Linux) in backend, show actual modifier in UI
4. **Conflicts**: Warn on known system shortcuts (Cmd+Q, Cmd+W), allow override
5. **Storage**: Tauri Store (quack-keyboard-shortcuts.json), global scope
6. **Testing**: Handle empty/invalid combinations, skip shortcut during text input focus
7. **Discoverability**: Tooltip on toggle button + Settings panel with description

---

## Next Steps

Once you clarify these 10 questions, I can:
1. Create detailed specs document
2. Design UI mockup (Figma/sketch)
3. Plan file structure & component architecture
4. Write test cases (Vitest)
5. Implement feature with Tauri bridge

All will be documented in `/docs/05-features/keyboard-shortcuts.md`

