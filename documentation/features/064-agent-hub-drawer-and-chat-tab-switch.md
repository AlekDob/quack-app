---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-12
last_verified: 2026-07-12
tags: [agent-hub, chat-switch, performance, pane-tabs, drawer, overlay, monaco]
---

## Agent Hub collapsed drawer + chat tab switch performance

**Purpose:** Make the cross-project Agent Hub usable when collapsed (44px strip)
without cramming unreadable chips, and make switching between AI chat tabs feel
instant — no editor resize jank, no fixed 500ms loading veil on same-project
switches.

**Related:** `009-agent-hub.md` (status groups, watcher), `001-ai-session-library.md`
(mount model), `043-chat-transcript-persistence.md` (flush on switch),
`058-workspace-switch-performance.md` (foreground gates).

---

### Agent Hub — collapsed rail (44px)

| Mode | Layout | Behaviour |
|---|---|---|
| **Collapsed** (default pin off) | Shell stays **44px** in `.shell-stack` | Icon chip per chat: project-color square + first letter of **chat title** + status dot corner badge; work badge only when expanded |
| **Hover peek** | Shell still 44px; panel is **overlay drawer** | `is-peeking` on `.agent-hub-shell` → `.agent-hub` is `position:absolute`, 240px wide, `z-index:80`, slides in (~180ms) **over** the editor — **zero layout shift** |
| **Pinned expanded** (chevron) | Shell grows to **240px** in-flow | Persists via `hubPrefs` (`lcp.hub.expanded`); pushes editor like before |

**Why overlay, not in-flow peek:** An earlier in-flow expand (shell 44→240px on
hover) was fast but ugly — the whole editor reflowed. Cursor-style peek must not
resize the workspace; only the pinned state may.

**Hover hit area:** `onMouseEnter` / `onMouseLeave` on `.agent-hub` (not the
44px shell alone) so the full 240px drawer stays open while moving the mouse
into the list. Leave debounce: 320ms.

**Agent mode:** `placement="agent-sidebar"` — hub is always expanded; no peek.

#### Key files (hub UI)

| Piece | File |
|---|---|
| Hub component + `useHubPeek` + `chipLetter` | `src/components/AIChatsRail.tsx` |
| Shell wrapper `.agent-hub-shell` | `AIChatsRail.tsx` (stack placement only) |
| Collapsed + drawer CSS | `src/App.css` → `.agent-hub-shell`, `.agent-hub:not(.expanded) …` |
| Expanded / section prefs | `src/hubPrefs.ts` |
| Mount | `src/App.tsx` → `<AIChatsRail />` in `.shell-stack` |

#### CSS classes

- `.agent-hub-shell` — flex column, 44px or 240px when `.is-expanded`
- `.agent-hub-shell.is-peeking:not(.is-expanded)` — raises z-index; child `.agent-hub` is absolute drawer
- `.agent-hub-row` collapsed — 26×26 chip, `has-work` dot, section dividers
- `data-rail-side` — `"right"` (default) or `"left"` when sidebar is on the right

---

### Chat switch — faster open/focus

`pulseChatSwitch()` (`src/chatSwitch.ts`) still flushes in-flight transcripts
before changing the visible chat, but options reduce perceived latency:

| Option | Default | When |
|---|---|---|
| `veil` | `true` | Full-bleed `ChatSwitchVeil` + hide panel (`is-switching`) |
| `flushWsId` | — | Flush only that workspace's mounted panels (not every multitask panel) |

**Call sites:**

| Action | `veil` | `flushWsId` |
|---|---|---|
| Hub click, **same project** | `false` | outgoing `activeId` |
| Hub click, **cross project** | `true` | outgoing `activeId` |
| `addNewAIChat` | `false` | target `wsId` |
| Agent mode `selectSession` | `false` if same ws | current `wsId` |

**Veil timing:** max **280ms** (was 500ms). `endChatSwitch()` clears early when
`AIChatPanel` fires `onHydrated` (wired from `AIChatHost`, `AgentChatHost`,
`DrawerAIChatHost`).

---

### Pane tab switch — no resize jank

**Problem:** Toggling chat tabs used `display:none` ↔ `flex` on portaled hosts.
Switching chat ↔ file **unmounted Monaco** (only active file tab mounted), so the
pane relayout felt like a resize.

**Fix — visibility stacking:**

| Host | Wrapper class | Hidden state |
|---|---|---|
| AI chat tab | `.ai-tab-host` | `visibility:hidden; pointer-events:none` (still `display:flex`) |
| File / media tab | `.file-tab-host` | same |
| Agent mode chat | `.agent-chat-host` | same (removed opacity fade transition) |

Active tab adds `.is-visible` (or `data-visible` in agent mode). All visited hosts
stay **mounted** in `.pane-content` (`position:relative`); hosts are
`position:absolute; inset:0` stacked.

**File tabs:** `FileTabHost` in `WorkspaceShell.tsx` lazy-mounts on first visit,
portals **every** `file:` tab in the pane (not only the active one). `EditorPane`
accepts `paneVisible` and calls `ed.layout()` on show.

**Tab bar:** `PaneNode` active-tab `scrollIntoView` uses `behavior:"instant"` to
avoid animated scroll jank.

#### Key files (tab hosts)

| File | Role |
|---|---|
| `src/components/WorkspaceShell.tsx` | `AIChatHost`, `FileTabHost` |
| `src/components/TabContentHost.tsx` | `DrawerAIChatHost` |
| `src/components/AgentModeShell.tsx` | `AgentChatHost` |
| `src/components/EditorPane.tsx` | `paneVisible` → Monaco `layout()` |
| `src/App.css` | `.ai-tab-host`, `.file-tab-host`, `.agent-chat-host` |

---

### Gotchas

- **Peek vs pin:** Hover drawer does not set `hubPrefs` expanded; chevron still
  toggles persistent 240px width.
- **Cold first open:** First visit to a chat tab still mounts `AIChatPanel` and
  hydrates the full transcript (no message virtualization yet) — separate from
  tab visibility fix.
- **Cross-project switch:** Still shows veil until hydrate or 280ms cap; workspace
  `useWorkspaceHeavyMount` ramp-up unchanged (`058`).
- **Legacy `.ai-chats-rail` CSS** in `App.css` is dead (hub renamed to
  `.agent-hub`); safe to delete in a cleanup pass.

---

### Verification checklist

1. Collapse hub (chevron) → 44px strip with distinct letter chips.
2. Hover strip → 240px drawer slides over editor; editor width unchanged.
3. Click chat in drawer → switches without veil (same project).
4. Switch `ciao` ↔ `Team` ↔ file tab → no pane width jump; Monaco state preserved on return.
5. Pin hub open → 240px in-flow; hover peek disabled.
