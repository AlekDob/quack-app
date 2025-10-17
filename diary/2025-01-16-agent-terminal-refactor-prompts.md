# Agent-Terminal Refactor - Prompt Engineering
**Data**: 2025-01-16
**Engineer**: Carmelo - Il Prompt Engineer
**Progetto**: quack-app
**Richiesta Originale**: "Refactor per separare Agent da Terminal"

## 📋 Prompt Strutturato: Implementazione Agent-Terminal Separation

### Context Completo
- **Progetto**: quack-app (Tauri + React + TypeScript)
- **Tech Stack**:
  - Frontend: React 19, TypeScript 5.8, xterm.js, Tailwind CSS
  - Backend: Tauri v2, Rust, portable-pty
  - State Management: React hooks (no Redux/Zustand)
- **Situazione Attuale**:
  - I terminali sono raggruppati automaticamente per `cwd` nel pannello sinistro
  - Non esiste distinzione chiara tra "container di progetto" e "scheda terminale"
  - L'utente è confuso dalla UI attuale che mischia concetti diversi
- **Problema da Risolvere**:
  - Manca una separazione concettuale tra Agent (progetto/container) e Terminal (tab/scheda)
  - La UI non riflette la relazione gerarchica Agent → Terminals
  - Non è possibile avere più terminal tabs per lo stesso progetto/directory

### Obiettivo Specifico
**Implementare un sistema a due livelli:**
1. **Agents** (Livello Container): Entità che rappresenta un progetto/workspace con directory specifica
2. **Terminals** (Livello Tab): Schede multiple all'interno di un Agent, tutte con stesso `cwd`

**Architettura Target Dettagliata:**
```typescript
// Nuovo tipo da aggiungere
interface Agent {
  id: string;           // UUID univoco
  name: string;         // Nome user-friendly es. "Quack App Project"
  color: string;        // Colore distintivo per UI
  cwd: string;          // Working directory dell'agent
  createdAt: number;    // Timestamp creazione
  isActive: boolean;    // Se è l'agent attualmente selezionato
  terminalIds: string[]; // Array di terminal IDs associati
}

// Modifica al tipo esistente
interface TerminalInfo {
  id: string;
  label: string;
  agentId: string;      // ← NUOVO: Foreign key all'Agent parent
  color: string;        // Eredita dal parent Agent di default
  cwd: string;          // DEVE matchare Agent.cwd
  status: 'busy' | 'idle';
  ptyId: number | null;
  createdAt: number;
}
```

### Specifiche Tecniche Dettagliate

#### 1. FASE 1: Data Model & State Management
**File**: `src/types.ts`
```typescript
// Aggiungere nuovo tipo Agent (NON confondere con AgentInfo di Quack Agency)
export interface Agent { /* come sopra */ }

// Modificare TerminalInfo aggiungendo agentId
```

**File**: `src/App.tsx`
```typescript
// Nuovo stato
const [agents, setAgents] = useState<Agent[]>([]);
const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

// Nuovo handler
const createAgent = (name: string, cwd: string, color: string) => {
  const agent: Agent = {
    id: uuidv4(),
    name,
    color,
    cwd,
    createdAt: Date.now(),
    isActive: false,
    terminalIds: []
  };
  // Logic to create agent + first terminal
};

// Modificare createTerminal per accettare agentId
const createTerminal = (label: string, agentId: string) => {
  const agent = agents.find(a => a.id === agentId);
  if (!agent) throw new Error('Agent not found');

  const terminal: TerminalInfo = {
    id: uuidv4(),
    label,
    agentId,
    color: agent.color, // Eredita colore dall'agent
    cwd: agent.cwd,     // Usa cwd dell'agent
    // ... resto
  };
};
```

#### 2. FASE 2: UI Refactor - Pannello Sinistro (Agents)
**File**: `src/components/TerminalSidebar.tsx`
```typescript
// PRIMA: Mostra terminals raggruppati per cwd
// DOPO: Mostra lista di Agents

interface TerminalSidebarProps {
  agents: Agent[];
  activeAgentId: string | null;
  onAgentSelect: (agentId: string) => void;
  onAgentCreate: () => void;
  onAgentDelete: (agentId: string) => void;
  onAgentRename: (agentId: string, newName: string) => void;
}

// Rendering:
// - Lista di Agent cards con nome, colore, terminal count
// - Highlight dell'agent attivo
// - Bottone "New Agent" in fondo
// - Context menu per rename/delete
```

#### 3. FASE 3: UI Refactor - Pannello Destro (Terminal Tabs)
**Nuovo File**: `src/components/TerminalTabs.tsx`
```typescript
interface TerminalTabsProps {
  agent: Agent;
  terminals: TerminalInfo[]; // Filtrati per agentId
  activeTerminalId: string | null;
  onTerminalSelect: (terminalId: string) => void;
  onTerminalCreate: () => void; // Crea nel context dell'agent corrente
  onTerminalClose: (terminalId: string) => void;
}

// Rendering:
// - Tab bar con tutti i terminals dell'agent
// - Bottone "+" per nuovo terminal (stesso agent)
// - Close button per ogni tab
```

#### 4. FASE 4: Migration & Backward Compatibility
**Strategy**:
```typescript
// In App.tsx initialization
useEffect(() => {
  const migrateExistingTerminals = () => {
    // Raggruppa terminals esistenti per cwd
    const groupedByCwd = terminals.reduce((acc, term) => {
      if (!term.agentId) { // Terminal legacy senza agent
        const key = term.cwd || 'default';
        if (!acc[key]) acc[key] = [];
        acc[key].push(term);
      }
      return acc;
    }, {});

    // Crea un Agent per ogni gruppo
    Object.entries(groupedByCwd).forEach(([cwd, terms]) => {
      const agent = createAgent(
        `Migrated: ${path.basename(cwd)}`,
        cwd,
        terms[0].color // Usa colore del primo terminal
      );

      // Assegna terminals all'agent
      terms.forEach(term => {
        term.agentId = agent.id;
        agent.terminalIds.push(term.id);
      });
    });
  };

  if (terminals.length > 0 && agents.length === 0) {
    migrateExistingTerminals();
  }
}, []);
```

