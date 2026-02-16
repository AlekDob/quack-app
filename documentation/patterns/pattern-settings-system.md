---
type: pattern
created: 2026-01-08
---

# Settings System

Quack ha un pannello settings completo con 13+ categorie per configurare ogni aspetto dell'app.

## Categorie Settings

| Categoria | File | Contenuto |
|-----------|------|-----------|
| General | `GeneralSettings.tsx` | Preferenze base |
| Claude Code | `ClaudeCodeSettings.tsx` | Config Claude CLI |
| AI Assistant | `AIAssistantSettings.tsx` | Modello, permessi |
| Agent Modes | `AgentModesSettings.tsx` | Modalita agente |
| Second Brain | `SecondBrainSettings.tsx` | Vault, sync, embeddings |
| IDE | `IDESettings.tsx` | Selezione IDE, integrazione |
| License | `LicenseSettings.tsx` | Attivazione licenza |
| Notifications | `NotificationSettings.tsx` | Preferenze notifiche |
| Appearance | `AppearanceSettings.tsx` | Tema, sfondi |
| Terminal | `TerminalSettings.tsx` | Font, colori terminal |
| Keyboard | `KeyboardShortcutsSettings.tsx` | Shortcut custom |
| Debug | `DebugSettings.tsx` | Opzioni sviluppatore |
| About | `AboutSettings.tsx` | Info versione |

## Architettura UI

```
UnifiedSettings.tsx
├── SettingsSidebar.tsx (navigazione)
└── SettingsContent.tsx (contenuto dinamico)
    └── [CategorySettings].tsx
```

## File Principali

| File | Ruolo |
|------|-------|
| `UnifiedSettings.tsx` | Container principale |
| `SettingsSidebar.tsx` | Menu laterale |
| `settingsStore.ts` | Persistenza stato |
