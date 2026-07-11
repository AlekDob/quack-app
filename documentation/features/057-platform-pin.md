---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), plain CSS
created: 2026-07-11
last_verified: 2026-07-11
tags: [platform-pin, model-picker, claude-code, cursor-cli, opencode-cli, provider-session, composer, chat-session]
---

## Platform pin (agentic CLI lock per chat)
**Purpose:** Once a chat starts on Claude Code, Cursor CLI, or OpenCode, lock the composer model picker to that platform. Each CLI owns a separate server-side session id; Quack keeps one transcript but tool context does not transfer — so cross-platform switches require a **new chat**, not an in-place model pick.
**Stack:** React 19 + `ChatSession` disk persistence + portaled `ModelPickerPopover`

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | `src/chatPinnedProvider.ts` | `resolvePinnedPlatform`, `platformLabel`, `AGENTIC_PLATFORM_IDS` |
| Component | `src/components/modelPickerPlatform.tsx` | `ModelPickerPlatformBanner` — one-line hint + **New chat** |
| Component | `src/components/ModelPickerPopover.tsx` | Hard filter to pinned platform; banner when pinned |
| Component | `src/components/AIChatPanel.tsx` | Pin on first agentic send; `pinnedPlatform` useMemo; `onNewChat` |
| Model/Type | `src/chatHistory.ts` | `ChatSession.pinnedProviderId?: ProviderId` |
| Config | `src/App.css` | `.model-picker-platform-banner`, `.model-picker-platform-action` |

### UX map
| State | Picker behavior |
|---|---|
| New chat (no user turns) | All platforms visible — no pin yet; **selected provider's group floats to top** |
| After first agentic user turn | Pin set to `claude-code` / `cursor-cli` / `opencode-cli` |
| Pinned | **Only** models from pinned platform; quiet info banner + **New chat** button |
| User wants another CLI | Click **New chat** — pin cleared on fresh session |
| **New chat** | Pin cleared |

**Removed (2026-07-11):** "Change platform…" unlock, inline cross-platform confirm panel, and re-pin on confirmed switch — too easy to accidentally split CLI memory; **New chat** is the only supported path.

### Data Flow
First agentic send (`AIChatPanel.sendUserText`) → `setPinnedProviderId(selectedProvider)` → `saveSession` writes `pinnedProviderId` on disk

Open session → `setPinnedProviderId(s.pinnedProviderId ?? resolvePinnedPlatform(...))` → `ModelPickerPopover` receives `pinnedProviderId={pinnedPlatform}`

Cross-platform need → user starts **New chat** → new `ChatSession` without pin until first send

### Key Functions
- `resolvePinnedPlatform(session) → ProviderId | null` — explicit pin, else infer from model / `providerSessionIds` (legacy rows)
- `chatHasStarted(session) → boolean` — any `role: "user"` message
- `platformLabel(id) → string` — UI labels (`Claude Code`, `Cursor CLI`, `OpenCode`)
- `reorderGroupsFirst(groups, providerId)` — unpinned chats: active provider section first (`025`)

### State
- `pinnedProviderId`: `ProviderId | undefined` — React state in `AIChatPanel` (session scope)
- `ChatSession.pinnedProviderId`: persisted on disk with transcript (`043`)

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
- **Transcript vs CLI memory** — Quack messages survive across chats; server-side tool state does not transfer when switching platform.
- **Legacy sessions** — no `pinnedProviderId` field until first save after upgrade; `resolvePinnedPlatform` infers from first agentic model or existing CLI link.
- **Model Browser** — full catalog modal (`ModelBrowser`) is not platform-filtered yet; quick picker is the primary gate.
- **API providers unaffected** — pin logic runs only for `isAgenticProviderId` on first user turn.
- **Cursor effort** — not a separate Quack control; effort tiers appear as distinct models in Cursor's `--list-models` (`026`).

### Related features
- `044-provider-session-bridge.md` — why separate CLI ids exist
- `025-model-selector.md` — composer chip popover
- `043-chat-transcript-persistence.md` — `pinnedProviderId` on disk row
- `059-claude-code-model-catalog.md` — CC dynamic display names when pinned to Claude Code
