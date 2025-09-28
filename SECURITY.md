# Sicurezza di Quack

Questo documento riassume minacce, superfici d’attacco e misure di mitigazione.

## Superficie
- PTY locale: esecuzione shell dell’utente
- File system: lettura contenuti per anteprima
- Git: invocazione CLI locale
- HTTP locale: server Axum su 127.0.0.1:6768
- Notifiche OS: permessi runtime

## Principi
- Nessun networking esterno di default
- Hook solo loopback (127.0.0.1)
- Minimo indispensabile di privilegi e permessi
- Nessuna persistenza di segreti/credenziali

## Dettagli
- PTY
  - Spawna la shell definita in `SHELL` o `/bin/bash`
  - Output inoltrato come testo; nessuna interpretazione lato app
  - Chiusura processo con `kill` + `wait`; stato propagato via `terminal-exit`
- File system
  - `read_file_content`: limite 5MB; rifiuta directory
  - `list_directory`: percorso canonico, nessuna esecuzione
- Git
  - Usa il binario `git` della macchina; errori mostrati all’utente
  - Root repo trovata risalendo da `current_dir`; non attraversa confini non git
- HTTP hook
  - Solo `POST /terminal/status` su loopback
  - Input validato: `status` ∈ {busy,idle}; `id`/`label` opzionali ma non vuoti
  - Emissione evento solo in caso di input valido
- Notifiche
  - Richiesta permesso runtime; fallback silenzioso se negato

## Configurazioni consigliate
- Produzione: impostare CSP in `tauri.conf.json` (se si abilita contenuto remoto)
- Log: limitare a info in dev, ridurre verbosità in prod
- Firma & notarizzazione: seguire linee guida Tauri per i rilasci

## Minacce note e mitigazioni
- Processi malevoli avviati dall’utente nel PTY → confinati all’utente stesso (nessun privilegio elevato)
- Attacchi CSRF sull’hook: non esposto su interfacce di rete esterne; comunque accetta solo payload semplici e non muta filesystem
- DOS locale via flood eventi → gli eventi non scrivono su disco; UI resta responsiva, ma in futuro si può introdurre rate‑limit

## Disclosure
Se rilevi vulnerabilità, apri un canale privato con i maintainer o invia una email (TBD). Evita di aprire issue pubbliche con dettagli di exploit.
