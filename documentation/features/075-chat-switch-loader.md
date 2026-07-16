---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-16
last_verified: 2026-07-16
tags: [chat-switch, loader, veil, transition, ux, perceived-performance, quack-v1]
---

## Chat / session switch loader (gradual veil)

**Purpose:** A gradual translucent loader shown while switching chat / session,
so swapping the whole chat panel reads as a smooth transition instead of a hard
content pop. Perceived-performance polish (inspired by spaceship-ai's entry
transition); the actual switch is already fast after the freeze fix (`044`).

### Behaviour

| Phase | What happens |
|---|---|
| Pulse | On any chat/session switch, `pulseChatSwitch({ veil: true })` sets `switching = true` immediately |
| Fade in | Veil fades in over ~240ms — translucent glass + blur over the chat host (context stays faintly visible) |
| Min floor | Stays up at least **240ms** even if hydration is instant, so a fast switch still fades gently (no flash) |
| End | `endChatSwitch()` (from the panel's `onHydrated`) ends the pulse after the floor; veil fades out and unmounts |
| Cap | A **1000ms** fallback ends the pulse even if `onHydrated` never fires |

### Where it lives

| Concern | File |
|---|---|
| Pulse store (timing, min floor, cap) | `src/chatSwitch.ts` → `pulseChatSwitch`, `endChatSwitch`, `isChatSwitching`, `subscribeChatSwitch` |
| Subscribe hook | `src/useChatSwitching.ts` (`useSyncExternalStore`) |
| Veil component (fade in/out) | `src/components/ChatSwitchVeil.tsx` |
| Styles | `src/App.css` → `.chat-switch-veil`, `.chat-switch-veil-bar`, `@keyframes chatSwitchBar` |
| Triggers | `AgentModeShell.tsx` (`selectSession`), `AIChatsRail.tsx` (`focusChat`) |
| Hosts (mount points) | `AgentModeShell.tsx`, `TabContentHost.tsx`, `WorkspaceShell.tsx` |
| End signal | `AIChatPanel.tsx` `onHydrated` → host `endChatSwitch()` |

### Timing constants

| Constant | Value | File |
|---|---|---|
| `MIN_VISIBLE_MS` | 240 | `chatSwitch.ts` |
| `CAP_MS` | 1000 | `chatSwitch.ts` |
| `FADE_MS` (opacity transition) | 240 | `ChatSwitchVeil.tsx` + `.chat-switch-veil` CSS (must match) |

### Visual

- Translucent `--bg` wash (`color-mix ... 78%`) + `backdrop-filter: blur(10px)` — gradual, not a solid blank.
- Slim indeterminate progress sweep at the top edge (`.chat-switch-veil-bar`), neutral `--fg` (brand: monochrome, no color).
- Centered `.ai-spinner` + "Loading chat…" label.
- `prefers-reduced-motion`: opacity transition + bar animation disabled.

### Design notes / gotchas

- **Always mounted, self-fading** — hosts render `<ChatSwitchVeil active={showVeil} />` unconditionally (not `{showVeil && …}`); the component keeps itself mounted through the fade-OUT (`FADE_MS`) so there's no instant pop-out. `active` defaults to the global `useChatSwitching()`; hosts pass a **foreground-gated** flag (`switching && visible`) so a background/non-visible panel never flashes the veil.
- **Min floor lives in `chatSwitch.ts`, not the component** — `endChatSwitch` defers the end to `max(0, MIN_VISIBLE_MS - elapsed)`. Without it, the now-fast hydration would drop the veil in <100ms → a flash.
- **`.is-switching` (raw `switching`) hides stale chat content** during the switch (`visibility: hidden`) so the old transcript isn't seen under the blur; it clears at `finish()` while the veil is still fading out → content reveals smoothly under the fading veil.
- **Veil ≠ freeze fix** — this is cosmetic. The switch was made actually fast by the provider-session JSONL-parse fix in `044`.

### Related features

- Provider session bridge + freeze fix: `044-provider-session-bridge.md`
- Chat tab switch / drawer: `064-agent-hub-drawer-and-chat-tab-switch.md`
- Workspace switch performance: `058-workspace-switch-performance.md`
- Session library: `001-ai-session-library.md`

### Future

- Optional Quack duck mark (`AIIcon`, feature `005`) instead of the generic spinner.
- Tune `MIN_VISIBLE_MS` per switch kind (same-ws vs cross-workspace cold mount).
