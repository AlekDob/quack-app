---
type: feature-doc
project: quack-20
stack: React/Vite (apps/web)
created: 2026-08-04
startDate: 2026-08-04
endDate:
last_verified: 2026-08-04
status: active
tags: [quack-completion-sound, notifications, settings, audio]
---

## Quack Completion Sound
**Purpose:** Plays a duck quack audio cue once per completion batch when a chat thread finishes a turn, muting the matching OS notification sound so the two cues don't overlap.
**Stack:** React/Vite web app, HTML5 `Audio` element, Electron desktop bridge for system notifications.

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Util | `apps/web/src/lib/quackSound.ts` | `playQuackSound()` — lazily creates and caches an `HTMLAudioElement` for `/sounds/quack.mp3`, rewinds on replay, swallows autoplay-policy rejections |
| Component | `apps/web/src/notifications/taskCompletion.tsx` | `TaskCompletionNotifications` — detects thread/terminal completion candidates, calls `playQuackSound()` once per batch, mutes system notification sound via `silent` flag |
| Component | `apps/web/src/components/settings/DesktopSettingsPanels.tsx` | Settings row "Quack sound on task completion" with `Switch` toggle and "Test" button wired to `playQuackSound()` |
| Model/Type | `apps/web/src/appSettings.ts` | `enableQuackCompletionSound: Schema.Boolean` (default `true`) — persisted setting |
| Config | `apps/web/src/settingsSearchIndex.ts` | Search index entry `notifications:quack-completion-sound` for settings search |
| Route/Page | `apps/web/src/routes/_chat.settings.tsx` | Reset-to-default handling for the setting in the settings route |
| Test | `apps/web/src/appSettings.test.ts` | Covers default/persistence of `enableQuackCompletionSound` |
| Test | `apps/web/src/components/settings/DesktopSettingsPanels.browser.tsx` | Browser test fixture stubbing `enableQuackCompletionSound: true` |
| Util (asset) | `apps/web/public/sounds/quack.mp3` | Static quack audio asset served at `/sounds/quack.mp3` |

### Data Flow
[Thread/terminal store state change] → `TaskCompletionNotifications` effect diffs previous vs. current state → `collectCompletedThreadCandidates` (in `taskCompletion.logic`) → if `enableQuackCompletionSound` and any completions → `playQuackSound()` (once per batch) → cached `Audio` element plays `/sounds/quack.mp3`; simultaneously `showSystemThreadNotification(..., silent = settings.enableQuackCompletionSound)` mutes the OS notification chime.

### Key Functions
- `playQuackSound() → void` — plays the cached quack audio, ignoring autoplay-policy rejections and playback errors.
- `showSystemThreadNotification(copy, threadId, navigate, silent) → Promise<boolean>` — shows an OS/desktop notification; `silent` is set to the quack-sound setting so only one sound plays.

### State
- `settings.enableQuackCompletionSound`: boolean — user preference, persisted via `appSettings` (global, default `true`).
- `quackAudio` (module-level in `quackSound.ts`): `HTMLAudioElement | null` — cached audio element, lazily created once (module scope).

### External Dependencies
- Static asset: `/sounds/quack.mp3` served from `apps/web/public/sounds/`.

### Config
- `enableQuackCompletionSound`: enables/disables the quack cue and mutes the paired OS notification sound (default `true`).
