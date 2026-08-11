---
type: feature-doc
project: synara
stack: React / Vite / TypeScript / Node / SQLite
created: 2026-08-09
last_verified: 2026-08-11
status: active
tags: [astronaut, remote-provider, tailscale, sessions, memory]
---

## Astronaut remoto

Quack può usare Astronaut come provider remoto. Astronaut resta la fonte di verità per la memoria, gli strumenti e le sessioni di Chris sull'iMac. Quack conserva il transcript locale e il collegamento alla sessione remota.

Nella UI (settings, picker modelli, messaggio di import) il provider `astronaut` è etichettato **"Companion"**, non "Astronaut" — solo la label è cambiata, chiave provider e contratti restano `astronaut`.

### Configurazione

- Provider: `astronaut`
- Stato iniziale: abilitato di default (`AstronautServerProviderSettings.enabled` decodifica a `true`)
- URL predefinito: `http://imac-di-alek:4567`
- Agent inviato ad Astronaut: `companion` (mostrato come Chris)
- Modelli: letti dal vivo da `GET /models`, con modelli custom locali come fallback

### Health check

`checkAstronautProviderStatus(serverUrl)` in `apps/server/src/provider/Layers/ProviderHealth.ts` fa `GET /status` sul server configurato (timeout `DEFAULT_TIMEOUT_MS`) e produce un `ServerProviderStatus` (`ready`/`error`, `authStatus`). È incluso nell'array `PROVIDERS` e nel fan-out di `makeProviderHealthLive`, quindi la UI impostazioni lo mostra con lo stesso meccanismo generico (`providerStatusByProvider`) usato per gli altri provider — nessun contratto o componente dedicato aggiunto.

Quack non salva la memoria di Astronaut, le credenziali OpenAI o altri secret.

### Flusso di una chat

1. L'utente abilita Astronaut dalle impostazioni.
2. Il picker del composer usa il catalogo live dei modelli.
3. Il primo messaggio crea il binding locale. Astronaut crea la sessione quando riceve `POST /chat`.
4. Le risposte SSE diventano eventi runtime Quack.
5. L'evento `session` salva subito l'id remoto nel cursore di resume del thread.
6. Un reload riusa lo stesso id. La memoria resta quindi sul server Astronaut.

La richiesta chat contiene `message`, `agent: "companion"`, il modello selezionato e l'id di sessione quando il thread è già collegato. Quack non ritenta automaticamente una richiesta già inviata.

### Eventi e richieste remote

| Astronaut              | Quack                                 |
| ---------------------- | ------------------------------------- |
| `session`              | aggiorna il binding remoto            |
| `token`                | delta di testo assistant              |
| `reasoning`            | delta di ragionamento                 |
| `tool`                 | avanzamento e completamento tool      |
| `permission`           | richiesta di approvazione             |
| `question`             | richiesta di input strutturato        |
| `interaction-resolved` | risolve la richiesta aperta           |
| `done`                 | completa il turno                     |
| `error`                | fallisce il turno con l'errore remoto |

Le approvazioni usano `/permission/:id/reply`: `once`, `always` o `reject`. Le risposte alle domande usano `/question/:id/reply` oppure `/question/:id/reject`. L'interruzione usa `POST /sessions/:id/abort`.

### Importazione di una sessione esistente

La sidebar espone “Import thread from…”. Con provider Astronaut e un session id valido, Quack legge `GET /sessions/:id/messages`, crea un nuovo thread locale e importa una volta la cronologia visibile. Non importa automaticamente tutte le chat storiche.

### File principali

| Area                | File                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| Contratti           | `packages/contracts/src/model.ts`, `orchestration.ts`, `providerDiscovery.ts`, `settings.ts`             |
| Metadata e settings | `packages/shared/src/providerMetadata.ts`, `serverSettings.ts`, `apps/web/src/appSettings.ts`            |
| Adapter             | `apps/server/src/provider/Services/AstronautAdapter.ts`, `Layers/AstronautAdapter.ts`                    |
| Health check        | `apps/server/src/provider/Layers/ProviderHealth.ts` (`checkAstronautProviderStatus`)                     |
| SSE                 | `apps/server/src/provider/astronautRemote.ts`                                                            |
| Registry e runtime  | `apps/server/src/provider/Layers/ProviderAdapterRegistry.ts`, `runtimeLayer.ts`                          |
| UI                  | `apps/web/src/components/settings/ProvidersSettingsPanel.tsx`, `Sidebar.tsx`, `SidebarSearchPalette.tsx` |
| Modelli             | `apps/web/src/hooks/useProviderModelCatalog.ts`                                                          |
| Import              | `apps/server/src/orchestration/importThreadRoute.ts`                                                     |

### Confini della prima release

La prima release usa il backend OpenCode attuale di Astronaut. Non sono inclusi steering del turno, fork nativo, rollback, discovery di skill o slash command, né controlli dei task in background. Quack mantiene i fallback esistenti.

L'accesso passa dalla rete privata Tailscale. Il provider non auto-approva azioni.

Il passaggio futuro di Astronaut a Pi con `gpt-5.6-luna` non richiede modifiche a Quack, finché l'API di sessione resta compatibile.

### Verifica

Verifiche eseguite:

```text
curl --connect-timeout 3 --max-time 5 -fsS http://imac-di-alek:4567/status
bun run build                 # apps/server
bun run test -- src/provider/astronautRemote.test.ts
bun run test -- src/orchestration.test.ts
bun run test -- src/hooks/useProviderModelCatalog.test.tsx
git diff --check
```

Il controllo manuale completo resta: abilitare Astronaut, inviare un messaggio, approvare o rifiutare un tool, ricaricare il thread e importare una sessione esistente.

### Gap noto

Nessuno al momento. Lo stato `/status` è ora integrato nel health check generico e visibile nelle impostazioni (vedi sezione Health check).
