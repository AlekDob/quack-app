---
type: bug
project: quack-app
created: 2026-01-11
migrated: true
---

# bug-chat-thinking-mode-exit-control

[2026-01-11] Bug: L'utente non può uscire dal thinking mode dicendo 'esci dal thinking' - l'AI continua ad usare extended thinking

[2026-01-11] Root cause: thinkingMode è controllato SOLO da UI dropdown (ChatSettingsMenu.tsx), non modificabile runtime dall'AI

[2026-01-11] Flow: ChatSettingsMenu → ChatContext → ChatView → useClaudeChat → claudeSDK → Rust → Node.js → SDK

[2026-01-11] Fix proposto: Parse del prompt PRIMA dell'invio per pattern come 'esci dal thinking', '/thinking off', 'stop thinking'

[2026-01-11] File chiave: src/components/ChatView.tsx:315,330 - dove sendMessage riceve le options

[2026-01-11] Task assegnato ad Agent Magnus: kanban-1768121658438-p5hhfk
