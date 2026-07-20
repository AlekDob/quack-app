---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-16
last_verified: 2026-07-20
tags: [chat-switch, loader, veil, transition, ux, perceived-performance, quack-v1, chrome-freeze, new-chat]
---

## Chat / session switch loader (gradual veil)

**Purpose:** A gradual translucent loader shown while switching chat / session,
so swapping the whole chat panel reads as a smooth transition instead of a hard
content pop. Perceived-performance polish (inspired by spaceship-ai's entry
transition); the actual switch is already fast after the freeze fix (`044`).

### Chrome freeze (2026-07-17)

While `isChatSwitching()` is true, editor chrome yields the main thread to the
transcript host. **Full contract:** `081-chat-switch-chrome-freeze.md`.

| Surface | Behavior |
|---|---|
| Sidebar / agent context | `.is-chat-switch-frozen` → `content-visibility: hidden` on section bodies |
| Monaco file tabs | `FileTabHost` passes `paneVisible={false}` → skips `ed.layout()` |
| FileTree `listDir` | Deferred via `runOrDeferDuringChatSwitch` until veil drops |

### Behaviour

| Phase | What happens |
|---|---|
| Pulse | On any chat/session switch, `pulseChatSwitch({ veil: true })` sets `switching = true` immediately |
| Fade in | **Immediate** opacity 1 (`useLayoutEffect`) — no fade-in rAF (that left opacity 0 while the main thread painted dense transcripts → blank stall, no spinner) |
| Min floor | **Adaptive** (`veilFloorMs`): instant hydrate (≤60ms) → **160ms**; mid → pad to **220ms**; already ≥220ms → **no padding** |
| End | `endChatSwitch()` after transcript commit (`flushSync` under veil + double-rAF); veil fades out |
| Cap | **1000ms** from pulse, **refreshed** on hydrate start (`noteChatSwitchProgress`) so long paints don't lose the veil mid-commit |

**One global overlay, not per-host.** Mounted once at the app root with
`global` (`position: fixed`, full window), driven by the global `switching`
pulse. Earlier it was per-host (`active={switching && visible}`), which showed
on same-project switches but **missed cross-project switches** — mid-switch the
old workspace host unmounts and the new one isn't `visible` yet, so no host
rendered the veil and the app felt "stuck". A single root overlay shows on
EVERY switch.

### Where it lives

| Concern | File |
|---|---|
| Pulse store (timing, min floor, cap) | `src/chatSwitch.ts` → `pulseChatSwitch`, `endChatSwitch`, `isChatSwitching`, `subscribeChatSwitch` |
| Subscribe hook | `src/useChatSwitching.ts` (`useSyncExternalStore`) |
| Veil component (fade in/out, `global` variant) | `src/components/ChatSwitchVeil.tsx` |
| Global mount point | `src/App.tsx` → `<ChatSwitchVeil global />` (one instance, app root) |
| Styles | `src/App.css` → `.chat-switch-veil`, `.chat-switch-veil--global`, `.chat-switch-veil-bar`, `@keyframes chatSwitchBar` |
| Triggers | `AgentModeShell.selectSession`, `AIChatsRail.focusChat`, **`addNewAIChat`** (`veil: true` + `chatId`) |
| End signal | `AIChatPanel.tsx` `onHydrated` → host `endChatSwitch()` (empty new chats finish hydrate sync — adaptive floor still applies) |
| Console trace | `src/chatSwitchDebug.ts` → `[chat-switch]` |
| Test | `src/chatSwitch.test.ts` — `veilFloorMs` |

### Timing constants

| Constant | Value | File |
|---|---|---|
| `MIN_VISIBLE_FAST_MS` | 160 | `chatSwitch.ts` — warm / ≤60ms hydrate |
| `MIN_VISIBLE_MS` | 220 | `chatSwitch.ts` — soft pad ceiling |
| `CAP_MS` | 1000 | `chatSwitch.ts` |
| `FADE_MS` (opacity transition) | 160 | `ChatSwitchVeil.tsx` + `.chat-switch-veil` CSS (must match) |

### Visual

- Translucent `--bg` wash (`color-mix ... 78%`) + `backdrop-filter: blur(10px)` — gradual, not a solid blank.
- Slim indeterminate progress sweep at the top edge (`.chat-switch-veil-bar`), neutral `--fg` (brand: monochrome, no color).
- Centered `.ai-spinner` + "Loading chat…" label.
- `prefers-reduced-motion`: opacity transition + bar animation disabled.

### Design notes / gotchas

- **Agent Mode mount during veil** — do not gate `shouldKeepChatHostMounted` on `!switching`. The pulse target / active chat must stay mounted so hydrate runs under the loader; otherwise work starts after `CAP_MS` (1s) and the user sees multi-second stalls. Surface hide stays on `.is-switching`.
- **Global overlay, self-fading** — mounted once at the app root as `<ChatSwitchVeil global />`; the component keeps itself mounted through the fade-OUT (`FADE_MS`) so there's no instant pop-out. Driven by the global `useChatSwitching()`. (An `active` prop still exists for scoping to a container, but the shipped design is the single global veil — a per-host veil missed cross-project switches.)
- **Show is synchronous (2026-07-20)** — fade-in via rAF left `.chat-switch-veil` at opacity 0 while `startTransition` + 30-msg commit blocked the main thread; users saw a blank stall and no spinner; CAP often won before `hydrate done`. Fix: opaque on pulse (`useLayoutEffect`), `flushSync(apply)` under veil, `noteChatSwitchProgress` on hydrate start.
- **Veil-down must not use `setTimeout(0)` when remain is 0 (prod 2026-07-20)** — Audit: `end scheduled` 249ms / `remainMs: 0` → `veil down` **4928ms**. The timer sat behind main-thread work while Agent Mode `visibility:hidden` on the whole chat column deferred layout. Fix: `finish()` sync when `remain <= 0`; let the target host paint under the veil (no column-wide hide).
- **Min floor lives in `chatSwitch.ts`, not the component** — `endChatSwitch` uses `veilFloorMs(elapsed)`. Fixed 320 padded every warm hop; adaptive keeps a brief wash on instant hydrate and drops ASAP when load already took ≥220ms.
- **`.is-switching` no longer blanks the incoming transcript** — global veil covers; target host stays visible/paintable underneath so reveal is cheap.
- **New chat uses the same veil (2026-07-20)** — `addNewAIChat` pulses `veil: true` + `chatId`. Instant hydrate → ~160ms floor (covers most of ~200ms paint). Pulse **after** `chatId` exists so Agent Mode keeps the host mounted.
- **`veil: false` still clears a prior pulse** — if something skips the loader while `switching === true`, hosts stay `!is-visible` until CAP. Prefer `veil: true` + correct `chatId`.
- **Veil ≠ freeze fix** — this is cosmetic. The switch was made actually fast by the provider-session JSONL-parse fix in `044`. New-chat speed is `087`.

### Related features

- **Chrome freeze (sidebar / Monaco / deferred listDir):** `081-chat-switch-chrome-freeze.md`
- Provider session bridge + freeze fix: `044-provider-session-bridge.md`
- Chat tab switch / drawer: `064-agent-hub-drawer-and-chat-tab-switch.md`
- Workspace switch performance: `058-workspace-switch-performance.md`
- Session library / new chat: `001-ai-session-library.md`
- New chat hydrate/paint: `087-new-chat-perf.md`
- Explorer tree (row virtualization + git fan-out): `034-explorer-tree.md`
- Transcript windowing: `080-transcript-windowing.md`

### Future

- Optional Quack duck mark (`AIIcon`, feature `005`) instead of the generic spinner.
