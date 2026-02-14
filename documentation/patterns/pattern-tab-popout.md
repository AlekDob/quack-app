---
type: pattern
created: 2026-01-08
---

# Tab Popout System

Quack permette di estrarre tab in finestre separate per workflow multi-monitor o focus su task specifici.

## Tab Supportati

Possono essere estratti: Semantic search, Preview panels, Docs viewer, Custom tabs, altri tipi generici.

NON possono essere estratti: `chat` (tab principale app), `kanban` (usa mini-panel), `task` (displayed inline).

## Deep Linking

Le finestre popout supportano deep linking via query parameters per riaprire la stessa vista al restart.

## Generazione Label Finestra

Formato: `tab-popout-{sanitized-type}-{timestamp}` -- unico per tab per prevenire collisioni.

## State Management

- `PopoutWindowStore` con Zustand
- Storage persistente via Tauri plugin-store
- Tracking posizione/dimensione per finestra

## File Principali

| File | Ruolo |
|------|-------|
| `TabPopoutWindowApp.tsx` | App finestra popout |
| `tab-popout-entry.tsx` | Entry point |
| `useTabPopoutWindow.ts` | Hook gestione |
| `popoutWindowStore.ts` | Store condiviso |
