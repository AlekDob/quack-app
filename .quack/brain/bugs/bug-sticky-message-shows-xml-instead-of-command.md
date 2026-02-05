---
type: bug
project: quack-app
created: 2026-01-12
migrated: true
---

# bug-sticky-message-shows-xml-instead-of-command

[2026-01-12] **Problema**: Lo sticky message mostrava l'intero XML espanso `<command-context name="task"...>` invece del semplice `/task prompt` quando l'utente scriveva un comando slash.

[2026-01-12] **Causa root**: La funzione `truncateText()` riceveva il contenuto raw del messaggio che includeva l'XML completo del comando espanso, senza alcuna pre-elaborazione.

[2026-01-12] **Soluzione**: Aggiunta funzione `extractOriginalCommand()` in [[ChatMessage.tsx]] che: (1) Rileva se il contenuto contiene `<command-context>`, (2) Estrae il comando originale dopo il separatore `---\n`, (3) Fallback: estrae il nome dal tag XML se non c'e' separatore.

[2026-01-12] **File modificato**: `src/components/ChatMessage.tsx` (righe 238-261 per la funzione, righe 266 e 521 per l'applicazione).

[2026-01-12] **Pattern utilizzato**: Regex extraction con fallback chain - prima cerca il separatore `---\n`, poi estrae dal tag XML, infine ritorna il contenuto originale.

[2026-01-12] **Risultato**: Lo sticky message ora mostra `/task prompt` pulito invece del XML completo, migliorando significativamente la UX.
