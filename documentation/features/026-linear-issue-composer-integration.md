---
type: feature-doc
project: quack-20
stack: Effect / Node.js / React (Vite) / TypeScript
created: 2026-08-14
startDate: 2026-08-14
endDate:
last_verified: 2026-08-20
status: active
tags: [linear, composer, mention, settings, secrets, websocket, environment, mcp]
---

## Integrazione Linear nel composer (ALE-28)

**Scopo:** `@` nel composer elenca i ticket Linear aperti da **N workspace** (una API key ciascuno, cap 8). Sceglierne uno inserisce un chip `@"ALE-22 Kanban"` (path `linear://alekdob/ALE-22`) e, in base alle Settings, può rinominare la chat. `@+` mette **New Linear issue** in cima. I ticket citati compaiono anche nel pannello Environment.

**Stack:** React / TypeScript (`apps/web`) + Node (`apps/server`) + shared (`packages/shared`)

Deciso con l'utente:

- Auth: API key personale in Settings → Linear, non OAuth. Più workspace = più key.
- Il ticket vive nelle `mentions` del composer/messaggio, come file e chat. Nessuna colonna SQLite nuova.
- Rinomina chat: `linearRenameChat` = `ask` (default) / `always` / `never`.
- Nessuna scrittura di stato, assegnatario o branch su Linear.
- Il MCP ufficiale Linear è dell'utente. Quack non lo wrappa, non lo spawn, non lo sovrascrive. Codex overlay tocca solo `[mcp_servers.synara]`. Claude carica Linear via `settingSources`. Cursor/Grok/Droid ricevono synara **più** i server del loro `mcp.json` nativo, mergiati: synara vince solo sulla chiave `synara`.

Vedi [018-linear-project-routing.md](018-linear-project-routing.md) per il deep-link `quack://open?source=linear`. Indipendente da questa feature.

**2026-08-20 (QUACK-3):** "Edit project" (Sidebar) ha un campo opzionale team/progetto Linear per progetto, dietro un disclosure "Linear (optional)" (chiuso di default, riepilogo inline `TEAM · Progetto` / `Not set`). Salvato in localStorage per macchina (`projectLinearDefaults.ts`), non nel read model server — è un default UI, non metadata da sincronizzare tra macchine. `LinearCreateIssueDialog` lo legge per pre-selezionare workspace/team/progetto invece del primo team della lista.

Diario: [2026-08-20](../diary/2026-08-20.md) (associazione Linear per progetto + disclosure UI); [2026-08-18](../diary/2026-08-18.md) (N workspace + MCP pass-through; chip + Environment + `@+`); [2026-08-14](../diary/2026-08-14.md) (prima integrazione, solo rinomina).

### Files

