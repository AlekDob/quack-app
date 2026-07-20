---
type: feature
project: quack-desktop
created: 2026-07-01
last_verified: 2026-07-20
tags: [resume, standby, white-screen, webview, monaco, xterm, debug, quack-v1, perf]
---

# 024 — Resume / White-Screen Recovery

**Purpose:** Detect the app resuming from macOS standby/sleep and both **heal**
the blank-white webview (Monaco/xterm renderers gone blind on wake) and leave a
**durable log** of every resume event so an incident can be inspected after the
fact — no live DevTools required.

## The bug it addresses

| Step | What happens |
|---|---|
| 1 | App sleeps → JS pauses; WebGL contexts NOT notified (WKWebView omits `webglcontextlost`) |
| 2 | Window reopens → DOM + React tree intact, but Monaco's renderer is blind (0×0 stale layout or lost GL texture) |
| 3 | Result: a perfectly white `.pane-content`; xterm/flex layouts sometimes too |

## How it works

| Concern | Mechanism |
|---|---|
| Detect resume | `visibilitychange` + `focus` (only if hidden ≥**`MIN_HIDDEN_MS` = 2s**) + `pageshow` (BFCache) |
| Heal | Each registered component's `heal()` (`ed.layout()` / `fit.fit()`) + one synthetic `window resize` |
| Coalesce | `FIRE_MIN_GAP_MS = 250` — collapses the hidden→visible double-fire into one event |
| Log (live) | Single grouped `console.warn("[resume] …", entry)` — greppable in DevTools |
| Log (durable) | Capped ring (50) in `localStorage["codetta:resumeLog"]` — survives reload |
| Perf Audit | Same events feed the `086` timeline as `kind: "resume"` (after the 2s gate) |

## Components

| File | Role |
|---|---|
| `src/resumeDebug.ts` | The whole system: registry, listeners, heal, console + localStorage logging |
| `src/App.tsx` | `installResumeDebug()` once at app mount |
| `src/components/EditorPane.tsx` | Registers each Monaco editor (`heal: ed.layout()`) |
| `src/components/TerminalCore.tsx` | Registers each xterm terminal (`heal: fit.fit()`) |

## API

| Export | Use |
|---|---|
| `installResumeDebug()` | Wire listeners (idempotent); returns teardown |
| `registerResumeComponent(c)` | Register a Monaco/xterm instance; returns unregister |
| `getResumeLog()` | Read persisted entries (oldest → newest) |
| `clearResumeLog()` | Wipe the persisted ring |
| `debugFireResume(reason?)` | Manually trigger a resume (tests / "did this fix it?") |

## Viewing the log

- **After the fact (no DevTools needed at wake time):** open DevTools console any
  time → `__resumeLog()` prints a `console.table` of the persisted ring;
  `__resumeClear()` wipes it. Both are attached to `window` by `installResumeDebug()`.
- **Live:** watch the console for `[resume] …` grouped entries as they fire.

## Gotcha

- The log is **console-only + localStorage**, not a file on disk and not surfaced
  in the app UI. Before this feature it was console-only, so if DevTools wasn't
  open at the moment of wake the incident left **no trace** — that was the
  "I don't see anything" report. `localStorage` now makes it durable. Prefer
  **Perf Audit → Copy JSON** (`086`) when diagnosing lag after wake.
- **`MIN_HIDDEN_MS = 2000` (2026-07-20):** brief alt-tab / Spaces / chrome focus
  flickers (often 11–80ms) used to fire heal on every visibility flip — flooded
  the audit timeline and stole main-thread time right before New chat (`087`).
  Real standby / long background still heals. Do not drop the threshold back to
  ~100ms without a flicker sample.
- A **white screen is not always a resume bug**: a Vite compile error (e.g. a
  duplicate identifier) also blanks the page, but shows the red Vite overlay and
  never fires `[resume]`. Check the overlay/terminal first.
- `performance.memory` is Chromium-only; `heap` reads `"n/a"` on WKWebView.

## Related

- Perf Audit timeline: `086-perf-audit-window.md`
- New chat after wake: `087-new-chat-perf.md`
