---
type: bug_fix
project: quack-app
created: 2026-02-24
last_verified: 2026-02-24
tags: [claude-agent-sdk, plan-mode, ExitPlanMode, duplicate, canUseTool]
---

# Bug: Duplicate Plan Approval Requests (Plan Re-entry After Approval)

## Problema

Quando un agente gira con `permissionMode: 'plan'`, dopo che l'utente approva il piano tramite ExitPlanMode, il SDK ri-entra in plan mode causando una **seconda** richiesta di approvazione identica. L'agente stesso nota il problema: "I see the system has re-entered plan mode. But the user already approved my plan."

## Root Cause

Il processo Node.js SDK viene avviato con `permissionMode: 'plan'` e questo valore persiste per **tutta la durata della sessione**. Dopo che ExitPlanMode viene approvato via `canUseTool → allow`, il SDK permette all'agente di procedere. Tuttavia, in sessioni multi-step (agentic loop), il SDK può ri-forzare il plan mode al turno successivo perché la configurazione di sessione non è cambiata.

Lato frontend, `updateAgentSettings({ permissionMode: 'bypass' })` cambia solo lo state UI per le sessioni **future**, non il processo già in esecuzione.

## Soluzione

Aggiunto flag `planAlreadyApproved` in `stream-claude.js`, scoped alla singola sessione:

```javascript
let planAlreadyApproved = false;

// In canUseTool:
if (toolName === 'ExitPlanMode') {
  if (planAlreadyApproved) {
    // Auto-approve — plan was already approved in this session
    return { behavior: 'allow', updatedInput: input };
  }

  // ... normal approval flow ...

  if (isApproved) {
    planAlreadyApproved = true;
    return { behavior: 'allow', updatedInput: input };
  }
  // If rejected, flag stays false — agent can revise and resubmit
}
```

## Comportamento

| Scenario | Prima | Dopo |
|----------|-------|------|
| Prima ExitPlanMode | Widget "Awaiting Approval" | Widget "Awaiting Approval" (invariato) |
| SDK ri-entra in plan mode | Secondo widget "Awaiting Approval" | Auto-approvato silenziosamente |
| Piano rifiutato + nuovo piano | N/A | Mostra widget normalmente |

## File Modificati

- `src-tauri/node-sdk/stream-claude.js` — flag `planAlreadyApproved` + early return in canUseTool

## Breadcrumb

Cercare `// Brain: fix-duplicate-plan-approval` nel codice.
