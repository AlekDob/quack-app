# EquipBar Integration Guide

## Quick Start

The EquipBar component is **complete and tested** - ready for integration into ChatView.

## Files Created

```
src/components/chat/
├── EquipBar.tsx               # Main component (177 lines)
├── EquipBar.css               # Styling (159 lines)
├── EquipBar.example.tsx       # Usage example with demo
├── EquipBar.README.md         # Component documentation
└── EquipBar.DESIGN.md         # Visual design reference

src/tests/
└── EquipBar.test.tsx          # Tests (6/6 passing)
```

## Test Status

```bash
npm test -- EquipBar

✓ src/tests/EquipBar.test.tsx (6 tests) 27ms
  ✓ should render all three buttons
  ✓ should open popover when clicking skills button
  ✓ should call onInsertSkill when clicking a skill item
  ✓ should call onInsertCommand when clicking a command item
  ✓ should disable button when no items available
  ✓ should close popover when clicking an item

Test Files  1 passed (1)
     Tests  6 passed (6)
```

## Integration Steps

### 1. Import the component into ChatView

```tsx
// In src/components/ChatView.tsx
import EquipBar from './chat/EquipBar';
```

### 2. Load equipment data

```tsx
// Add to ChatView component state/hooks
import { loadAvailableCommands } from '../utils/skillsAndDroidsLoader';

// Inside component:
const skills = activeAgent?.bundle?.skills || [];
const droids = activeAgent?.bundle?.protocol_droids || [];
const commands = useMemo(() => loadAvailableCommands(), []);
```

### 3. Implement insertion handlers

```tsx
// Get ref to ChatInput textarea (or wherever prompt is)
const chatInputRef = useRef<HTMLTextAreaElement>(null);

const insertAtCursor = (text: string) => {
  const textarea = chatInputRef.current;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const currentValue = textarea.value;

  // Insert text at cursor position
  const newValue =
    currentValue.substring(0, start) +
    text +
    currentValue.substring(end);

  // Update prompt state
  setPromptValue(newValue); // or whatever your state setter is

  // Restore cursor position
  setTimeout(() => {
    textarea.focus();
    const newPosition = start + text.length;
    textarea.setSelectionRange(newPosition, newPosition);
  }, 0);
};

const handleInsertSkill = (skill: string) => {
  insertAtCursor(`@skill:${skill} `);
};

const handleInsertDroid = (droid: string) => {
  insertAtCursor(`@droid:${droid} `);
};

const handleInsertCommand = (command: string) => {
  insertAtCursor(`/${command} `);
};
```

### 4. Add to ChatView footer layout

```tsx
// In ChatView render, find the footer section with ChatInput
<div className="chat-footer">
  {/* Add EquipBar before or after ChatInput */}
  <EquipBar
    skills={skills}
    droids={droids}
    commands={commands}
    onInsertSkill={handleInsertSkill}
    onInsertDroid={handleInsertDroid}
    onInsertCommand={handleInsertCommand}
  />

  <ChatInput
    ref={chatInputRef}
    value={prompt}
    onChange={handlePromptChange}
    onSend={handleSend}
    {...otherProps}
  />
</div>
```

### 5. Update ChatView.css for layout

```css
/* Add to src/components/ChatView.css */
.chat-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
}

/* Ensure EquipBar doesn't shrink */
.equip-bar {
  flex-shrink: 0;
}
```

## Styling Notes

- **Follows brand guidelines:** Orange accent (#f28c52), dark backgrounds
- **Matches existing patterns:** Similar to ChatSettingsMenu styling
- **Responsive:** Text labels hidden on mobile (<768px)
- **No conflicts:** Uses isolated class names (.equip-bar-*)

## Testing Integration

After integration, test these scenarios:

1. **Empty equipment:**
   - Agent with no skills/droids/commands
   - Buttons should be disabled

2. **Insertion:**
   - Click skill → Should insert `@skill:name ` at cursor
   - Click droid → Should insert `@droid:name ` at cursor
   - Click command → Should insert `/command ` at cursor

3. **Popover behavior:**
   - Opens on click (not hover)
   - Closes when clicking outside
   - Closes after selecting item

4. **Mobile:**
   - Buttons show icons only (text hidden)
   - Popovers still work correctly

5. **Long lists:**
   - Popover scrolls if more than ~10 items
   - Scroll styling matches theme

## Related Files to Check

```
src/components/ChatView.tsx          # Where to integrate
src/components/ChatInput.tsx         # May need to pass ref
src/utils/skillsAndDroidsLoader.ts   # Load commands
src/types.ts                         # AgentBundle types
```

## Data Sources

```tsx
// Skills from agent bundle
agent.bundle.skills: string[]
// Example: ["frontend-developer", "backend-engineer"]

// Droids from agent bundle
agent.bundle.protocol_droids: string[]
// Example: ["protocol-droid-1", "protocol-droid-2"]

// Commands from loader
loadAvailableCommands(): string[]
// Example: ["commit", "feature", "background", "code-review"]
```

## Future Enhancements

- [ ] Search/filter for long lists
- [ ] Keyboard navigation (arrow keys + Enter)
- [ ] Recent items section
- [ ] Icons from bundle metadata
- [ ] Tooltips with descriptions
- [ ] Keyboard shortcuts (Cmd+K, etc.)

## Support

- **Component docs:** `src/components/chat/EquipBar.README.md`
- **Design reference:** `src/components/chat/EquipBar.DESIGN.md`
- **Example usage:** `src/components/chat/EquipBar.example.tsx`
- **Tests:** `src/tests/EquipBar.test.tsx`

## Questions?

Contact Agent Jack or refer to:
- CLAUDE.md (project instructions)
- Brand guidelines (orange accent, General Sans, etc.)
- Existing components (ChatSettingsMenu, KanbanTasksBar)

---

**Status:** Ready for integration
**Created:** 2026-01-10
**Component version:** 1.0
**Tests passing:** 6/6
