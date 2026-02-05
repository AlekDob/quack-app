---
type: bug
project: quack-app
created: 2026-01-11
migrated: true
---

# bug-chat-thinking-mode-prompt-control

[2026-01-11] Bug: User cannot exit thinking mode by saying 'esci dal thinking' - AI continues using extended thinking

[2026-01-11] Root cause: thinkingMode controlled ONLY by UI dropdown (ChatSettingsMenu.tsx), not modifiable at runtime

[2026-01-11] Fix: Added parseThinkingControl() function in useClaudeChat.ts that parses prompt BEFORE sending to SDK

[2026-01-11] Patterns supported: Italian (esci dal thinking, disattiva thinking, attiva thinking) and English (stop thinking, disable thinking, /thinking off)

[2026-01-11] Implementation: Parse prompt → detect control patterns → override thinkingMode before calling streamClaudeMessage()

[2026-01-11] Test coverage: 31 tests in thinkingModeControl.test.ts covering disable/enable patterns in IT/EN, slash commands, case insensitivity

[2026-01-11] Extended fix: Added purple brain icon toggle button in chat footer (chat-view-footer-controls). Icon lights up purple when thinking is active. Click to toggle between 'auto' (off) and 'think' (on). CSS class: .chat-thinking-toggle with .active state. Files: ChatView.tsx:600-619, ChatView.css:27-70
