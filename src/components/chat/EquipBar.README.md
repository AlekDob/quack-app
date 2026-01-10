# EquipBar Component

**Location:** `/src/components/chat/EquipBar.tsx`
**Status:** Complete - Ready for integration
**Tests:** 6/6 passing

## Overview

EquipBar is a compact equipment picker component for the chat footer that allows users to quickly insert skills, droids, and commands into their prompt. It provides a clean, modern UI with dropdown popovers following Quack's brand guidelines.

## Features

- **Three Equipment Types:**
  - **Skills** - Insert `@skill:name` (e.g., `@skill:frontend-developer`)
  - **Droids** - Insert `@droid:name` (e.g., `@droid:protocol-droid-1`)
  - **Commands** - Insert `/command` (e.g., `/commit`)

- **Smart Behavior:**
  - Auto-disable buttons when no items available
  - Click-to-open popovers (not hover)
  - Click outside to close
  - Auto-close after selection
  - Smooth animations (0.2s ease)

- **Responsive Design:**
  - Mobile-friendly (text labels hidden on small screens)
  - Scrollable popovers for long lists
  - Touch-optimized button sizes

## Component API

```tsx
interface EquipBarProps {
  skills: string[];      // List of skill names
  droids: string[];      // List of droid names
  commands: string[];    // List of command names (without /)
  onInsertSkill: (skill: string) => void;    // Insert @skill:name
  onInsertDroid: (droid: string) => void;    // Insert @droid:name
  onInsertCommand: (command: string) => void; // Insert /command
}
```

## Usage Example

```tsx
import EquipBar from './components/chat/EquipBar';

function ChatFooter() {
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load from agent bundle
  const skills = agent?.bundle?.skills || [];
  const droids = agent?.bundle?.protocol_droids || [];
  const commands = loadAvailableCommands(); // from skillsAndDroidsLoader

  const handleInsertSkill = (skill: string) => {
    insertAtCursor(`@skill:${skill} `);
  };

  const handleInsertDroid = (droid: string) => {
    insertAtCursor(`@droid:${droid} `);
  };

  const handleInsertCommand = (command: string) => {
    insertAtCursor(`/${command} `);
  };

  const insertAtCursor = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    const newValue = value.substring(0, start) + text + value.substring(end);
    setPrompt(newValue);

    // Restore cursor position after insertion
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  return (
    <div className="chat-footer">
      <EquipBar
        skills={skills}
        droids={droids}
        commands={commands}
        onInsertSkill={handleInsertSkill}
        onInsertDroid={handleInsertDroid}
        onInsertCommand={handleInsertCommand}
      />
      <textarea ref={textareaRef} value={prompt} onChange={...} />
      <button onClick={handleSend}>Send</button>
    </div>
  );
}
```

## Design Specifications

### Colors (Brand Guidelines)
- **Accent:** `#f28c52` (orange)
- **Background:** `rgba(18, 20, 27, 0.97)` (dark)
- **Border:** `rgba(255, 255, 255, 0.12)` (subtle)
- **Text:** `rgba(255, 255, 255, 0.65)` (muted)
- **Hover:** Orange accent on buttons and items

### Typography
- **Font:** General Sans (inherited from root)
- **Button Size:** 11px, 500 weight
- **Item Size:** 12px, 400 weight

### Spacing
- **Gap:** 8px between buttons
- **Padding:** 10px horizontal, 32px height for buttons
- **Border Radius:** 6px buttons, 8px popovers

### Icons
- **Type:** SVG stroke-based (no emojis)
- **Size:** 14px for button icons, 12px for item icons
- **Stroke Width:** 2px
- **Icons Used:**
  - Skills: Star
  - Droids: Robot/cog
  - Commands: Terminal prompt

## File Structure

```
src/components/chat/
├── EquipBar.tsx           # Main component
├── EquipBar.css           # Styling (follows brand guidelines)
├── EquipBar.example.tsx   # Usage example with demo
└── EquipBar.README.md     # This file
```

## Testing

**Test File:** `/src/tests/EquipBar.test.tsx`
**Framework:** Vitest + React Testing Library

```bash
# Run EquipBar tests only
npm test -- EquipBar

# Run all tests
npm test
```

**Test Coverage:**
- ✅ Renders all three buttons
- ✅ Opens popover on button click
- ✅ Calls correct callback when clicking items
- ✅ Disables button when no items available
- ✅ Closes popover after item selection
- ✅ Handles empty arrays gracefully

## Integration Checklist

- [ ] Load equipment from agent bundle:
  - `agent.bundle.skills`
  - `agent.bundle.protocol_droids`
  - `loadAvailableCommands()` from skillsAndDroidsLoader

- [ ] Implement insertion handlers:
  - Get textarea ref for cursor position
  - Insert text at cursor (not append)
  - Maintain cursor position after insertion
  - Focus back to textarea after insertion

- [ ] Add to ChatView footer layout:
  - Place before or after ChatInput
  - Ensure proper flex alignment
  - Test with different equipment counts

- [ ] Test scenarios:
  - Empty equipment arrays
  - Long lists (scrolling)
  - Mobile responsive behavior
  - Keyboard navigation (optional)

## Future Enhancements

- **Search/Filter:** Add search input for long lists
- **Keyboard Navigation:** Arrow keys + Enter to select
- **Recent Items:** Show recently used at top
- **Custom Icons:** Load icons from agent bundle metadata
- **Tooltips:** Show descriptions on hover
- **Keyboard Shortcuts:** Cmd+K for skills, etc.

## Notes

- Component is **NOT integrated** into ChatView yet - standalone only
- Follows APATR-D workflow (Analyze → Plan → Act → Test → Review → Document)
- All styling follows existing Quack design patterns
- No external dependencies beyond React
- Fully typed with TypeScript
- Mobile-first responsive design

## Related Files

- `/src/components/ChatView.tsx` - Where this will be integrated
- `/src/components/ChatInput.tsx` - Chat input textarea
- `/src/utils/skillsAndDroidsLoader.ts` - Loads skills/droids/commands
- `/src/types.ts` - Type definitions for agent bundles

## Author

Created by Agent Jack (Product Manager at Quack Agency)
Date: 2026-01-10
Branch: `task/3-7vwmsi-implement-quack-agent-bundles-system`
