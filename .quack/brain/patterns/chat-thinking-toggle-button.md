---
type: component
project: quack-app
created: 2026-01-11
migrated: true
---

# chat-thinking-toggle-button

Brain icon toggle in chat footer for quick thinking mode control

Location: src/components/ChatView.tsx lines 600-619

Styling: src/components/ChatView.css lines 27-70 (.chat-thinking-toggle)

Visual states: gray when inactive (auto), purple glow when active (think/hard/harder/ultra)

Purple color: rgba(167, 139, 250, x) matching Quack brand

Toggles between 'auto' (off) and 'think' (on) on click

Replaces the THINKING dropdown that was removed from ChatSettingsMenu

SVG brain icon with lightbulb-style design
