---
type: feature-doc
project: synara
stack: React / TypeScript
created: 2026-08-11
last_verified: 2026-08-12
status: active
tags: [claude-agent, auth, recovery, terminal, transcript]
---

## Claude Auth Recovery

**Purpose:** When a Claude Agent thread's last run failed on an authentication error, show a card in the transcript that lets the user open a login terminal, then auto-closes once they've re-authenticated.
**Stack:** React / TypeScript (apps/web)

### Files

| Type      | Path                                                           | Exports/Purpose                                                                                |
| --------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Component | `apps/web/src/components/chat/ClaudeAuthRecoveryCard.tsx`      | `ClaudeAuthRecoveryCard`, `ClaudeAuthRecoveryStatus` type — unauthenticated states only        |
| Consumer  | `apps/web/src/components/ChatView.tsx`                         | Detects the failure, opens the login terminal, polls provider status, clears the error on auth |
| Logic     | `apps/web/src/components/chat/MessagesTimeline.logic.ts`       | `deriveMessagesTimelineRows` accepts `claudeAuthRecovery` (status/error/unavailableReason)     |
| Component | `apps/web/src/components/chat/MessagesTimeline.tsx`            | Renders the card as a timeline row, indented on the shared avatar-gutter grid                  |
| Test      | `apps/web/src/components/chat/ClaudeAuthRecoveryCard.test.tsx` | Card states: idle/opening/open/failed                                                          |

### Data Flow

- `ChatView` derives `hasClaudeAuthRecovery` from `isClaudeAuthenticationFailedError(sessionProvider, activeThread?.error)` — true only for a Claude Agent thread whose last error was an auth failure.
- `isClaudeAuthenticated` reads `serverConfigQuery.data.providers` for `provider === "claudeAgent"` with `available && authStatus === "authenticated"`.
- While the card is open (`activeClaudeAuthRecoveryState.status === "open"`) and not yet authenticated, a `ChatView` effect polls `refreshProviderStatuses({ silent: true })` every 3s so the auth status can flip without a manual reload.
- A second `ChatView` effect watches `hasClaudeAuthRecovery && isClaudeAuthenticated` and calls `dismissActiveThreadError()` — this clears `activeThread.error`, which is the only thing `hasClaudeAuthRecovery` is derived from. The card unmounts as a side effect; there is no separate "authenticated" render state anymore.
- Card state (`idle | opening | open | failed`, `terminalId`, `error`) is keyed per-thread in `claudeAuthRecoveryStates` and passed into `MessagesTimeline` as `claudeAuthRecovery`.

### Key Functions

- `ChatView.openClaudeAuthRecovery()` — opens (or focuses) a terminal in the thread's working directory to run the Claude login flow; no-ops if the thread has no working directory (`claudeAuthRecoveryUnavailableReason`).
- `ClaudeAuthRecoveryCard({ status, error, unavailableReason, onOpen, onDismiss })` — pure presentational card; always in the "not authenticated" state ("Accedi a Claude" + open-terminal button) since the parent unmounts it once authenticated.

### State

- `claudeAuthRecoveryStates: Record<threadKey, { status, terminalId, error }>` — component-level, one entry per thread that has hit this recovery path.
- No new global store — the auth-status poll reuses the existing `serverConfigQuery` / `useRefreshProviderStatusesNow`.

### Behavior

- The polling interval only runs while the card is open and unauthenticated; it clears on unmount, on dismiss, or as soon as `isClaudeAuthenticated` flips true.
- Copy is Italian-first (`Accedi a Claude`, `Apri terminale`), per this project's UI language convention.
- The card renders on the same left-gutter grid as assistant replies and tool groups: an empty `ChatStreamAvatarSlot` + `CHAT_STREAM_AVATAR_GAP_CLASS_NAME` wrapper, so it starts on the message text edge instead of hugging the pane border (ALE-16).

### Fixed (2026-08-12, ALE-16)

- **Card never closed after login.** It was built to render a "Login effettuato" state from an `authenticated` prop, but that prop never reached `ClaudeAuthRecoveryCard` — `MessagesTimeline`'s row type dropped it — and even if it had, nothing cleared `activeThread.error`, which is what actually gates `hasClaudeAuthRecovery`. Root-caused by clearing the error on auth instead of patching the display; the dead "authenticated" branch, prop, and test case were removed.
- **Not indented.** Card sat flush against the pane edge instead of aligned with the rest of the transcript. Fixed by reusing the shared avatar-slot/gap pattern other timeline rows already use.

### Out of scope (deliberately not built)

- Recovery for other providers' auth failures (Codex, Grok, etc.) — this card is Claude-Agent-specific.

### Vincoli React Compiler (2026-08-12)

`ChatView.tsx` è coperto da `chatHotPath.compiler.test.ts`: un bailout fa perdere
l'auto-memoizzazione all'intero componente. Il flusso di recovery ne ha attivati due,
entrambi risolti sollevando il valore fuori dalla closure:

- il messaggio d'errore nel `catch` di `openClaudeAuthRecovery` va calcolato in un
  `const` prima di entrare nell'updater di `setState` (un value block letto dentro una
  closure dichiarata in `catch` viola un invariante del compiler);
- la dependency list manuale non può nominare `activeThread?.worktreePath`: il compiler
  inferisce `activeThread`. Serve un `const claudeAuthRecoveryWorktreePath` prima della
  `useCallback`, usato sia nel corpo sia nelle dipendenze.
