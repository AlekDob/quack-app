---
type: feature-doc
project: quack-20
stack: Electron / React (Vite) / TypeScript
created: 2026-08-06
startDate: 2026-08-06
endDate: 2026-08-06
last_verified: 2026-08-06
status: active
tags: [linear, deep-link, projects, desktop, composer]
---

## Aprire una issue Linear nel progetto Quack giusto

**Scopo:** il link `quack://open` accettava solo il prompt, quindi la chat nasceva sempre dove capitava. Ora accetta anche un progetto di destinazione, così una issue del progetto Linear "Realizzazione Esopo con Modulo gare" apre una chat dentro il progetto Quack Esopo.

Il parametro è opzionale. Se manca, o se non corrisponde a nessun progetto, il comportamento è identico a prima: si apre una chat normale.

### Il link

```text
quack://open?source=linear&prompt={{prompt}}&project={{project}}
```

`project` accetta tre forme, provate in quest'ordine:

1. l'id del progetto Quack
2. il path assoluto del workspace
3. il nome — `name`, `localName`, `folderName` o `remoteName`

Il confronto ignora maiuscole/minuscole e lo slash finale. `"  ESOPO  "` e `/Users/me/dev/esopo/` trovano entrambi il progetto Esopo.

### Cosa è stato aggiunto

| Area      | File                                        | Funzione                                                         |
| --------- | ------------------------------------------- | ---------------------------------------------------------------- |
| Contratti | `packages/contracts/src/ipc.ts`             | Campo opzionale `project` su `ExternalPromptRequest`             |
| Desktop   | `apps/desktop/src/externalPromptLink.ts`    | Parsing e validazione di `project`, limite 1 KiB                 |
| Desktop   | `apps/desktop/src/preload.ts`               | Pass-through del campo verso il renderer                         |
| Web       | `apps/web/src/lib/externalPromptProject.ts` | `resolveExternalPromptProjectId` — mappa l'hint a un `ProjectId` |
| Web       | `apps/web/src/routes/_chat.tsx`             | Usa `handleNewThread(projectId)` quando l'hint corrisponde       |
| Script    | `scripts/open-linear-in-quack.mjs`          | Estrae progetto/team dal prompt e li mappa                       |
| Docs      | `docs/linear-coding-tools.md`               | Setup del mapping per l'utente                                   |

### Flusso

```
Linear (Custom script)
  └─ LINEAR_PROMPT contiene <team name="…"/> e <project name="…"/>
       └─ open-linear-in-quack.mjs
            ├─ legge ~/.quack/linear-projects.json
            ├─ risolve: QUACK_PROJECT → nome progetto → nome team → "default"
            └─ apre quack://open?source=linear&prompt=…&project=esopo
                 └─ externalPromptLink.parseExternalPromptLink (validazione)
                      └─ IPC desktop:external-prompt → preload → _chat.tsx
                           ├─ resolveExternalPromptProjectId(projects, hint)
                           ├─ match → handleNewThread(projectId)
                           └─ nessun match → startFreshChatForActiveSurface()
                                └─ setPrompt(threadId, "Source: Linear\n\n…")
```

Il prompt resta una bozza. Quack non lo invia mai da solo.

### Il mapping

Il file sta sulla macchina dell'utente, non nel repo. Quack non lo legge: lo legge lo script.

`~/.quack/linear-projects.json`:

```json
{
  "Realizzazione Esopo con Modulo gare": "esopo",
  "Esopo": "esopo",
  "default": "quack-20"
}
```

Le chiavi sono nomi Linear (progetto o team) più la chiave speciale `default`. I valori sono nomi, id o path di progetti Quack.

Ordine di lookup nello script:

1. variabile d'ambiente `QUACK_PROJECT`, se impostata
2. il nome del progetto Linear letto dal prompt
3. il nome del team Linear letto dal prompt
4. la chiave `default`

Se il file non esiste, o è JSON non valido, lo script non fallisce: omette il parametro e la chat si apre come prima.

### Validazione

Il desktop scarta il link se:

- ci sono chiavi diverse da `source`, `prompt`, `project`
- `project` compare più di una volta
- `project` supera 1 KiB in UTF-8 (`MAX_EXTERNAL_PROJECT_BYTES`)

Un `project` vuoto o fatto di soli spazi viene trattato come assente, non come errore. Il campo viene omesso invece di essere passato come stringa vuota, perché `exactOptionalPropertyTypes` è attivo in `tsconfig.base.json`.

### Note

- `handleNewThread` fa reject se la navigazione verso la nuova rotta non va a buon fine. Il ramo con progetto ha un handler di rejection che rispecchia il try/catch di `startContainerChat`, altrimenti un hint valido ma con navigazione fallita produrrebbe una unhandled rejection e nessun toast.
- La risoluzione avviene nel renderer, non nel processo main: solo il renderer conosce la lista dei progetti.
- Il match per id viene prima del match per nome. Un progetto chiamato come l'id di un altro non lo può dirottare.

### Test

| File                                             | Copertura                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------- |
| `apps/desktop/src/externalPromptLink.test.ts`    | Accetta `project`, rifiuta duplicati e oversize, omette se vuoto |
| `apps/web/src/lib/externalPromptProject.test.ts` | Match per id/nome/folder/path, precedenza id, nessun match       |
