---
type: bug
project: quack-app
created: 2026-05-22
last_verified: 2026-05-22
tags: [codex, backend, new-session, session-creation, agent-screen, regression-risk]
---

# Fix: "+ New Session" on Agent screen always spawned Anthropic (ignored Codex backend)

## Symptom
Picking `Codex (gpt-5-codex)` in the `NewSessionModal` worked when opened from the **sidebar agent `+`** (RepositoryGroup flow), but the **agent overview "+ New Session" button** (`SessionEmptyState`) always created a Claude/Anthropic session regardless of the choice.

## Root cause
`NewSessionModal.onSubmit` signature is `(title, branch, useWorktree, backend)`. `RepositoryGroup.tsx:1340` consumed all four and passed `backend: backend ?? 'claude'` to `createSession`. `SessionEmptyState.tsx:86` declared `handleNewSession(title, branch?, useWorktree?)` — the 4th arg was dropped on the floor, and `createSession` defaulted to `claude` server-side.

Two parallel entry points to the same modal, only one had the backend wired.

## Fix
`src/components/SessionEmptyState.tsx`:
1. Import `AgentBackendKind` from `../types/agentBackend`.
2. Add `backend?: AgentBackendKind` to `handleNewSession`.
3. Pass `backend: backend ?? 'claude'` to `createSession({...})`.

Mirrors the sidebar flow exactly. One-line semantic change.

## Prevention
Any new entry point that opens `NewSessionModal` must forward all 4 onSubmit args. Consider extracting a shared `submitNewSession(agent, title, branch, useWorktree, backend)` helper if a third caller appears.
