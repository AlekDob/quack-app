---
type: feature-doc
project: quack-20
stack: Effect / Node.js / React (Vite) / TypeScript
created: 2026-08-14
startDate: 2026-08-14
endDate:
last_verified: 2026-08-18
status: active
tags: [linear, composer, mention, settings, secrets, websocket, environment]
---

## Integrazione Linear nel composer (ALE-28)

**Scopo:** `@` nel composer elenca i ticket Linear aperti. Sceglierne uno inserisce un chip `@"ALE-22 Kanban"` (path `linear://ALE-22`) e, in base alle Settings, può rinominare la chat. `@+` mette **New Linear issue** in cima. I ticket citati compaiono anche nel pannello Environment.

**Stack:** React / TypeScript (`apps/web`) + Node (`apps/server`) + shared (`packages/shared`)

Deciso con l'utente:

- Auth: API key personale in Settings → Linear, non OAuth.
- Il ticket vive nelle `mentions` del composer/messaggio, come file e chat. Nessuna colonna SQLite nuova.
- Rinomina chat: `linearRenameChat` = `ask` (default) / `always` / `never`.
- Nessuna scrittura di stato, assegnatario o branch su Linear.

Vedi [018-linear-project-routing.md](018-linear-project-routing.md) per il deep-link `quack://open?source=linear`. Indipendente da questa feature.

Diario: [2026-08-18](../diary/2026-08-18.md) (chip + Environment + `@+`); [2026-08-14](../diary/2026-08-14.md) (prima integrazione, solo rinomina).

### Files

| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Util | `packages/shared/src/linearMentions.ts` | `linear://ALE-22` path helpers + public issue URL |
| Test | `packages/shared/src/linearMentions.test.ts` | Round-trip identifier / reject `plugin://linear` |
| Config | `packages/shared/package.json` | Export `@synara/shared/linearMentions` |
| Model/Type | `packages/contracts/src/linear.ts` | `LinearIssue` (`identifier`, `title`, `url`, …) |
| Model/Type | `packages/contracts/src/settings.ts` | `linear.apiKeyConfigured` |
| Contratti | `packages/contracts/src/ws.ts`, `rpc.ts`, `ipc.ts` | `linear.searchIssues`, `linear.listCreateOptions`, `linear.createIssue` |
| Service | `apps/server/src/linear/linearCredentials.ts` | API key nel secret store, mai in `settings.json` |
| Service | `apps/server/src/linear/linearClient.ts` | GraphQL `fetchJson`, origin `api.linear.app` |
| Test | `apps/server/src/linear/linearClient.test.ts` | Filtro stato + errori 401 |
| Service | `apps/server/src/serverSettings.ts` | `apiKeyConfigured` |
| Service | `apps/server/src/wsRpc.ts` | Handler WS + `withLinearApiKey` |
| Config | `apps/web/src/appSettings.ts` | `linearRenameChat`, `showEnvironmentLinear` |
| Util | `apps/web/src/lib/composerMentions.ts` | Chip kind `"linear"`; token keys include identifier |
| Util | `apps/web/src/lib/linearIssueUrls.ts` | Cache URL dal picker; fallback `https://linear.app/issue/<id>` |
| Hook | `apps/web/src/hooks/useComposerCommandMenuItems.ts` | Voci menu; `linearComposerCreateQuery` per `@+` |
| Component | `apps/web/src/components/chat/ComposerCommandMenu.tsx` | Icona Central `linear`; gruppo Linear in cima se create è primo |
| Component | `apps/web/src/components/chat/MentionChipIcon.tsx` | Icona Linear su chip composer/messaggio |
| Component | `apps/web/src/components/chat/InlineMentionChip.tsx` | Label = nome; click apre Linear |
| Component | `apps/web/src/components/composer-nodes/index.tsx` | Label chip Lexical per kind `linear` |
| Component | `apps/web/src/components/chat/LinearCreateIssueDialog.tsx` | Crea ticket e lo inserisce nel composer |
| Component | `apps/web/src/components/ChatView.tsx` | Insert mention, Ask/Always/Never, Environment mentions |
| Component | `apps/web/src/components/settings/LinearSettingsPanel.tsx` | API key + rinomina Ask/Always/Never |
| Component | `apps/web/src/components/chat/environment/EnvironmentLinearSection.tsx` | Righe uniche `linear://` da draft + messaggi user |
| Component | `apps/web/src/components/chat/environment/EnvironmentPanel.tsx` | Sezione Linear dopo PR |
| Route/Page | `apps/web/src/routes/_chat.settings.tsx` | Toggle Environment → Linear |
| Config | `apps/web/src/settingsNavigation.ts` | Sezione Settings `linear` |
| Config | `apps/web/src/settingsSearchIndex.ts` | Search: Issues, API key, rename, Environment Linear |
| Util | `apps/web/src/composer-editor-mentions.ts` | Segment kind `linear` da mention refs |
| Test | `apps/web/src/lib/composerMentions.test.ts` | `resolveMentionChipKind("linear")` resta `"path"` senza ref `linear://` |
| Test | `apps/web/src/composer-editor-mentions.test.ts` | `@linear` plugin vs `@"ALE-22 Kanban"` linear |
| Test | `apps/web/src/components/chat/environment/EnvironmentLinearSection.test.ts` | Dedup per identifier |
| Test | `apps/web/src/components/chat/ComposerCommandMenu.test.ts` | `@+` alza il gruppo Linear |
| Test | `apps/web/src/hooks/useComposerCommandMenuItems.test.ts` | `linearComposerCreateQuery` |

