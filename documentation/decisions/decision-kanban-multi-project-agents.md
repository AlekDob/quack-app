---
type: decision
created: 2026-01-17
tags: [kanban, multi-project, agents, architecture]
---

# decision-kanban-multi-project-agents

> [!note] Some details may be outdated.

[2026-01-17] Decisione Architetturale: Multi-Project Agent System per Kanban V2

## Contesto

Il sistema Kanban V1 aveva agenti legati a un singolo progetto (ogni agente aveva `projectPath` fisso). Questo limitava la flessibilità - un agente non poteva lavorare su più progetti senza duplicazione.

## Decisione

Refactor completo a **Multi-Project Agent Architecture**:

### Schema V2:

```javascript

// V1 Agent (single project)

  id: 'agent-001',

  projectPath: '/path/to/project',  // ❌ Locked to one project

  projectName: 'quack-app'

// V2 Agent (multi-project)

  id: 'agent-001',

  name: 'Sophie',

  color: '#FF6B35',

  // NO projectPath - can work on any project!

  defaultProjectPath: '/path/to/project'  // Optional UI hint

### Relazione Agent-Project:

- **V1**: 1:1 (un agente per progetto)

- **V2**: M:N (un agente può lavorare su N progetti via sessioni)

La relazione è **derivata dalle sessioni**, non memorizzata direttamente:

```javascript

// Session binds agent to project

  id: 'session-uuid',

  agentId: 'agent-uuid',       // Which agent

  projectPath: '/path/to/project',  // Which project

  projectName: 'quack-app',

  status: 'in_progress'

## Auto-Create Agent

Quando si crea una sessione con `agentName` inesistente, l'agente viene creato automaticamente con impostazioni default:

```javascript

kanban_create_session({

  agentName: 'NewAgent',  // Non esiste

  projectPath: '/path/to/project',

  title: 'My Task'

// → Crea agente 'NewAgent' + crea sessione

## Security Improvements (P0 Fixes)

### 1. Cryptographic IDs

- **Before**: `Math.random()` (weak, predictable)

- **After**: `crypto.randomUUID()` (secure)

### 2. File Locking

- **Before**: No concurrency control (race conditions)

- **After**: `proper-lockfile` con retry logic

### 3. Path Validation

- **Before**: No validation (directory traversal vulnerability)

- **After**: Path normalization + traversal detection

## Tools V2

| Tool | Descrizione |

|------|-------------|

| `kanban_create_agent` | Crea agente multi-progetto |

| `kanban_create_session` | Crea sessione (auto-crea agente se serve) |

| `kanban_list_agents` | Lista agenti, filtra per progetto |

| `kanban_list_sessions` | Lista sessioni con filtri flessibili |

| `kanban_move_session` | Sposta sessione tra colonne |

| `kanban_update_session` | Aggiorna metadati sessione |

| `kanban_delete_agent` | Elimina agente (archive/delete sessions) |

| `kanban_delete_session` | Elimina singola sessione |

## Migration da V1 a V2

**Agenti**: Rimuovi `projectPath` e `projectName`, aggiungi `defaultProjectPath` (optional).

**Sessioni**: Nessun cambiamento - già compatibili con V2.

## Testing

- 44 test Vitest (unit + integration)

- Copertura: tutti i tools, multi-project scenarios, auto-create

- Test suite: `src/tests/kanbanToolsV2.test.ts`

## Files Modified

- `src-tauri/node-sdk/kanban-tools-v2.js` (NEW - 820 righe)

- `src-tauri/node-sdk/kanban-mcp-server-v2.js` (NEW - MCP server wrapper)

- `src-tauri/node-sdk/stream-claude.js` (updated to use V2)

- `src-tauri/node-sdk/package.json` (added `proper-lockfile`)

## Razionale

**Vantaggi**:

1. Un agente può lavorare su backend + frontend senza duplicazione

2. Sessioni sono completamente isolate e sacre (design principle)

3. Auto-create semplifica UX (no pre-create agents)

4. Security hardening (crypto IDs, file locking, path validation)

**Trade-offs**:

- Più complessità nel data model (M:N relationship)

- Richiede migrazione da V1 (backward incompatible)

## Deployment

- MCP server V2 configurato in `stream-claude.js`

- Tool names: `mcp__kanban-tools-v2__*`

- Server name: `kanban-tools-v2`

[2026-01-17] Security hardening completed: (1) Replaced Math.random() with crypto.randomUUID() for cryptographically secure IDs, (2) Implemented proper-lockfile for file locking to prevent race conditions in concurrent JSON read/write operations, (3) Added validateProjectPath() function with path normalization and directory traversal detection to prevent path injection attacks. All 44 tests passing after security fixes.
