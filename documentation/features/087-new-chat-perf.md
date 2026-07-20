---
type: feature-doc
project: quack-desktop
stack: Tauri + React
created: 2026-07-20
startDate: 2026-07-20
endDate:
last_verified: 2026-07-20
status: active
tags: [perf, new-chat, hydrate, chat-switch, afterFirstPaint, cache]
related:
  - 001-ai-session-library.md
  - 024-resume-white-screen-recovery.md
  - 031-model-discovery-cache.md
  - 043-chat-transcript-persistence.md
  - 075-chat-switch-loader.md
  - 076-chat-lazy-hydrate-done-unload.md
  - 085-agent-ide-mode-toggle.md
  - 086-perf-audit-window.md
---

## New chat performance

**Purpose:** Keep **New chat** interactive in tens of milliseconds for hydrate,
and under ~a frame or two for first paint — without slowing dense transcript
reopens. Diagnosed via Perf Audit Copy JSON (`086`).

**Stack:** `store.addAIChat` + `chatStoreCache` + `AIChatPanel` hydrate /
mount effects + `afterFirstPaint`.

### Symptoms (before)

| Audit mark | Typical bad | Cause |
|---|---|---|
| `session loaded` | ~**3300ms**, `cacheHit: false`, `msgCount: 0` | `force` when `messages.length === 0` → drop RAM → `chat_store_load` miss (no file yet) |
| `hydrate done` | ~**6900ms** after `session loaded` 14ms | Empty UI painted inside `startTransition`, deferred behind ~47 mount effects |
| `panel painted` | ~**1500ms** | Extension probe, model catalog warm, CC `/` scan, skills/agents/presets ran before first free frame |
| `resume` spam | dozens of `visibility` rows (11–80ms) | Alt-tab / Spaces flicker healed Monaco/xterm and polluted the timeline |

### Fixes

#### 1. Seed empty RAM body on create

`store.addAIChat` calls `putCachedSession(wsId, { id, title, messages: [], … })`
so the panel’s hydrate path hits cache immediately. New chats have **no disk
file yet** — forcing a load was pure miss latency.

#### 2. Never force-drop on empty

Hydrate uses `cached ?? await ensureSessionLoaded(...)` — **no**
`force: messages.length === 0`. Rich bodies stay warm across Agent↔IDE (`085`).
Project switch still `dropAllCachedBodies` → cold disk load is correct there.

#### 3. Sync paint for empty chats

`paintSession`: if `msgs.length === 0`, apply state **synchronously** and call
`finishHydrated()` immediately. Dense transcripts keep `startTransition` +
double-rAF before ending the veil so hydration doesn’t block input.

#### 4. Defer non-critical mount work (`afterFirstPaint`)

`src/afterFirstPaint.ts` — double `requestAnimationFrame`, cancelable. Used so
the empty panel can commit before:

| Work | Where |
|---|---|
| Quack Store extension probe | `AIChatPanel` mount |
| Model discovery refresh + picker catalog warm | `wsActive` effect |
| Claude Code `/` command scan | CC selected |
| Subagents / skills / custom presets load | CC selected |

`panel painted` is also measured via `afterFirstPaint` (not a single rAF).

#### 5. Resume flicker gate (`024`)

`MIN_HIDDEN_MS = 2000` — heal + Perf Audit `resume` rows only after real
standby / long background, not alt-tab flickers.

### Files

| Type | Path | Role |
|---|---|---|
| Util | `src/afterFirstPaint.ts` | Double-rAF defer helper |
| Store | `src/store.ts` | `addAIChat` seeds empty `putCachedSession` |
| Entry | `src/addNewAIChat.ts` | `markNewChat` + focus (no seed here — store owns it) |
| Component | `src/components/AIChatPanel.tsx` | Warm hydrate, sync empty paint, deferred mounts |
| Resume | `src/resumeDebug.ts` | `MIN_HIDDEN_MS` |
| Audit | `src/components/PerfAuditWindow.tsx` | Copy JSON + prefer `detail.elapsedMs` |

### Expected Audit shape (good)

```
new-chat start
panel mounted          ~15–20ms
session loaded         ~14ms   cacheHit: true  msgCount: 0
hydrate done           ~14ms
panel painted          ≪ 1500ms  (target: first free frames after commit)
```

If `panel painted` stays high after a long `focus (was hidden …ms)`, WebKit
cold-wake / other chrome still dominates — measure again when already warm.

### Gotchas

- **Do not** reintroduce `force` when `messages.length === 0` — that is the
  empty-file miss.
- Seeding empty RAM is intentional; first real `saveSession` creates the file.
- Defer only work that is OK a frame late (slash menus / chips). Hydrate and
  stream wiring stay eager.
- `[new-chat-perf]` / Perf Audit ring (`086`) are the source of truth for
  regressions — paste Copy JSON into chat.

### Related

| Feature | Relation |
|---|---|
| `076` | `memo(AIChatHost)` — new chat must not re-render every mounted panel |
| `085` | Agent↔IDE warm hydrate (same no-blanket-force policy) |
| `043` | Disk persistence; project leave still drops bodies |
| `086` | Timeline + Copy JSON that found these regressions |
| `024` | Resume heal threshold so New chat isn’t buried under flicker |
| `031` | Model discovery — warmed after first paint, not on critical path |