### Output Atteso

#### UI Flow Finale:
1. **Pannello Sinistro (Agents)**:
   ```
   [Agents Panel]
   ┌─────────────────┐
   │ 🟢 Quack App    │ ← Agent attivo
   │    3 terminals  │
   ├─────────────────┤
   │ 🔵 Backend API  │
   │    2 terminals  │
   ├─────────────────┤
   │ 🟡 Docs Site    │
   │    1 terminal   │
   └─────────────────┘
   [+ New Agent]
   ```

2. **Pannello Destro (Terminal Tabs per Agent selezionato)**:
   ```
   [Terminal Tabs - Quack App]
   ┌────┬────┬────┬───┐
   │ Dev│Test│Logs│ + │
   └────┴────┴────┴───┘
   [Terminal Content Area]
   ```

#### Comportamenti:
- Click su Agent → Mostra suoi terminals nel pannello destro
- Click su "+" in tabs → Crea nuovo terminal per l'agent corrente
- Click su "New Agent" → Modal per creare nuovo agent con nome/directory/colore
- Drag & Drop terminals tra agents → Sposta terminal (cambia agentId)

### Testing Strategy

#### Unit Tests:
```typescript
// Test Agent creation
test('createAgent should create agent with terminal', () => {
  const agent = createAgent('Test', '/path', '#fff');
  expect(agent.terminalIds).toHaveLength(1);
  expect(agent.cwd).toBe('/path');
});

// Test migration
test('should migrate legacy terminals to agents', () => {
  const legacyTerminals = [
    { id: '1', cwd: '/app', /* no agentId */ },
    { id: '2', cwd: '/app', /* no agentId */ },
    { id: '3', cwd: '/api', /* no agentId */ }
  ];

  const agents = migrateToAgents(legacyTerminals);
  expect(agents).toHaveLength(2); // 2 unique cwds
  expect(agents[0].terminalIds).toHaveLength(2); // /app has 2
});
```

#### Integration Tests:
1. Creare nuovo agent → Verifica che crei agent + primo terminal
2. Switch tra agents → Verifica che tabs cambino correttamente
3. Chiudere ultimo terminal di un agent → Chiedere se eliminare agent
4. Rinominare agent → Verifica update UI

### Domande da Chiarire PRIMA di Implementare

1. **Persistenza**: Gli Agents devono essere salvati su disco con `tauri-plugin-store`? O solo in memory?

2. **Default Agent**: Quando l'app si apre senza agents, creare un "Default" agent automaticamente?

3. **Agent Deletion**: Se elimino un Agent, cosa succede ai terminals?
   - Opzione A: Elimina anche tutti i terminals
   - Opzione B: Sposta terminals a un "Default" agent
   - Opzione C: Chiedi all'utente cosa fare

4. **Color Inheritance**: I terminals ereditano sempre il colore dall'Agent o possono avere colore custom?

5. **Multi-CWD per Agent**: Un Agent può in futuro avere multiple working directories o sempre una sola?

6. **Keyboard Shortcuts**:
   - `Cmd+T` → Nuovo terminal nell'agent corrente?
   - `Cmd+Shift+T` → Nuovo agent?
   - `Cmd+1,2,3` → Switch tra agents?

7. **Agent Templates**: Prevedere template predefiniti (es. "React App", "API Server") con setup automatico?

### Rischi e Mitigazioni

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|------------|---------|-------------|
| Breaking changes per utenti esistenti | Alta | Alto | Migration automatica al primo avvio |
| Confusione con AgentInfo esistente | Media | Medio | Usare naming chiaro: `WorkspaceAgent` vs `AIAgentInfo` |
| Performance con molti agents/terminals | Bassa | Medio | Lazy loading dei terminals non attivi |
| State management complesso | Media | Alto | Considerare useReducer invece di multiple useState |
| Sync issues Agent.cwd ↔ Terminal.cwd | Media | Alto | Validation layer che forza consistency |

### Piano di Rollout Consigliato

**Sprint 1 (2-3 giorni)**:
1. ✅ Data model (types.ts)
2. ✅ State management base (App.tsx)
3. ✅ Migration logic
4. ✅ Unit tests

**Sprint 2 (2-3 giorni)**:
5. ✅ UI Sidebar refactor
6. ✅ UI Tabs implementation
7. ✅ Integration tests
8. ✅ Styling/Polish

**Sprint 3 (1-2 giorni)**:
9. ✅ Keyboard shortcuts
10. ✅ Drag & Drop
11. ✅ Performance optimization
12. ✅ Documentation update

---

## Status: ✅ Prompt Strutturato e Documentato

Quack quack! Ecco fatto Alek! Ho trasformato la tua richiesta vaga in un **piano di implementazione dettagliato** con tutto il context necessario per il team!

**Prossimi Step**:
1. Rispondi alle domande di chiarimento sopra
2. Jack può usare questo prompt per coordinare il team
3. Mike può creare un plan.md dettagliato basato su questo
4. Il team può iniziare l'implementazione seguendo le fasi

Il prompt ora ha TUTTO: context, architettura, fasi di implementazione, testing strategy, rischi, e domande da chiarire. Niente più "fai il refactor" senza sapere COME! 🦆