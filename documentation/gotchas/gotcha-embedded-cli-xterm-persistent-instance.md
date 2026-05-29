---
type: gotcha
project: quack-app
created: 2026-05-29
last_verified: 2026-05-29
tags: [xterm, terminal, strictmode, react, pty, embedded-cli, ws8]
---

# Embedded CLI: l'xterm DEVE essere un'istanza persistente (Map globale), non ricreata a ogni mount

## Sintomo

Il terminale embedded (`AgentTerminalView`) appare **vuoto col solo cursore in alto a sinistra** quando apri una nuova sessione. Il sizing e' corretto (es. `client=620x726`, `proposeDimensions=71x45`, fit `ok=true`) ma **non c'e' nessun output**: niente prompt della shell, niente claude. A volte "funziona" e a volte no (intermittente).

## Causa

`AgentTerminalView` creava `new Terminal()`, faceva `term.open()` e `term.dispose()` **dentro lo `useEffect`**, cioe' un xterm nuovo a ogni mount. Con **React StrictMode** (attivo in `src/main.tsx`) ogni `useEffect` gira **mount → unmount → remount**:

1. **mount1** crea il PTY (`create_agent_terminal`), apre l'xterm, aggancia il listener `terminal-data`. La shell emette subito il prompt → evento `terminal-data` emesso.
2. **cleanup1** (StrictMode) fa `term.dispose()` + unlisten. **Il prompt ricevuto dal mount1 sparisce con l'xterm distrutto.**
3. **mount2** vede `terminal_exists=true` (PTY persiste), crea un **nuovo** xterm e aggancia un **nuovo** listener — ma il prompt e' gia' stato emesso durante il mount1 → **gli eventi Tauri NON sono bufferizzati/rigiocati** → il nuovo xterm non riceve mai il prompt → resta vuoto.

(Lo stesso accade ai cambi-tab: distruggere l'xterm perde lo stato renderizzato della TUI di claude, che ridipinge solo su input/resize.)

## Fix

Adottare lo **stesso pattern del terminale normale di Quack** (`XTermInstance.tsx`): persistere l'istanza xterm in una **Map a livello di modulo** keyed per `terminalId`.

```ts
const agentTerminalInstances = new Map<string, AgentTermInstance>(); // term + addons + unlisten
const initInFlight = new Map<string, Promise<void>>(); // anti-race sui due mount StrictMode
```

Regole:

- **Mai** `term.dispose()` / unlisten nel cleanup dello `useEffect`. Il cleanup disconnette solo ResizeObserver + window-resize.
- Su (re)mount: se l'istanza esiste in Map → **ri-aggancia** il DOM (`container.appendChild(inst.term.element)`), `fit()`, `term.refresh(0, rows-1)`, `focus()`. Altrimenti creala una sola volta.
- `term.open()` va fatto sul container **corrente e in-DOM** (al primo riuso), non su un nodo potenzialmente staccato.
- Guard `initInFlight` (Promise per id) cosi' i due mount sovrapposti di StrictMode non creano due PTY/xterm per lo stesso id (il perdente leakerebbe e ruberebbe i `terminal-data`).
- Teardown reale solo via `disposeAgentTerminal(sessionId)` esplicito (chiusura tab/sessione), che fa dispose + `close_terminal`.

## Lezione

Gli **eventi Tauri non sono bufferizzati**: chi si aggancia dopo l'emissione perde i dati. Per terminali/PTY embedded l'istanza xterm va **tenuta viva oltre il ciclo di vita del componente React**, mai distrutta e ricreata. Il ring buffer Rust (`read_terminal_output`) ritorna **righe**, inutile per rigiocare una TUI cursor-addressed come claude.

Vedi anche [[gotcha-embedded-cli-xterm-pty-resize-sync]] (sizing PTY↔xterm) e [[gotcha-tauri-listener-strict-mode-double-fire]].
