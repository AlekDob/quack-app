---
type: bug_fix
created: 2026-02-09
tags: [claude-agent-sdk, plan-mode, permissions, canUseTool]
---

# Bug: Plan Mode Auto-Approval Without User Interaction (SDK 0.2.1)

## Problema

Con Claude Agent SDK 0.2.1, i piani creati dall'agente in `plan` mode venivano auto-approvati senza alcuna richiesta all'utente. Il piano veniva mostrato nell'UI con il testo "Review the plan above and respond to proceed", ma l'esecuzione partiva immediatamente senza attendere l'approvazione.

## Root Cause

Nel file `src-tauri/node-sdk/stream-claude.js`, il callback `canUseTool` gestiva solo `AskUserQuestion` con flusso interattivo:

```javascript
canUseTool: async (toolName, input, options) => {
  if (toolName === 'AskUserQuestion') {
    // ... flusso interattivo con requestFromFrontend
  }

  // Default: allow all other tools
  return {
    behavior: 'allow',
    updatedInput: input,
  };
}
```

Quando l'agente chiama `ExitPlanMode` per uscire dal plan mode, il `canUseTool` faceva `allow` automaticamente senza coinvolgere l'utente.

### Cambio comportamento SDK

Nelle versioni precedenti dell'SDK, il `plan` mode gestiva internamente l'approvazione del piano. Con SDK 0.2.1, l'SDK **delega l'approvazione al callback `canUseTool`** - esattamente come fa per `AskUserQuestion`.

## Soluzione

Implementato lo stesso pattern di `AskUserQuestion` per `ExitPlanMode`:

### 1. Backend Node.js (`stream-claude.js`)

```javascript
if (toolName === 'ExitPlanMode') {
  const response = await requestFromFrontend('plan_approval_request', {
    plan: input,
  }, 0);

  const answers = response.answers || response;
  const isApproved = answers.approved === 'true' || answers.approved === true;

  if (isApproved) {
    return { behavior: 'allow', updatedInput: input };
  } else {
    const feedback = answers.feedback || 'User rejected the plan';
    return { behavior: 'deny', message: feedback };
  }
}
```

### 2. Backend Rust (`claude_cli.rs`)

Aggiunto nuovo evento:

```rust
#[serde(rename = "plan_approval_request")]
PlanApprovalRequest {
    #[serde(rename = "requestId")]
    request_id: String,
    plan: serde_json::Value,
    #[serde(flatten)]
    extra: serde_json::Value,
}
```

Handling evento:

```rust
ClaudeEvent::PlanApprovalRequest { request_id, plan, .. } => {
    let payload = serde_json::json!({
        "requestId": request_id,
        "plan": plan,
        "agentId": agent_id,
        "sessionKey": event_session_key
    });
    app.emit("plan-approval-request", payload);
}
```

### 3. Frontend (`App.tsx`)

State management:

```typescript
const [pendingPlanApprovals, setPendingPlanApprovals] = useState<
  Map<string, { agentId: string; sessionKey?: string; plan: unknown }>
>(new Map());
```

Listener globale:

```typescript
listen<{
  requestId: string;
  plan: unknown;
  agentId: string;
  sessionKey?: string;
}>('plan-approval-request', async (event) => {
  setPendingPlanApprovals((prev) => {
    const next = new Map(prev);
    next.set(requestId, { agentId, sessionKey, plan });
    return next;
  });

  // Desktop notification
  await sendNotification({
    title: `${agentName} needs plan approval`,
    body: 'Review and approve the plan to proceed',
  });
});
```

Funzione di risposta (riusa `answerUserQuestionViaStdin`):

```typescript
const respondToPlanApproval = useCallback(async (
  requestId: string,
  approved: boolean,
  feedback?: string
) => {
  // Send via stdin - backend expects { requestId, answers } format
  await answerUserQuestionViaStdin(
    processKey,
    requestId,
    { approved: approved ? 'true' : 'false', feedback: feedback || '' }
  );
}, [pendingPlanApprovals]);
```

### 4. UI (`PlanWidget.tsx`)

Bottoni interattivi:

```tsx
{isPendingApproval ? (
  <div className="plan-approval-actions">
    {showFeedbackInput ? (
      // Feedback input + Reject + Cancel
    ) : (
      // Approve (green) + Reject (red) buttons
    )}
  </div>
) : isResponded ? (
  <div className="plan-widget-approved">
    Plan approved
  </div>
) : (
  <div className="plan-widget-info">
    Review the plan above and respond to proceed
  </div>
)}
```

Badge animato quando in attesa:

```tsx
<span className={`plan-widget-badge ${isPendingApproval ? 'plan-widget-badge-pending' : ''}`}>
  {isPendingApproval ? 'Awaiting Approval' : 'Plan Mode'}
</span>
```

## Files Modificati

1. `src-tauri/node-sdk/stream-claude.js` - Handling ExitPlanMode in canUseTool
2. `src-tauri/src/claude_cli.rs` - Nuovo evento PlanApprovalRequest
3. `src/App.tsx` - State + listener + respondToPlanApproval
4. `src/components/PlanWidget.tsx` - UI Approve/Reject
5. `src/components/PlanWidget.css` - Stili bottoni + animazioni
6. Props chain: `ChatView.tsx`, `MessageList.tsx`, `ChatMessage.tsx`, `StreamMessage.tsx`, `ToolWidgets.tsx`

## Pattern Chiave

Il pattern e' **identico** a `AskUserQuestion`:

1. **Backend emette evento** con `requestId` via stdout → Rust lo parsa
2. **Rust emette evento Tauri** al frontend
3. **Frontend mostra UI** e aspetta input utente
4. **Frontend invia risposta** via `invoke('answer_user_question', { requestId, answers })`
5. **Rust scrive su stdin** del processo Node
6. **Backend risolve promise** e ritorna `allow` o `deny` all'SDK

## Testing

Per testare:
1. Crea un agente con `permissionMode: 'plan'`
2. Chiedi all'agente di pianificare qualcosa
3. Quando mostra il piano, verifica che:
   - Badge diventa "Awaiting Approval" (amber, animato)
   - Compaiono bottoni Approve (verde) e Reject (rosso)
   - L'esecuzione NON parte finche' non clicchi Approve
   - Reject mostra campo feedback opzionale

## Riferimenti

- [Claude Agent SDK - Permissions](https://platform.claude.com/docs/en/agent-sdk/permissions)
- [Claude Agent SDK - User Input](https://platform.claude.com/docs/en/agent-sdk/user-input)
