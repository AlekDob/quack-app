---
type: mission
slug: integrazione-cursor-cli
status: active
updated: 2026-07-01T12:40:08.404Z
---

# Missione: integrazione-cursor-cli

## Obiettivo

Aggiungere Cursor CLI come provider AI in Quack (Codetta), con streaming in tempo reale, session resume e kill, parallelo a Claude Code.

## Contesto

Cursor CLI (https://cursor.com/cli) supporta --output-format stream-json con formato quasi identico a Claude Code. Buona parte del parser e dell'architettura di claude_code.rs / claudeCode.ts è riutilizzabile. L'utente ha Cursor IDE installato. Verranno supportati sia `cursor-agent` (standalone) che `cursor agent` (sottocomando IDE). Permission: --force default con toggle in Settings.

## Fasi

### 1. Backend Rust: modulo cursor_code.rs
- [x] (w1) Comando cursor_code_check implementato (rileva binario)
- [x] (w2) Comando cursor_code_chat implementato (spawn + stream-json + buffer)
- [x] (w3) Comando cursor_code_kill implementato (kill process group)
- [x] (w4) Registrazione state e comandi in lib.rs

### 2. Frontend TS: provider cursorCode.ts
- [x] (w5) ChatProvider con parser stream-json funzionante
- [x] (w6) Modelli predefiniti (composer, sonnet, gpt-5, etc.)
- [x] (w7) Session resume e kill integrati

### 3. UI: registrazione provider
- [x] (w8) Cursor CLI nella lista provider del ModelBrowser
- [x] (w9) Toggle force-mode in Settings

### 4. Verifica build e smoke test
- [x] (w10) npm run build passa senza errori
- [ ] (w11) Streaming chat funziona in tauri dev
