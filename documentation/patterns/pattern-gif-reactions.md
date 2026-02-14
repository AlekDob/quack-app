---
type: pattern
created: 2026-01-08
---

# GIF Reactions System

Quack mostra **GIF animate** quando Claude usa tool, rendendo l'esperienza piu engaging e visivamente interessante.

## Come Funziona

1. Claude inizia a usare un tool (es. `Read`, `Edit`, `Bash`)
2. Sistema cerca GIF appropriata via Giphy API
3. GIF viene mostrata durante l'esecuzione
4. GIF scompare quando tool completa

## API Key Bundled

La Giphy API key e integrata nell'app - non richiede configurazione utente.

## Layout e Dimensioni

GIF mostrate inline stile WhatsApp: max-width 400px, min-height 150px, max-height 250px, border-radius 16px, glassmorphism con backdrop-blur.

## GIF Solo Landscape

Filtro aspect ratio per selezionare solo GIF orizzontali (aspect ratio minimo: 1.2).

## Sistema di Varieta (anti-ripetizione)

1. Offset casuale (0-49) nella ricerca Giphy
2. Selezione casuale tra GIF landscape trovate
3. Rotazione keyword - traccia ultime 10 usate, preferisce nuove
4. Cache per toolId - stessa GIF per re-render, diversa per nuova invocazione

## Smart Rate Limiting

- Mostra GIF ogni 3 tool consecutivi
- Brain e Agent tools: sempre GIF (importanti)
- Search tools: disabilitati di default

## Toggle per Categoria in Settings

In Settings > General > Chat Experience:
- Brain/Memory Tools - ON
- File Operations (Read, Write, Edit) - ON
- Shell Commands (Bash) - ON
- Search Tools (Grep, Glob, WebSearch) - OFF
- AI Agents (Task) - ON

## Componenti

| File | Ruolo |
|------|-------|
| `giphyService.ts` | Client API Giphy |
| `useToolGifReaction.ts` | Hook reazione tool |
| `ToolGifWidget.tsx` | Widget GIF |
| `ToolGifInline.tsx` | GIF inline nel messaggio |
