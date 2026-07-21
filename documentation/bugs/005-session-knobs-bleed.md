---
type: bug-doc
project: quack-desktop
created: 2026-07-21
fixed: 2026-07-21
status: fixed
tags: [composer, sessions, model, effort, mode, isolation, remount]
related:
  - documentation/features/040-per-session-composer-state.md
  - documentation/features/076-chat-lazy-hydrate-done-unload.md
  - documentation/features/025-model-selector.md
  - documentation/features/062-presets.md
  - documentation/features/015-claude-permission-mode.md
---

# Bug — Model / effort / mode bleed across sessions

## Symptoms

Changing **model**, **effort**, or **mode** in one chat appears to apply to
every other chat in the same project. Switching sessions shows the knobs
from the chat you just left (e.g. Opus + Auto everywhere).

## Root cause

Idle Agent Mode / IDE hosts **unmount** when not visible
(`shouldKeepChatHostMounted` in `chatHostMount.ts` — feature `076`). On remount:

1. `selected` started empty; effort/mode seeded from **global** localStorage
   (`lcp.ollama.lastModel`, `lcp.claudeCode.effort`, `lcp.claudeCode.permMode`)
   — values the previous chat had just written.
2. Model discovery filled an empty picker from that global last-used model
   **before** per-session hydrate painted the bound row
   (`applyDiscoverySnapshot` → `setSelected` fallback to stored).
3. Persist effects (transcript / empty-chat `patchSession` / knob debounce /
   rail `setAIChatModel`) ran with the wrong values and **rewrote** the
   remounted session's stored model/knobs.

Secondary: `subscribePresetSettings` called `applyPreset` on **every** mounted
host when Team settings changed, resetting sibling chats' picker knobs.

Result: every switch stamped the last-active chat's Opus/Auto onto siblings.

## Fix (2026-07-21)

| Change | Where |
|---|---|
| Seed model + knobs from warm `ChatSession` cache on mount | `sessionComposerSeed.ts`, `AIChatPanel` |
| `sessionReady` gate — no persist / global last-used / rail badge until hydrate paints | `AIChatPanel` |
| Discovery must not apply global last-used while `!sessionReady` | `nextSelectedAfterDiscovery` |
| Persist `model` in `mergeSessionKnobs` | `composerDraft.ts` |
| Team preset edits `applyPreset` only on the **visible** host | `subscribePresetSettings` + `chatVisibleRef` |

Vitest: `sessionComposerSeed.test.ts`.

Living behavior: **`040-per-session-composer-state.md`**.

## Verify

1. Chat A → Opus + Auto (or high effort). Chat B → Sonnet + Ask (or medium).
2. Switch A ↔ B several times (Agent Mode idle hosts remount).
3. Each chat must keep its own model / effort / mode.
4. Edit a Team preset while chat B is focused — chat A (hidden) must not
   jump to the preset's model until you open A and intentionally re-apply.

## See also

- `040-per-session-composer-state.md`
- `076-chat-lazy-hydrate-done-unload.md` / `chatHostMount.ts`
- `025-model-selector.md`, `062-presets.md`
- Diary: `documentation/diary/2026-07-21.md`
