---
type: gotcha
project: quack-app
created: 2026-05-31
last_verified: 2026-05-31
tags: [embedded-cli, xterm, keyboard-shortcuts, regression, ws8, cmd-t]
---
# Embedded CLI xterm blocca TUTTI gli shortcut globali (Cmd+T non apre più)

## Sintomo
Dopo il pivot embedded CLI (WS8), Cmd+T (apri finestra terminale) e in generale
**tutti** gli shortcut globali dell'app smettono di funzionare mentre una sessione è
aperta.

## Causa
`useGlobalKeyboardShortcuts.ts` faceva early-return su `isEditableElement(e.target)`,
che includeva `target.closest('.xterm')`. L'embedded CLI (`AgentTerminalView`) è ora il
**centro permanente e tiene il focus** → ogni keydown ha `e.target` dentro `.xterm` →
early-return → nessuno shortcut viene mai processato.

Doppia trappola: l'input di xterm passa per una `<textarea class="xterm-helper-textarea">`
interna, quindi veniva bloccato ANCHE dal check generico `tagName === 'textarea'`.

## Fix
In `src/hooks/useGlobalKeyboardShortcuts.ts`:
- Rimosso `.xterm` da `isEditableElement` (resta `.cm-editor` + input/textarea/contenteditable).
- In `handleKeyDown`, gestione esplicita del terminale PRIMA del check editable:
  - `inTerminal = target.closest('.xterm')`.
  - Se `inTerminal` e NESSUN modificatore Cmd/Ctrl → return (è digitazione nel terminale).
  - Se `inTerminal` con Cmd/Ctrl → si procede al matching: solo gli shortcut REGISTRATI
    fanno `preventDefault`+azione; le combo non registrate (Ctrl+C, Cmd+V, …) NON fanno
    `preventDefault` → passano intatte al terminale.

KEY INSIGHT: il `preventDefault` scatta solo su match → si può lasciar "passare" il
matching nel terminale senza rubare i tasti di controllo (Ctrl+C) né copia/incolla.

## File
- `src/hooks/useGlobalKeyboardShortcuts.ts` (isEditableElement + handleKeyDown)

Brain: 069-embedded-cli-hooks-pivot
