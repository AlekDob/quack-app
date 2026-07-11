---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), plain CSS
created: 2026-07-11
last_verified: 2026-07-11
tags: [platform-pin, model-picker, claude-code, cursor-cli, opencode-cli, provider-session, composer, chat-session]
---

## Platform pin (agentic CLI lock per chat)
**Purpose:** Once a chat starts on Claude Code, Cursor CLI, or OpenCode, lock the composer model picker to that platform by default and warn before cross-platform switches — each CLI owns a separate server-side session id; Quack keeps one transcript but tool context does not transfer.
**Stack:** React 19 + `ChatSession` disk persistence + portaled `ModelPickerPopover`

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | `src/chatPinnedProvider.ts` | `resolvePinnedPlatform`, `isCrossPlatformPick`, `crossPlatformSwitchHint`, `platformLabel`, `AGENTIC_PLATFORM_IDS` |
| Component | `src/components/modelPickerPlatform.tsx` | `ModelPickerPlatformBanner`, `ModelPickerPlatformConfirm` |
| Component | `src/components/ModelPickerPopover.tsx` | Filters groups to pinned platform; banner + confirm gate; `onPlatformPin` on confirmed switch |
| Component | `src/components/AIChatPanel.tsx` | Pin on first agentic send; `pinnedPlatform` useMemo; persist/restore `pinnedProviderId` |
| Model/Type | `src/chatHistory.ts` | `ChatSession.pinnedProviderId?: ProviderId` |
| Config | `src/App.css` | `.model-picker-platform-banner`, `.model-picker-platform-confirm`, action buttons |

### UX map
| State | Picker behavior |
|---|---|
| New chat (no user turns) | All platforms visible — no pin yet |
| After first agentic user turn | Pin set to `claude-code` / `cursor-cli` / `opencode-cli` |
| Pinned (default) | Only models from pinned platform; quiet info banner |
| User clicks **Change platform…** | All platforms visible; banner turns warn (yellow) |
| User picks other platform | Inline confirm panel — Cancel or **Switch to …** |
| Confirmed switch | Model updates + `pinnedProviderId` moves to new platform |
| **New chat** | Pin cleared |

### Data Flow
First agentic send (`AIChatPanel.sendUserText`) → `setPinnedProviderId(selectedProvider)` → `saveSession` writes `pinnedProviderId` on disk

Open session → `setPinnedProviderId(s.pinnedProviderId ?? resolvePinnedPlatform(...))` → `ModelPickerPopover` receives `pinnedProviderId={pinnedPlatform}`

Cross-platform pick → `ModelPickerPlatformConfirm` → `applyPick` → `onPlatformPin(newId)` → next send uses new provider's `providerSessionIds[provider]` (fresh CLI session)

### Key Functions
- `resolvePinnedPlatform(session) → ProviderId | null` — explicit pin, else infer from model / `providerSessionIds` (legacy rows)
- `chatHasStarted(session) → boolean` — any `role: "user"` message
- `isCrossPlatformPick(pinned, target) → boolean` — gate before `applyPick`
- `crossPlatformSwitchHint(from, to) → string` — confirm copy
- `platformLabel(id) → string` — UI labels (`Claude Code`, `Cursor CLI`, `OpenCode`)

### State
- `pinnedProviderId`: `ProviderId | undefined` — React state in `AIChatPanel` (session scope)
- `ChatSession.pinnedProviderId`: persisted on disk with transcript (`043`)
- `showAllPlatforms`: `boolean` — popover-local; unlock full catalog temporarily
- `pendingModel`: `ProviderModel | null` — popover-local; cross-platform confirm target

### Agentic platforms (pinned scope)
| `ProviderId` | Label |
|---|---|
| `claude-code` | Claude Code |
| `cursor-cli` | Cursor CLI |
| `opencode-cli` | OpenCode |

Ollama / OpenAI / Anthropic API chats are **not** pinned — no per-chat CLI session id.

### External Dependencies
- Provider session bridge: `044-provider-session-bridge.md` — separate `providerSessionIds` per platform
- Model selector: `025-model-selector.md` — popover host + group filter

### Gotchas
- **Transcript vs CLI memory** — Quack messages survive a platform switch; server-side tool state does not.
- **Legacy sessions** — no `pinnedProviderId` field until first save after upgrade; `resolvePinnedPlatform` infers from first agentic model or existing CLI link.
- **Model Browser** — full catalog modal (`ModelBrowser`) is not platform-filtered yet; quick picker is the primary gate.
- **Confirm updates pin** — intentional switch re-pins to the new platform so the user is not nagged on every open.
- **API providers unaffected** — pin logic runs only for `isAgenticProviderId` on first user turn.

### Related features
- `044-provider-session-bridge.md` — why separate CLI ids exist
- `025-model-selector.md` — composer chip popover
- `043-chat-transcript-persistence.md` — `pinnedProviderId` on disk row
