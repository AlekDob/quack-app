---
type: pattern
project: quack-app
created: 2025-02-11
tags: [ui, sessions, branch, sidebar, grouping]
---

# Pattern: Session Grouping by Branch in Agent List

## Context

Con l'introduzione del **branch per sessione** (ogni sessione può avere un branch diverso), l'agente può avere sessioni su branch diversi contemporaneamente. Serve un modo per visualizzare questo nella sidebar senza confusione.

## Problema

```
Agent Graydon
  ● Ciao              (main)
  ● Fix hotfix        (hotfix/crash)
  ● Feature X         (feature/x)
  ● Grouping project  (main)
```

Senza raggruppamento, l'utente deve scorrere tutte le sessioni per capire quale branch sta usando. Inoltre, il badge branch individuale su ogni sessione diventa ridondante e cluttered.

## Soluzione: Sub-header Branch

Le sessioni sotto ogni agente sono **raggruppate per branch** con un mini-header:

```
Agent Graydon
  ⎇ main (3)
    ● Ciao                  8s ago
    ● Grouping projects     4m ago
    ● Another task          1h ago
  ⎇ hotfix/crash (1)
    ● Fix critical bug      2h ago
  ⎇ feature/x (1)
    ● New UI component      1d ago
```

### Implementazione in `AgentSessionList.tsx`

```typescript
// Group sessions by branch (session.branch > agentBranch > 'main')
const sessionsByBranch = visibleSessions.reduce<Record<string, typeof visibleSessions>>((acc, session) => {
  const branch = session.branch || agentBranch || 'main';
  if (!acc[branch]) acc[branch] = [];
  acc[branch].push(session);
  return acc;
}, {});

const branchNames = Object.keys(sessionsByBranch);

return (
  <div style={{ marginTop: '4px' }}>
    {branchNames.map((branchName) => {
      const branchSessions = sessionsByBranch[branchName];
      return (
        <div key={branchName} style={{ marginBottom: '2px' }}>
          {/* Branch sub-header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '2px 8px 2px 20px',
            marginBottom: '1px',
          }}>
            {/* Git branch icon (SVG) */}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="rgba(255, 255, 255, 0.35)" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            <span style={{
              fontSize: '9px',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              color: 'rgba(255, 255, 255, 0.4)',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}>
              {branchName}
            </span>
            <span style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.2)' }}>
              ({branchSessions.length})
            </span>
          </div>
          {/* Sessions in this branch */}
          {branchSessions.map((session) => (
            <AgentSessionItem key={session.id} session={session} {...props} />
          ))}
        </div>
      );
    })}
  </div>
);
```

## Badge Branch Individuale

Il badge arancione su `AgentSessionItem` ora appare **solo quando la sessione ha un branch esplicito diverso** da quello dell'agente:

```typescript
{/* Branch badge — only when session has explicit branch different from agent's */}
{session.branch && session.branch !== agentBranch && (
  <span className="session-branch-badge" title={session.branch} style={{...}}>
    {session.branch.length > 12
      ? session.branch.replace(/^(feature|hotfix|bugfix|release)\//, '').substring(0, 10) + '..'
      : session.branch}
  </span>
)}
```

Questo evita ridondanza: se tutte le sessioni sotto `⎇ main` hanno lo stesso branch, non serve ripetere il badge su ogni riga.

## Design Rationale

1. **Gerarchia visiva chiara**:
   - Agente > Branch > Sessioni
   - Il sub-header branch è discreto (9px, `white/40%`, JetBrains Mono)

2. **Padding-left 20px**:
   - Allinea il sub-header alla metro line delle sessioni
   - Crea indentazione visiva gerarchica

3. **Icona Git Branch**:
   - SVG inline, `white/35%`, stroke-width 2
   - Riconoscibile come branch symbol (⎇)

4. **Conteggio sessioni**:
   - `(3)` dopo il nome branch
   - Font 8px, `white/20%` — informativo ma non invadente

## Quando NON Usare

- Se tutte le sessioni di un agente sono sullo stesso branch → il sub-header è ancora utile per consistenza, ma potrebbe essere collassabile
- Se l'agente ha una sola sessione → il sub-header aggiunge un livello gerarchico superfluo, ma manteniamo per consistenza UI

## File Coinvolti

- `src/components/AgentSessionList.tsx` — logica di raggruppamento e rendering sub-header
- `src/components/AgentSessionItem.tsx` — badge branch condizionale (solo se diverso da agentBranch)

## Testing

Scenario:
1. Crea 3 sessioni su `main`
2. Crea 1 sessione su `feature/x` con branch selector
3. La sidebar dovrebbe mostrare 2 sub-header branch

Verifica:
- Le sessioni sono sotto il sub-header corretto
- Il conteggio è accurato
- Il badge arancione appare solo su `feature/x` (se diverso dall'agente)
