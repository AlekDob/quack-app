# 🦆 Quack Agent Personality System

Benvenuto nel sistema di personalità dinamiche per gli agenti Quack! Questo sistema permette di personalizzare completamente la personalità, le competenze e lo stile di comunicazione di ogni agente creato in Quack.

## 📁 Struttura Directory

```
.quack/
├── agent-personalities/
│   ├── default.json          # Personalità default (Jack, CEO Quack Agency)
│   └── [agentId].json        # Personalità specifiche per ogni agente
└── templates/
    └── CLAUDE.md.template    # Template per generazione CLAUDE.md
```

## 🎭 Come Funziona

### 1. Creazione Agente con Personalità

Quando crei un nuovo agente tramite il modal "Create new agent", puoi:

- **Espandere "Agent Personality"** per personalizzare:
  - **Role**: Ruolo dell'agente (es: "Senior Developer", "Code Reviewer")
  - **Specialties**: Tag di specializzazione (Frontend, Backend, Database, DevOps, Testing, Security, Mobile, AI/ML)
  - **Personality Traits**: Tratti caratteriali (Meticulous, Creative, Pragmatic, Detail-oriented, etc.)
  - **Communication Style**: Stile di comunicazione (Professional, Friendly, Casual, Technical)
  - **Skills to Remember**: Skills dalla cartella `.claude/skills/` che l'agente deve ricordare

### 2. Salvataggio Automatico

Quando crei l'agente, Quack salva automaticamente la personalità in `.quack/agent-personalities/[agentId].json`.

**Esempio di file JSON generato:**
```json
{
  "id": "agent-uuid-123",
  "name": "Agent Charlie",
  "role": "Senior Code Reviewer at Quack Agency",
  "personality": "Meticulous and detail-oriented. Spots bugs before they hatch!",
  "quirks": "Says 'quack check' when reviewing code",
  "communicationStyle": "professional",
  "specialties": ["frontend", "testing", "performance"],
  "skills": ["code-review", "test-automation"],
  "expressions": ["Let me analyze", "Quack check!", "Consider this approach"]
}
```

### 3. Injection nel CLAUDE.md

Quando selezioni un agente attivo, Quack **inietta automaticamente** un header personalizzato nel file `CLAUDE.md` del progetto:

```markdown
<!-- QUACK_AGENT_HEADER_START - DO NOT EDIT MANUALLY -->
Your name is **Agent Charlie**, and you're the **Senior Code Reviewer at Quack Agency**.

Meticulous and detail-oriented. Spots bugs before they hatch!

Says 'quack check' when reviewing code

**Communication Style:** professional

**Your Specialties:**
- Frontend Development
- Testing & QA
- Performance Optimization

**Skills to Remember:**
- code-review
- test-automation

**Favorite Expressions:**
- Let me analyze
- Quack check!
- Consider this approach
<!-- QUACK_AGENT_HEADER_END -->
```

### 4. Protezione Contenuti Utente

Il sistema è progettato per **NON toccare** i contenuti personalizzati dell'utente nel CLAUDE.md:

- L'header dell'agente viene delimitato da marker `<!-- QUACK_AGENT_HEADER_START -->` e `<!-- QUACK_AGENT_HEADER_END -->`
- Ogni volta che cambi agente, solo l'header viene sostituito
- Tutto il contenuto sotto i marker rimane intatto

## 🚀 Workflow Completo

1. **Utente crea "Agent Charlie"** con specializzazione in code review
2. **Quack salva** `.quack/agent-personalities/agent-charlie.json`
3. **Utente seleziona "Agent Charlie"** dal sidebar
4. **Quack legge** la personalità JSON
5. **Quack processa** il template CLAUDE.md
6. **Quack inietta** l'header personalizzato nel CLAUDE.md
7. **Claude Code legge** il CLAUDE.md aggiornato con la personalità di Charlie
8. **Claude risponde** come "Agent Charlie" con la personalità definita! 🎭

## 🎯 Funzionalità Avanzate

### Default Fallback

Se un agente non ha una personalità personalizzata, Quack usa `default.json` che mantiene il comportamento originale di "Jack" con le espressioni "quack quack".

### Progetti Nuovi

Se avvii un progetto che non ha un `CLAUDE.md`, Quack lo **crea automaticamente** con:
- Header personalizzato dell'agente attivo
- Sezione "USER CUSTOM CONTENT BELOW" dove l'utente può aggiungere le sue istruzioni

### Multiagent Support

Ogni terminale/agente può avere la sua personalità:
- **Agent Charlie** → Meticulous code reviewer
- **Agent Parker** → Creative UI designer
- **Agent Roberta** → Pragmatic backend developer
- **Jack (default)** → Project manager coordinator

## 🛠️ API Backend (Rust)

### Comandi Tauri Disponibili

```typescript
// Salva personalità agente
await invoke('save_agent_personality', {
  projectPath: '/path/to/project',
  personality: {
    id: 'agent-uuid',
    name: 'Agent Charlie',
    role: 'Code Reviewer',
    // ... altri campi
  }
});

// Carica personalità agente
const personality = await invoke('load_agent_personality', {
  projectPath: '/path/to/project',
  personalityId: 'agent-uuid'
});

// Inietta personalità nel CLAUDE.md
await invoke('inject_personality_to_claude_md', {
  projectPath: '/path/to/project',
  personality: { /* ... */ }
});
```

## 💡 Best Practices

1. **Usa personalità specifiche** per compiti specializzati (es: "Code Reviewer" per review del codice)
2. **Seleziona skills rilevanti** dalla cartella `.claude/skills/` per dare contesto all'agente
3. **Mantieni il role conciso** ma descrittivo (max 50 caratteri)
4. **Combina specialties** per agenti poliedrici (es: Frontend + Testing)
5. **Sperimenta con communication styles** per trovare il tono giusto

## 🦆 Quack Quack!

Il sistema di personalità dinamiche è stato progettato per massimizzare la flessibilità e l'organizzazione del lavoro multi-agente. Ogni agente diventa un vero e proprio specialista con la sua personalità unica!

**Developed with 🦆 by Quack Agency**
