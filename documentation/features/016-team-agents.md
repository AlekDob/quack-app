---
type: feature-doc
project: synara
stack: React / Vite / TypeScript / Node / SQLite
created: 2026-08-05
last_verified: 2026-08-05
status: active
tags: [team, agents, roster, presets, avatars, projects]
---

## Team

Team è la terza superficie dell'app, accanto a Projects e Studio. La pagina è disponibile su `/team`.

Team contiene cinque agenti built-in:

- Jack — Planner
- Milo — Builder
- Nora — Debugger
- Vera — Reviewer
- Lia — Assistant

Un roster può essere globale oppure legato a un progetto. I thread di un progetto usano il suo roster. Home, Chats e Studio usano il roster globale.

### Cosa è stato aggiunto

| Area | File | Funzione |
| --- | --- | --- |
| Contratti | `packages/contracts/src/team.ts` | `TeamScope`, `TeamAgent`, `TeamRoster` e input RPC |
| WebSocket | `packages/contracts/src/ws.ts`, `packages/contracts/src/rpc.ts` | `team.getRoster`, `team.upsertAgent`, `team.deleteAgent` |
| Native API | `packages/contracts/src/ipc.ts`, `apps/web/src/wsNativeApi.ts` | API Team usata dal client web |
| Persistenza | `apps/server/src/persistence/Migrations/091_TeamAgents.ts` | Tabella SQLite `team_agents` e indice per progetto |
| Repository | `apps/server/src/persistence/Services/TeamRepository.ts` | Lettura roster, override built-in, custom e tombstone |
| Layer | `apps/server/src/persistence/Layers/TeamRepository.ts` | Risoluzione degli agenti e validazione avatar/id |
| Server | `apps/server/src/wsRpc.ts` | CRUD Team e validazione dell'esistenza del progetto |
| Prompt | `apps/server/src/provider/paperoPromptInjection.ts` | Iniezione server-side del nome, ruolo e istruzioni effettivi |
| Orchestrazione | `apps/server/src/orchestration/Layers/ProviderCommandReactor.ts` | Roster risolto al momento dell'invio; fallback a Milo |
| Cleanup | `apps/server/src/orchestration/Layers/ProjectionPipeline.ts` | Eliminazione del roster quando viene eliminato il progetto |
| Sidebar | `apps/web/src/components/Sidebar.tsx` | Picker Projects / Studio / Team e navigazione `/team` |
| UI | `apps/web/src/routes/_chat.team.tsx` | Scope selector, card agenti, dialog edit/create/delete |
| Migrazione web | `apps/web/src/routes/_chat.team.tsx` | Import una tantum da `synara:paperi:v1` |
| Router | `apps/web/src/routeTree.gen.ts` | Generato dal plugin TanStack Router |

### Persistenza

Gli agenti built-in non vengono copiati nel database. Il repository parte sempre dalle definizioni in `packages/shared/src/paperi.ts` e applica gli override salvati.

Gli agenti custom sono salvati con un UUID stabile. Il nome è obbligatorio e viene controllato per unicità nel roster. Gli avatar accettati sono solo i file già presenti in `apps/web/public/images/ducks`.

Il delete di un custom imposta `deleted_at`. Il record non viene rimosso. Questo conserva nome e avatar nei messaggi storici.

Il server rifiuta la cancellazione degli agenti built-in. Se l'id inviato non è nel roster attivo, usa Milo senza iniettare istruzioni non riconosciute.

### Prompt e scope

Prima di ogni invio il server risolve il progetto del thread. Per i progetti ordinari usa il roster `project:<id>`. Per i contenitori Home, Chats e Studio usa `global`.

Il blocco inviato al provider mantiene il formato esistente:

```text
[Agent identity]
You are ...
HOUSE STYLE ...
...
[/Agent identity]
```

Le istruzioni non vengono copiate nel messaggio utente.

### Migrazione locale

Alla prima apertura di Team, la UI legge `synara:paperi:v1`. Importa override e slot modello nel roster globale solo se il server non ha già una modifica per quell'agente. Poi scrive `synara:team:migrated:v1` per non ripetere l'operazione.

### Verifica

Comandi eseguiti:

```text
bun fmt
bun lint
bun typecheck
bun --filter @synara/web build
```

Il lint passa con warning già presenti nel repository. Il typecheck e la build web passano.

### Note per il seguito

La pagina Team e il CRUD server sono pronti. Il picker del composer e la risoluzione visuale del transcript usano ancora parte del percorso Paperi locale. Il passo successivo è sostituire quel percorso con il roster server-side anche per agenti custom e tombstone.
