---
type: bug
project: quack-app
created: 2026-01-11
migrated: true
---

# bug-thinking-mode-no-runtime-control

[2026-01-11] BUG: User couldn't exit thinking mode by saying 'esci dal thinking mode' - AI continued using extended thinking

[2026-01-11] ROOT CAUSE: thinkingMode controlled ONLY by UI dropdown (ChatSettingsMenu), passed to SDK BEFORE AI responds

[2026-01-11] FLOW: UI dropdown → agentChatSettings → sendMessage({ thinkingMode }) → SDK - AI cannot intervene

[2026-01-11] FIX 1: Added parseThinkingControl() in useClaudeChat.ts that parses prompt BEFORE SDK invocation

[2026-01-11] FIX 2: Added brain icon toggle button in chat footer with purple glow when active

[2026-01-11] FIX 3: Removed redundant THINKING dropdown from ChatSettingsMenu.tsx

[2026-01-11] Files modified: useClaudeChat.ts, ChatView.tsx, ChatView.css, ChatSettingsMenu.tsx
