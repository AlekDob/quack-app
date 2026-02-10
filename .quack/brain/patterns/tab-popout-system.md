---
type: component
project: quack-app
created: 2026-01-08
migrated: true
---

# Tab Popout System

## Sistema Tab Popout

Quack permette di **estrarre tab in finestre separate** per workflow multi-monitor o focus su task specifici.

## Tab Supportati

Possono essere estratti:
- Semantic search
- Preview panels
- Docs viewer
- Custom tabs
- Altri tipi generici

NON possono essere estratti:
- `chat` (tab principale app)
- `kanban` (usa mini-panel invece)
- `task` (displayed inline)

## Deep Linking

Le finestre popout supportano deep linking via query parameters per riaprire la stessa vista al restart.

## Generazione Label Finestra

Formato: `tab-popout-{sanitized-type}-{timestamp}`
Unico per tab per prevenire collisioni.

## State Management

- `PopoutWindowStore` con Zustand
- Storage persistente via Tauri plugin-store
- Tracking posizione/dimensione per finestra

## Testing

- `tabPopout.test.ts` - Coverage completa
- `kanbanPopoutDeepLink.test.ts` - Test deep linking

## File Principali

| File | Ruolo |
|------|-------|
| `TabPopoutWindowApp.tsx` | App finestra popout |
| `tab-popout-entry.tsx` | Entry point |
| `useTabPopoutWindow.ts` | Hook gestione |
| `popoutWindowStore.ts` | Store condiviso |
