---
type: gotcha
project: quack-app
created: 2026-05-29
last_verified: 2026-05-29
tags: [xterm, pty, terminal, resize, claude-cli, embedded-cli, fit-addon, resizeobserver, tui, garbling]
---

# Embedded CLI TUI garbling: xterm ↔ PTY size must be locked via ResizeObserver

## Sintomo
Eseguendo la CLI interattiva di `claude` (TUI full-screen, Ink) dentro un terminale xterm embedded (`AgentTerminalView`, feature 069), l'output appariva **a pezzi**: colonne di singoli caratteri ai bordi sinistro/destro, frammenti tipo "to paste" che vanno a capo, status bar spezzata, e **prompt/cornici duplicate** dopo un resize della finestra. Il primo paint a volte era pulito, poi degradava durante lo streaming o al resize.

## Causa
La TUI di `claude` ridisegna muovendo il cursore e assume che la **larghezza del terminale (cols) sia esattamente quella che gli ha comunicato il PTY**. Se xterm e PTY hanno dimensioni diverse anche di 1-2 colonne, ogni repaint si disallinea → garbling. I trigger del disallineamento:
1. **PTY spawnato a 24×80 fisso**, poi xterm fa il `fit()` alla dimensione reale → resize → la app ridisegna lasciando la cornice vecchia (duplicato).
2. **Scrollbar xterm** che compare quando il contenuto riempie lo schermo → `clientWidth` cala di ~2 colonne **senza** un refit → `claude` continua a disegnare alla larghezza vecchia → sfora.
3. **Resize finestra/pannello durante lo streaming** → se non risincronizzi il PTY, mismatch.

## Soluzione (pattern proven, da spaceship-ai)
Tenere **PTY e xterm bloccati alla stessa dimensione in ogni istante** con un `ResizeObserver` sul container che, ad ogni cambio, fa `fit()` + invia la nuova size al PTY:

```ts
const term = new Terminal({ allowProposedApi: true, /* ... */ });
const fit = new FitAddon();
term.loadAddon(fit);
term.open(container);

const syncResize = () => {
  fit.fit();
  const dims = fit.proposeDimensions();      // richiede allowProposedApi:true
  if (dims) invoke('resize_terminal', { id, cols: dims.cols, rows: dims.rows });
};

const ro = new ResizeObserver(() => syncResize());
ro.observe(container);
setTimeout(syncResize, 60);                  // fit iniziale dopo il layout
```

Più, in supporto:
- **Scrollbar a larghezza 0** (`.xterm-viewport::-webkit-scrollbar{width:0}`) → `clientWidth` costante, niente perdita di colonne quando appare la scrollbar.
- **Container** `flex:1; minHeight:0; position:relative; overflow:hidden; flexDirection:column` (identico al wrapper del terminale normale di Quack).
- **`clear &&` prima di lanciare la CLI** → pulisce il prompt che la login-shell ridisegna sul SIGWINCH del fit iniziale (artefatto "doppio prompt").
- Su re-mount di un PTY già vivo, **un `syncResize()` extra** fa repaintare la TUI al frame corrente.

## Cosa NON fare
- **NON stimare cols/rows a mano** (es. `width/8.43`) per spawnare il PTY: la stima sbaglia di qualche colonna e introduce un mismatch **peggiore**. Lascia spawnare a 24×80 e fai sincronizzare al `ResizeObserver` (la app riflowa correttamente perché le size restano coerenti).
- Il vecchio `XTermInstance.tsx` di Quack **non ha** un ResizeObserver (solo fit su attivazione + window resize) → per questo i terminali normali mostrano il duplicato al resize. `AgentTerminalView` è autonomo e implementa il pattern corretto; `XTermInstance` resta invariato per non toccare i terminali esistenti.

## Riferimenti
- Reference funzionante: `spaceship-ai/app/src/features/terminal/TerminalInstance.tsx`
- Implementazione Quack: `src/components/AgentTerminalView.tsx` + `AgentTerminalView.css`
- Feature: `documentation/features/069-embedded-cli-hooks-pivot.md`
