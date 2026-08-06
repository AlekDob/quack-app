---
type: feature-doc
project: quack-20
stack: React (Vite) + TypeScript
created: 2026-08-06
startDate: 2026-08-06
endDate:
last_verified: 2026-08-06
status: active
tags: [chat, streaming, settings, performance]
---

## Smooth Streaming Text (Typewriter Reveal)

**Purpose:** Optional per-frame typewriter animation that reveals streamed assistant text smoothly instead of in the raw ~100ms network chunks; off by default to save CPU.
**Stack:** React (Vite), TypeScript

### Files

| Type       | Path                                                  | Exports/Purpose                                                                 |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------------- |
| Config     | `apps/web/src/appSettings.ts`                         | `enableSmoothStreamingText` boolean setting, default `false`                    |
| Service    | `apps/web/src/hooks/useSmoothStreamedText.ts`         | `useSmoothStreamedText(text, isStreaming, enabled)` — rAF-driven reveal cadence |
| Component  | `apps/web/src/components/ChatMarkdown.tsx`            | `smoothStreaming` prop, wired to `useSmoothStreamedText`                        |
| Component  | `apps/web/src/components/chat/MessagesTimeline.tsx`   | `smoothStreamingText` prop, threaded down to each `ChatMarkdown` instance       |
| Component  | `apps/web/src/components/chat/ChatTranscriptPane.tsx` | `smoothStreamingText` prop, threaded to `MessagesTimeline`                      |
| Component  | `apps/web/src/components/ChatView.tsx`                | Passes `settings.enableSmoothStreamingText` into `ChatTranscriptPane`           |
| Route/Page | `apps/web/src/routes/_chat.settings.tsx`              | "Typewriter reveal" toggle in Chat behavior > Conversation                      |

### Data Flow

`appSettings (enableSmoothStreamingText)` → `ChatView` reads via `settings` → `ChatTranscriptPane` (`smoothStreamingText` prop) → `MessagesTimeline` (`smoothStreamingText` prop) → `ChatMarkdown` (`smoothStreaming` prop) → `useSmoothStreamedText` (rAF reveal loop) → rendered text

### Key Functions

- `useSmoothStreamedText(text: string, isStreaming: boolean, enabled: boolean) → string` — returns `text` unchanged when `enabled` is false, not streaming, or under `prefers-reduced-motion`; otherwise reveals it at an adaptive per-frame velocity via `requestAnimationFrame`

### State

- `enableSmoothStreamingText`: boolean — persisted app setting, default `false` (global)
- internal `revealed`/`shownRef`/`velocityRef` refs in `useSmoothStreamedText` — reveal cursor and animation velocity (component)

### Config

- `enableSmoothStreamingText`: toggles the typewriter animation (default `false`) — when off, streamed text renders in the ~100ms chunks the transport delivers with no per-frame `setState`

### Notes

- Prop is threaded explicitly through `MessagesTimeline`/`ChatTranscriptPane`/`ChatView` rather than read via `useAppSettings()` inside `MessagesTimeline` itself — subscribing the memoized transcript list to the settings query cache would force a full re-render on any unrelated settings change.
- Motivation: at 60fps the animation drives one `setState` per frame on the streaming message; measured ~17% renderer + ~17% GPU CPU during a streaming turn (Activity Monitor). This setting trades the smooth reveal for lower CPU cost.