| Type       | Path                                                                        | Exports/Purpose                                                                             |
| ---------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Util       | `packages/shared/src/linearMentions.ts`                                     | `linear://alekdob/ALE-22` + fallback `linear://ALE-22`                                      |
| Test       | `packages/shared/src/linearMentions.test.ts`                                | Round-trip slug/id; reject `plugin://linear`                                                |
| Config     | `packages/shared/package.json`                                              | Export `@synara/shared/linearMentions`                                                      |
| Model/Type | `packages/contracts/src/linear.ts`                                          | `LinearWorkspace`, `LinearIssue` (+ workspace\*), create options per workspace              |
| Model/Type | `packages/contracts/src/settings.ts`                                        | `linear.workspaces[]`, `apiKeyConfigured`, patch `apiKey` / `removeWorkspaceId`             |
| Contratti  | `packages/contracts/src/ws.ts`, `rpc.ts`, `ipc.ts`                          | `linear.searchIssues`, `linear.listCreateOptions`, `linear.createIssue`                     |
| Service    | `apps/server/src/linear/linearCredentials.ts`                               | Secret `linear-api-key:<orgId>`; legacy `linear-api-key`                                    |
| Service    | `apps/server/src/linear/linearWorkspaces.ts`                                | Add/remove/migrate workspace; cap 8                                                         |
| Service    | `apps/server/src/linear/linearClient.ts`                                    | GraphQL search/create + org lookup (`organization` / `viewer.organization`); fan-out search |
| Test       | `apps/server/src/linear/linearClient.test.ts`                               | Filtro stato, 401, fan-out con una key rotta, org lookup                                    |
| Test       | `apps/server/src/linear/linearWorkspaces.test.ts`                           | Migrate key legacy anche offline; add non perde il primo workspace                          |
| Service    | `apps/server/src/serverSettings.ts`                                         | Persiste `workspaces`; key solo nel secret store                                            |
| Service    | `apps/server/src/wsRpc.ts`                                                  | Handler WS fan-out su tutte le key                                                          |
| Util       | `apps/server/src/agentGateway/mcpMerge.ts`                                  | `mergeNamedMcpServers` / `mergeAcpMcpServers` — synara vince solo su `synara`               |
| Util       | `apps/server/src/provider/userMcpConfig.ts`                                 | Legge `~/.cursor/mcp.json` (e analoghi grok/droid) senza scriverli                          |
| Config     | `apps/web/src/appSettings.ts`                                               | `linearRenameChat`, `showEnvironmentLinear`                                                 |
| Util       | `apps/web/src/lib/composerMentions.ts`                                      | Chip kind `"linear"`; token keys include identifier                                         |
| Util       | `apps/web/src/lib/linearIssueUrls.ts`                                       | Cache URL keyed by `linear://` path                                                         |
| Hook       | `apps/web/src/hooks/useComposerCommandMenuItems.ts`                         | Voci menu; `linearComposerCreateQuery` per `@+`                                             |
| Component  | `apps/web/src/components/chat/ComposerCommandMenu.tsx`                      | Un gruppo per workspace se ce n'è più di uno                                                |
| Component  | `apps/web/src/components/chat/MentionChipIcon.tsx`                          | Icona Linear su chip composer/messaggio                                                     |
| Component  | `apps/web/src/components/chat/InlineMentionChip.tsx`                        | Label = nome; click apre Linear                                                             |
| Component  | `apps/web/src/components/composer-nodes/index.tsx`                          | Label chip Lexical per kind `linear`                                                        |
| Component  | `apps/web/src/components/chat/LinearCreateIssueDialog.tsx`                  | Workspace (se >1) + team + progetto; legge i default del project al mount            |
| Component  | `apps/web/src/components/ChatView.tsx`                                      | Insert mention, Ask/Always/Never, Environment mentions, passa `projectId` al dialog create |
| Component  | `apps/web/src/components/ProjectSettingsDialog.tsx`                         | Campi team/progetto Linear per progetto, dietro disclosure "Linear (optional)"              |
| Component  | `apps/web/src/components/Sidebar.tsx`                                       | Passa `projectId` a `ProjectSettingsDialog`                                                 |
| Util       | `apps/web/src/lib/projectLinearDefaults.ts`                                 | `read/writeProjectLinearDefaults` — localStorage per macchina, chiave per projectId         |
| Test       | `apps/web/src/lib/projectLinearDefaults.test.ts`                            | Round-trip, clear, ignora entry incomplete                                                  |
| Component  | `apps/web/src/components/settings/LinearSettingsPanel.tsx`                  | Lista workspace + nome + add key + disconnect                                               |
| Component  | `apps/web/src/components/chat/environment/EnvironmentLinearSection.tsx`     | Righe uniche per `linear://` path                                                           |
| Component  | `apps/web/src/components/chat/environment/EnvironmentPanel.tsx`             | Sezione Linear dopo PR                                                                      |
| Route/Page | `apps/web/src/routes/_chat.settings.tsx`                                    | Toggle Environment → Linear                                                                 |
| Config     | `apps/web/src/settingsNavigation.ts`                                        | Sezione Settings `linear`                                                                   |
| Config     | `apps/web/src/settingsSearchIndex.ts`                                       | Search: Issues, API key, rename, Environment Linear                                         |
| Util       | `apps/web/src/composer-editor-mentions.ts`                                  | Segment kind `linear` da mention refs                                                       |
| Test       | `apps/web/src/lib/composerMentions.test.ts`                                 | `resolveMentionChipKind("linear")` resta `"path"` senza ref `linear://`                     |
| Test       | `apps/web/src/composer-editor-mentions.test.ts`                             | `@linear` plugin vs `@"ALE-22 Kanban"` linear                                               |
| Test       | `apps/web/src/components/chat/environment/EnvironmentLinearSection.test.ts` | Dedup per path; due org con stesso identifier                                               |
| Test       | `apps/web/src/components/chat/ComposerCommandMenu.test.ts`                  | `@+` alza Linear; split per workspace                                                       |
| Test       | `apps/web/src/hooks/useComposerCommandMenuItems.test.ts`                    | `linearComposerCreateQuery`                                                                 |
| Test       | `apps/server/src/agentGateway/mcpMerge.test.ts`                             | Merge non tocca `linear`                                                                    |
| Test       | `apps/server/src/provider/userMcpConfig.test.ts`                            | Parse stdio/http mcp.json                                                                   |