### Data Flow

`@` / `@ale` → `linearIssuesQueryOptions` → `linear.searchIssues` → GraphQL (stati non completed/canceled) → voci `linear-issue`.

Pick issue → token `formatComposerMentionToken(name)` + mention `{ name, path: linear://ALE-22 }` → chip. Poi `linearRenameChat`: `always` rinomina; `never` no; `ask` → AlertDialog Rename / Keep title.

`@+` / `@+Kanban` → `linearComposerCreateQuery` → create come prima voce; search Linear usa il testo dopo `+`.

"New Linear issue" → dialog → `linear.createIssue` → stesso insert chip + policy rinomina.

Chip click → `issue.url` se ancora in cache di sessione, altrimenti `https://linear.app/issue/ALE-22`.

Environment: draft `selectedComposerMentions` + `message.mentions` user (incluso optimistic) → `collectLinearEnvironmentItems` → righe; click usa il browser in-app.

### Key Functions

- `linearMentionPathForIdentifier(id: string) → string` — `linear://ALE-22`
- `identifierFromLinearMentionPath(path: string) → string | null` — null su `plugin://linear…`
- `linearComposerCreateQuery(query: string) → string | null` — `@+` shortcut; resto = titolo
- `resolveMentionChipKind(path, options) → MentionChipKind` — `"linear"` solo con path `linear://` o ref; `"linear"` nudo resta file/plugin
- `collectLinearEnvironmentItems(mentions) → LinearEnvironmentItem[]` — unique per identifier
- `rememberLinearIssueUrl(id, url) → void` — cache in memoria, persa al reload

### State

- `linearRenameChat`: `"ask" | "always" | "never"` — default `ask` (local AppSettings)
- `showEnvironmentLinear`: boolean — default `true` (local AppSettings)
- `pendingLinearRename`: `LinearIssue | null` — dialog Ask (component ChatView)
- `rememberedLinearIssueUrls`: `Map<id, url>` — sessione browser (module)

### External Dependencies

- Linear GraphQL: `https://api.linear.app` via server `linearClient` (search/create only)

### Config

- `linear.apiKeyConfigured`: flag pubblico; la key sta nel secret store
- `linearRenameChat`: Ask / Always / Never (default Ask)
- `showEnvironmentLinear`: toggle Environment (default true)

### Auth e sicurezza

API key solo nel secret store (`~/.synara/userdata/secrets/`, 0600). `settings.json` ha solo `apiKeyConfigured`. HTTP via `fetchJson` allowlist `https://api.linear.app`.

**Gotcha:** `readLinearApiKey` / `writeLinearApiKey` prendono `ServerSecretStoreShape` come parametro, non come requirement Effect — altrimenti rompe `ServerSettingsShape`.

**Gotcha:** `plugin://linear@…` e `linear://ALE-22` sono path diversi. `@linear` senza ref resta kind `"path"` / plugin.

### Cosa NON fa (per scelta)

- Nessuna colonna su `projection_threads`.
- Nessuna scrittura stato/assegnatario/branch su Linear.
- Nessun gruppo sidebar di thread Linear.
- La cache URL del picker non sopravvive al reload: dopo, il chip usa `https://linear.app/issue/<id>`.
