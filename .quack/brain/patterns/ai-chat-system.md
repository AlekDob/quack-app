---
type: component
project: quack-app
created: 2026-01-08
migrated: true
---

# AI Chat System

Frontend: ChatView.tsx, ChatInput.tsx (73K LOC), ChatMessage.tsx, AIAssistant.tsx

Service: claudeSDK.ts (26K LOC) - Claude Agent SDK wrapper with streaming

Hook: useClaudeChat.ts (28K LOC) - streaming, tool execution, memory integration

Store: chatStore.ts - chat history, sessions, messages

Features: Real-time streaming, tool call visualization, multi-turn conversations, permissions system

## L'Integrazione con Claude Agent SDK

Quack usa il **Claude Agent SDK 0.2.1** per le conversazioni AI. Non chiamiamo direttamente le API Anthropic - usiamo l'SDK che gestisce:
- Streaming delle risposte
- Esecuzione dei tool
- Gestione del contesto
- Permessi (plan/act/bypass)

## Il Flusso di un Messaggio

1. User scrive nel `ChatInput.tsx`
2. `useClaudeChat.ts` prepara la richiesta
3. `claudeSDK.ts` invoca il Claude CLI via Tauri
4. Le risposte arrivano in streaming
5. `ChatMessage.tsx` renderizza progressivamente
6. I tool calls vengono mostrati in `ToolCallCard.tsx`

## File Critici

| File | LOC | Responsabilita |
|------|-----|----------------|
| `ChatInput.tsx` | 73K | Input, keyboard, attachments |
| `useClaudeChat.ts` | 28K | Hook principale chat |
| `claudeSDK.ts` | 26K | Wrapper Claude CLI |
| `chatStore.ts` | - | History, sessions |

## Tool Visualization

Quando Claude usa un tool, mostriamo widget dedicati:
- **Read**: Preview del file
- **Edit**: Diff del cambiamento
- **Bash**: Output del comando
- **Brain**: Entity creata/cercata

## Memory Integration

Il chat e integrato con il Second Brain:
- Cerca automaticamente memorie rilevanti
- Puo salvare nuove memorie durante la conversazione
- L'hook `memoryIntegration.ts` gestisce l'iniezione nel prompt