### Data Flow

`@` / `@ale` → `linearIssuesQueryOptions` → `linear.searchIssues` → GraphQL in parallelo su ogni key (stati non completed/canceled) → voci `linear-issue` raggruppate per workspace se >1.

Pick issue → token `formatComposerMentionToken(name)` + mention `{ name, path: linear://alekdob/ALE-22 }` → chip. Poi `linearRenameChat`: `always` rinomina; `never` no; `ask` → AlertDialog Rename / Keep title.

`@+` / `@+Kanban` → `linearComposerCreateQuery` → create come prima voce; search Linear usa il testo dopo `+`.

"New Linear issue" → dialog (workspace se >1, team, progetto) → `linear.createIssue` → stesso insert chip + policy rinomina. Team/progetto iniziali: default salvato per il project attivo, letto nell'initializer `useState` del form (al mount), altrimenti primo team disponibile.

Edit project → disclosure "Linear (optional)" → scegli team (filtra progetti per team) → `writeProjectLinearDefaults(projectId, …)` al Save. `null` (nessun team) rimuove l'associazione.

Chip click → `issue.url` se in cache (keyed by path), altrimenti `https://linear.app/alekdob/issue/ALE-22`. Path vecchi `linear://ALE-22` restano validi.

Environment: draft + `message.mentions` user → `collectLinearEnvironmentItems` (unique per path) → righe; click usa il browser in-app.

Agenti: Codex overlay copia `config.toml` e sostituisce solo synara. Claude `settingSources` user/project/local. ACP session/new = `loadUserAcpMcpServers` + synara.

### Key Functions

- `linearMentionPathForIdentifier(id, urlKey?) → string` — `linear://alekdob/ALE-22` o `linear://ALE-22`
- `parseLinearMentionPath(path) → { identifier, urlKey } | null` — null su `plugin://linear…`
- `linearComposerCreateQuery(query: string) → string | null` — `@+` shortcut; resto = titolo
- `resolveMentionChipKind(path, options) → MentionChipKind` — `"linear"` solo con path `linear://` o ref
- `collectLinearEnvironmentItems(mentions) → LinearEnvironmentItem[]` — unique per path
- `rememberLinearIssueUrl(path, url) → void` — cache in memoria, persa al reload
- `searchLinearIssuesAcrossWorkspaces(keys, term) → LinearIssue[]` — una key rotta non azzera le altre
- `mergeAcpMcpServers(user, synara) → Acp.McpServer[]` — synara vince solo sul name `synara`
- `loadUserAcpMcpServers({ provider, cwd }) → Acp.McpServer[]` — file assenti = lista vuota
- `linearWorkspaceDisplayName(workspace) → string` — `label` utente, altrimenti nome org Linear
- `readProjectLinearDefaults(projectId) → { workspaceId, teamId, projectId } | null` — null se manca team o non c'è entry
- `writeProjectLinearDefaults(projectId, value | null) → void` — `null` cancella l'entry

