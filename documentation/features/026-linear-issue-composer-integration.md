---
type: feature-doc
project: quack-20
stack: Effect / Node.js / React (Vite) / TypeScript
created: 2026-08-14
startDate: 2026-08-14
endDate: 2026-08-14
last_verified: 2026-08-14
status: active
tags: [linear, composer, mention, settings, secrets, websocket]
---

## Integrazione Linear nel composer (ALE-28)

**Scopo:** prima, lavorare su un ticket Linear voleva dire uscire da Quack, copiare
codice e titolo a mano, e rinominare la sessione da soli. Ora scrivendo `@` nel
composer compaiono i propri ticket Linear aperti; sceglierne uno rinomina la
sessione come `ALE-28 Titolo`. Se il ticket non esiste ancora, si crea da lì
(titolo + team + progetto).

Deciso con l'utente, per scelta e non per dimenticanza:

- Auth: API key personale in Settings, non OAuth.
- Selezionare un ticket = **solo** rinomina sessione. Niente branch/worktree da
  `gitBranchName`, niente prompt precompilato, niente scrittura di stato o
  assegnatario su Linear.
- Creazione ticket: form minimo, titolo + team + progetto opzionale.
- Elenco: solo ticket non `completed`/`canceled` (backlog, triage, unstarted, started).

Vedi anche [018-linear-project-routing.md](018-linear-project-routing.md): quella
feature instrada il deep-link `quack://open?source=linear` verso il progetto Quack
giusto. Questa è indipendente — nessuna delle due tocca il codice dell'altra.

### File

| Area      | File                                                          | Scopo                                                            |
| --------- | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Contratti | `packages/contracts/src/linear.ts`                             | `LinearIssue`, `LinearTeam`, `LinearProject`, `LinearCreateOptions`, input schemas |
| Contratti | `packages/contracts/src/settings.ts`                            | `LinearServerSettings.apiKeyConfigured` in `ServerSettings`/patch |
| Contratti | `packages/contracts/src/ws.ts`, `rpc.ts`, `ipc.ts`              | 3 metodi WS: `linear.searchIssues`, `linear.listCreateOptions`, `linear.createIssue` |
| Server    | `apps/server/src/linear/linearCredentials.ts`                   | Legge/scrive la API key nel secret store (mai in `settings.json`) |
| Server    | `apps/server/src/linear/linearClient.ts`                        | Client GraphQL minimale su `fetchJson`, origin pinnata `api.linear.app` |
| Server    | `apps/server/src/linear/linearClient.test.ts`                   | Copre il filtro stato e la mappatura errori 401             |
| Server    | `apps/server/src/serverSettings.ts`                             | Split segreto/patch, `withCredentialState` calcola `apiKeyConfigured` |
| Server    | `apps/server/src/wsRpc.ts`                                      | Handler dei 3 metodi, `withLinearApiKey` per il messaggio "connetti Linear" |
| Server    | `apps/server/src/wsRequestAdmission.ts`                         | `searchIssues`/`listCreateOptions` in `EXPENSIVE_READ_METHODS`    |
| Web       | `apps/web/src/components/settings/LinearSettingsPanel.tsx`      | Campo API key in Settings → Integrations                          |
| Web       | `apps/web/src/lib/linearReactQuery.ts`                          | Query options per issues/createOptions + `createLinearIssue`      |
| Web       | `apps/web/src/hooks/useComposerCommandMenuItems.ts`             | Costruisce le voci `linear-issue`/`linear-create` del menu `@`    |
| Web       | `apps/web/src/components/chat/ComposerCommandMenu.tsx`          | Icone, gruppo "Linear", testo secondario (stato/progetto)         |
| Web       | `apps/web/src/components/chat/LinearCreateIssueDialog.tsx`      | Dialog titolo + select team + select progetto                     |
| Web       | `apps/web/src/components/ChatView.tsx`                          | Query Linear, `renameThreadToLinearIssue`, selezione nel menu `@` |

### Flusso dati

`@ale` nel composer → `linearIssuesQueryOptions` (debounced sulla query mention) →
`linear.searchIssues` via WS → `apps/server/src/linear/linearClient.ts` →
`issues`/`searchIssues` GraphQL con `filter: { state: { type: { nin: ["completed","canceled"] } } }`
→ lista mappata in `ComposerCommandItem` di tipo `linear-issue`.

Selezione ticket → `dispatchThreadRename({ newTitle: "${identifier} ${title}" })` —
stesso percorso usato da rinomina manuale e kanban, **nessun** testo inserito nel
composer.

"New Linear issue" → `LinearCreateIssueDialog` → `linear.createIssue` →
`createLinearIssue` (client) → stesso `renameThreadToLinearIssue` sul ticket appena
creato.

### Auth e sicurezza

La API key vive solo nel secret store del server (`~/.synara/userdata/secrets/`,
0600), esattamente come le altre credenziali provider. `settings.json` porta solo
`linear.apiKeyConfigured: boolean`. Le chiamate HTTP passano da `fetchJson`
(`apps/server/src/providerUsage/http.ts`) con allowlist esatta su
`https://api.linear.app`, niente redirect.

**Gotcha:** `readLinearApiKey`/`writeLinearApiKey`/`isLinearApiKeyConfigured`
prendono `ServerSecretStoreShape` come **parametro**, non come dipendenza Effect
(`R`). Se tornassero `Effect` con requirement `ServerSecretStore`, quel requirement
risalirebbe fino a `ServerSettingsShape.start`/`updateSettings` e rompe il
typecheck (`Effect<..., ServerSecretStore>` non assegnabile a `Effect<..., never>`).

### Cosa NON fa (per scelta, non per dimenticanza)

- Nessuna colonna nuova su `projection_threads`: il legame col ticket vive solo nel
  titolo della sessione.
- Nessuna scrittura di stato/assegnatario su Linear, nessun branch da `gitBranchName`,
  nessuna descrizione del ticket iniettata nel prompt.
- Il title probe automatico non è stato toccato: rinomina solo titoli ancora
  generici, quindi la rinomina manuale da ticket lo disattiva di per sé — verificato
  a mano, non da un guard esplicito nel codice.
