---
type: feature
project: quack-desktop
created: 2026-07-10
last_verified: 2026-07-10
---

# 052 — Composer voice dictation (Cursor-style)

**Purpose:** Cursor-style voice input in the chat composer — mic button opens a
recording row (waveform, timer, cancel, confirm) that replaces the textarea while
dictating. Uses **native** macOS Speech.framework in Tauri; **Web Speech API** on
Windows (WebView2) and in browser-only dev.

Parent composer doc: **`022-chat-composer.md`**.

## Components

| File | Role |
|---|---|
| `src/components/ComposerMic.tsx` | `ComposerMic` toolbar button; `ComposerDictationBar` recording UI |
| `src/dictation.ts` | Engine picker (`native` / `web`), session lifecycle, audio meter, timer fmt |
| `src-tauri/src/dictation.rs` | macOS `SFSpeechRecognizer` bridge — start/stop/cancel + Tauri events |
| `src/components/AIChatPanel.tsx` | `dictating` state; swap textarea ↔ dictation bar; append on confirm |
| `src-tauri/Info.plist` | `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription` |
| `src-tauri/Entitlements.plist` | `com.apple.security.device.audio-input` (pre-existing) |
| `src/App.css` | `.ai-dictation-*`, `.ai-composer-shell.dictating` |

## Layout (recording mode)

```
.ai-composer-shell.dictating
  .ai-composer-context-bar     ← path + branch (050) — still visible
  .ai-composer-meta            ← HIDDEN (model / effort / mic / send)
  .ai-input-row
    .ai-dictation-bar          ← waveform · timer · preview · ✕ · ✓
```

Mic button lives in `.ai-composer-meta` when idle; clicking it sets `dictating`
and hides the meta row until cancel or confirm.

## Recognition engines

| Platform | Engine | Why |
|---|---|---|
| macOS (Tauri) | **Native** — `speech` crate → `SFSpeechRecognizer` + `start_microphone_task` | WKWebView has no Web Speech API |
| Windows (Tauri) | **Web** — `SpeechRecognition` / `webkitSpeechRecognition` in WebView2 | Chromium speech stack |
| `npm run dev` (Vite only) | **Web** when API present | Same as Windows path |

`dictationEngine()` in `dictation.ts`: Tauri + `dictation_available` → `native`;
else Web Speech ctor → `web`; else `null` (mic button not rendered).

## User flow

1. User clicks **Dictate** (`.ai-mic-btn`) in the composer toolbar.
2. `ComposerDictationBar` mounts, calls `startDictation()`.
3. Partial transcript streams into a muted preview label; waveform animates.
4. **✓ Insert** — `session.stop()` → append text to composer input (space-join if
   non-empty) → refocus textarea.
5. **✕ Cancel** — `session.cancel()` → discard, restore normal composer.

## Waveform

| Engine | Visual |
|---|---|
| `web` | Live levels via `getUserMedia` + `AnalyserNode` (`openAudioMeter`) |
| `native` | Procedural pulse (avoids second mic capture while Speech.framework holds the device) |

28 vertical bars (`.ai-dictation-wave-bar`), CSS `scaleY` from `--lv` custom property.

## Rust commands (macOS)

| Command | Returns | Action |
|---|---|---|
| `dictation_available` | `bool` | `SpeechRecognizer::new().is_available()` |
| `dictation_start` | `()` | Request auth if needed; `start_microphone_task` |
| `dictation_stop` | `string` | `task.finish()`; return accumulated transcript |
| `dictation_cancel` | `()` | `task.cancel()`; clear transcript |

## Tauri events (macOS)

| Event | Payload | When |
|---|---|---|
| `dictation-partial` | `{ text }` | `DidHypothesizeTranscription` |
| `dictation-final` | `{ text }` | `DidFinishRecognition` |
| `dictation-error` | `{ text }` | Cancel / failed finish |

Frontend listens in `startNative()`; unlistens on stop/cancel.

## Permissions (macOS)

First run prompts for:

- **Microphone** — `NSMicrophoneUsageDescription` in `src-tauri/Info.plist`
- **Speech recognition** — `NSSpeechRecognitionUsageDescription` in same file

Tauri merges `Info.plist` from `src-tauri/` at bundle time (see Tauri 2 macOS bundle docs).

## Dependencies

| Crate / API | Scope | Version |
|---|---|---|
| `speech` | `target.'cfg(target_os = "macos")'.dependencies` | `0.6.0` (0.8.x Swift bridge fails on current Xcode) |

## CSS classes

| Class | Role |
|---|---|
| `.ai-composer-shell.dictating` | Hides `.ai-composer-meta`; adjusts input-row padding |
| `.ai-dictation-bar` | Flex row: wave + timer + preview + actions |
| `.ai-dictation-wave` | Scrolling bar container with edge fade mask |
| `.ai-dictation-wave-bar` | Single bar; height from `--lv` |
| `.ai-dictation-timer` | `m:ss` tabular-nums |
| `.ai-dictation-preview` | Truncated live transcript (optional) |
| `.ai-dictation-btn` | Icon cancel (✕) |
| `.ai-dictation-confirm` | Monochrome primary ✓ |

## Gotchas

- **No dead mic control:** `ComposerMic` returns `null` when `dictationEngine()` is
  `null` (e.g. Linux without Web Speech).
- **Single session:** Rust rejects `dictation_start` if a task is already active.
- **Confirm with empty transcript:** `onConfirm` no-ops append but still exits dictation.
- **Dev vs release bundle id:** debug builds use `dev.getcodetta.app.dev` (`build.rs`);
  speech auth still requires a proper app bundle in production.

## Related

- Composer shell + toolbar: `022-chat-composer.md`
- Design tokens (mic button): `003-design-system.md`
- Image attach (same composer): `016-image-attachments.md`