### State

- `linear.workspaces`: `{ id, name, urlKey, label? }[]` — persistiti in settings.json (global)
- `linear.apiKeyConfigured`: boolean — true se c'è almeno un workspace o la key legacy
- `linearRenameChat`: `"ask" | "always" | "never"` — default `ask` (local AppSettings)
- `showEnvironmentLinear`: boolean — default `true` (local AppSettings)
- `pendingLinearRename`: `LinearIssue | null` — dialog Ask (component ChatView)
- `rememberedLinearIssueUrls`: `Map<path, url>` — sessione browser (module)
- `synara:project-linear-defaults:v1`: `Record<projectId, { workspaceId, teamId, projectId | null }>` — localStorage, non sincronizzato tra macchine

### External Dependencies

- Linear GraphQL: `https://api.linear.app` via server `linearClient` (search/create/org lookup)
- MCP ufficiale Linear: config utente (Codex `config.toml`, Claude settings, Cursor `mcp.json`) — read-only

### Config

- `linear.workspaces`: metadati pubblici; le key stanno in `linear-api-key:<orgId>`
- `LINEAR_WORKSPACE_LIMIT`: 8
- `linearRenameChat`: Ask / Always / Never (default Ask)
- `showEnvironmentLinear`: toggle Environment (default true)

### Auth e sicurezza

API key solo nel secret store (`~/.synara/userdata/secrets/`, 0600). `settings.json` ha `workspaces` (id/name/urlKey) e `apiKeyConfigured`. HTTP via `fetchJson` allowlist `https://api.linear.app`.

**Gotcha:** `readLinearApiKey` / `writeLinearWorkspaceApiKey` prendono `ServerSecretStoreShape` come parametro, non come requirement Effect — altrimenti rompe `ServerSettingsShape`.

**Gotcha:** `plugin://linear@…` e `linear://alekdob/ALE-22` sono path diversi. `@linear` senza ref resta kind `"path"` / plugin.

**Gotcha:** un secondo org visibile nel picker `@` non entra negli agenti finché l'utente non aggiunge `linear-esopo` (o simile) nella _sua_ config MCP. Quack non scrive quel file.

**Gotcha:** la key vecchia `linear-api-key` può far dire “Connected” senza riga in lista. `migrateLegacyLinearApiKey` promuove sempre quella key a un workspace (nome vero se Linear risponde, altrimenti placeholder `Linear`). Un secondo workspace = un’altra key in **Add another workspace** → Save — non sostituisce la prima.

**Gotcha:** `readProjectLinearDefaults` non va chiamata nel render di un componente compilato da React Compiler. Il compiler la considera pura e mette in cache il risultato con chiave sull'argomento: in `ChatView` (`activeProjectId` stabile) il valore restava congelato, quindi un default salvato a chat aperta non arrivava mai al dialog `@+`. Va letta al mount (initializer di `useState`) del componente che la usa. Vedi diario 2026-08-20.

**Gotcha:** l'associazione team/progetto per project (`ProjectSettingsDialog`) vive in localStorage, non in `project.meta.update` / read model server. Non sincronizza tra macchine e non compare in `synara.getSettings`. Se serve condividerla tra dispositivi va spostata nel comando server — è una scelta deliberata per evitare contratto + evento + projection + reducer web per un default UI.

### Cosa NON fa (per scelta)

- Nessun tool `synara_linear_*`.
- Nessuna scrittura nei file MCP dell'utente.
- Nessuna colonna su `projection_threads`.
- Nessuna scrittura stato/assegnatario/branch su Linear.
- Nessun gruppo sidebar di thread Linear.
- Nessuna gestione OAuth di `mcp.linear.app`.
