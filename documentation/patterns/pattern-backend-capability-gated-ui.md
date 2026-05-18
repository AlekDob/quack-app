---
type: pattern
project: quack-app
created: 2026-05-16
last_verified: 2026-05-16
tags: [codex, multi-backend, ui, capability-gate, sessionStore, agent-abstraction]
---
# Pattern: capability-gate Claude-only UI for non-Claude session backends

## When to apply

Whenever you add or touch UI that exposes **Claude-specific controls** —
provider router, model picker, effort, thinking mode, permission mode, token
stats keyed to Claude usage shapes — you MUST gate it for sessions whose
`backend !== 'claude'` (currently Codex; more backends per
`decision-quack-abstraction-agent-level-not-model-level`). A Codex session must
not show Claude provider/model controls: Codex manages its own model
(`gpt-5-codex`), send-routing passes `model: null`, so those controls are inert
and actively misleading. Trigger phrases: "add model/provider/effort control",
"chat settings", "per-turn model label", "session-scoped Claude option".

## The pattern

1. **Derive the backend flag from `sessionStore` with a selector placed NEXT TO
   the consumption site** — do not deep prop-drill a `backend` boolean through
   many component layers. Mirror the existing `sessionTitle` selector pattern:

   ```ts
   // in the component that already knows the session id (e.g. ChatView)
   const isCodexSession = useSessionStore(s => {
     const sid = internalSessionId || currentSessionId;
     if (!sid) return false;
     return s.sessions.find(sess => sess.id === sid)?.backend === 'codex';
   });
   ```
   Then thread ONE optional boolean prop the short remaining distance
   (`settingsProps.isCodexSession` → `UnifiedActionBar` → `ChatSettingsMenu`).
   Optional prop + selector keeps the change additive and Claude-path inert.

2. **Gate render with a behavior-preserving conditional.** Hide the Claude
   sections and show a compact backend indicator instead. Wrap existing JSX in
   `{!isCodexSession && (<>…</>)}` (no re-indentation of the existing block) and
   add the Codex panel before it. For value props (e.g. a per-message model
   label), use a ternary whose `else` is the **exact original expression** so
   non-Codex resolves byte-identically:

   ```ts
   model: currentSession?.backend === 'codex' ? 'gpt-5-codex' : getActiveModelName(options?.model),
   ```

3. **Zero Claude regression is the gate.** `isCodexSession === false` must
   reproduce the prior behavior exactly. Verify with `tsc --noEmit` + reasoning
   that the `else`/`!isCodexSession` branch is the untouched original.

## Why (load-bearing rationale)

- The abstraction is at the **agent level, not model level**
  (`decision-quack-abstraction-agent-level-not-model-level`): Quack does not
  reimplement model selection for non-Claude backends. So the UI must *gate*,
  not *extend*, Claude controls.
- The 037 provider router (`ChatSettingsMenu` PROVIDER/MODEL/MODE/EFFORT) is
  Claude-only by construction; Codex send-routing bypasses it entirely
  (`send_message_via_codex` gets `model: null`). Showing it on a Codex session
  is a real UX defect, surfaced on the first live GUI test of M1 Codex.
- Selector-near-consumption beats prop-drill: fewer files touched, lower
  Claude-regression surface, and the flag stays correct as the user switches
  sessions (store-driven, not stale props).

## Reference implementation

- `src/components/ChatView.tsx` — `isCodexSession` sessionStore selector +
  `settingsProps.isCodexSession`.
- `src/components/chat/UnifiedActionBar.tsx` — optional `isCodexSession` in
  `SettingsProps`, passed through.
- `src/components/ChatSettingsMenu.tsx` — trigger summary + popover gated;
  `{!isCodexSession && (<>…</>)}` wrap + Codex indicator panel.
- `src/App.tsx` `sendMessageForAgent` — per-message model label ternary.
- Commits `2395254`, `f7ad8cb` (branch `038-codex-backend-m1`).

## Known follow-up

Same model-label ternary still needed in `sendMessageForAgent`'s sibling
`sendMessageForTargetAgent` (`src/App.tsx:~3883`, automation/remote/team send
path) if Codex sessions are ever routed through it.

## Brain breadcrumb

Code touching this pattern carries
`// Brain: decision-quack-abstraction-agent-level-not-model-level` (the parent
architectural decision); this pattern is the UI-side companion.
