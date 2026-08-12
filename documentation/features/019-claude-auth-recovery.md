---
type: feature-doc
project: synara
stack: React / TypeScript
created: 2026-08-11
last_verified: 2026-08-11
status: active
tags: [claude-agent, auth, recovery, terminal, transcript]
---

## Claude Auth Recovery

**Purpose:** When a Claude Agent thread's last run failed on an authentication error, show a card in the transcript that lets the user open a login terminal, then auto-detects when they've re-authenticated.
**Stack:** React / TypeScript (apps/web)

### Files

| Type      | Path                                                           | Exports/Purpose                                                                                          |
| --------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Component | `apps/web/src/components/chat/ClaudeAuthRecoveryCard.tsx`      | `ClaudeAuthRecoveryCard`, `ClaudeAuthRecoveryStatus` type                                                |
| Consumer  | `apps/web/src/components/ChatView.tsx`                         | Detects the failure, opens the login terminal, polls provider status while card is open                  |
| Logic     | `apps/web/src/components/chat/MessagesTimeline.logic.ts`       | `deriveMessagesTimelineRows` accepts `claudeAuthRecovery` (status/authenticated/error/unavailableReason) |
| Component | `apps/web/src/components/chat/MessagesTimeline.tsx`            | Renders the card as a timeline row when `claudeAuthRecovery` is set                                      |
| Test      | `apps/web/src/components/chat/ClaudeAuthRecoveryCard.test.tsx` | Card states: idle/opening/open/failed, authenticated                                                     |

### Data Flow

- `ChatView` derives `hasClaudeAuthRecovery` from `isClaudeAuthenticationFailedError(sessionProvider, activeThread?.error)` — true only for a Claude Agent thread whose last error was an auth failure.
- `isClaudeAuthenticated` reads `serverConfigQuery.data.providers` for `provider === "claudeAgent"` with `available && authStatus === "authenticated"`.
- While the card is open (`activeClaudeAuthRecoveryState.status === "open"`) and not yet authenticated, a `ChatView` effect polls `refreshProviderStatuses({ silent: true })` every 3s so the card flips to the authenticated state without a manual reload.
- Card state (`idle | opening | open | failed`, `terminalId`, `error`) is keyed per-thread in `claudeAuthRecoveryStates` and passed into `MessagesTimeline` as `claudeAuthRecovery`.

### Key Functions

- `ChatView.openClaudeAuthRecovery()` — opens (or focuses) a terminal in the thread's working directory to run the Claude login flow; no-ops if the thread has no working directory (`claudeAuthRecoveryUnavailableReason`).
- `ClaudeAuthRecoveryCard({ status, authenticated, error, unavailableReason, onOpen, onDismiss })` — pure presentational card; shows "Accedi a Claude" / open-terminal button, or "Login effettuato" with a dismiss-only button once `authenticated`.

### State

- `claudeAuthRecoveryStates: Record<threadKey, { status, terminalId, error }>` — component-level, one entry per thread that has hit this recovery path.
- No new global store — the auth-status poll reuses the existing `serverConfigQuery` / `useRefreshProviderStatusesNow`.

### Behavior

- The polling interval only runs while the card is open and unauthenticated; it clears on unmount, on dismiss, or as soon as `isClaudeAuthenticated` flips true.
- Copy is Italian-first (`Accedi a Claude`, `Apri terminale`, `Login effettuato`), per this project's UI language convention.

### Out of scope (deliberately not built)

- Auto-closing the card after authentication — the user still dismisses it manually.
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
