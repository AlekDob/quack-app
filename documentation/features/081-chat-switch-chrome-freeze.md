---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-17
last_verified: 2026-07-17
tags: [chat-switch, performance, chrome-freeze, file-tree, monaco, content-visibility, perceived-performance]
---

## Chat-switch chrome freeze

**Purpose:** While the chat/session switch veil is up (`075`), temporarily yield
editor chrome (sidebar explorer, Agent Mode Files/Changes column, Monaco
`layout()`, FileTree `listDir`) so the transcript host gets the main thread.
Same snappiness users felt when collapsing the sidebar or entering Agent Mode —
without a permanent layout change.

**Stack:** `isChatSwitching()` pulse (`chatSwitch.ts`) + CSS
`content-visibility` + deferred IPC (`deferDuringChatSwitch.ts`). Sibling of
`075` (veil) and `080` (transcript windowing); complements `058` (workspace
heavy-mount) and `034` (always-on tree lightening).

### Why

Editor mode keeps Explorer + Monaco mounted next to the chat. On switch/new-chat
paint, those surfaces competed with transcript hydrate/render. Agent Mode
**unmounts** every `WorkspaceShell` (Monaco, terminals, multi-project shells) —
so it felt faster. Collapsing the sidebar unmounts `SidebarStack` — same idea,
smaller win. This feature freezes chrome **only for the veil window** (~320ms–1s).

### Files

| Type | Path | Role |
|---|---|---|
| Pulse | `src/chatSwitch.ts` | `isChatSwitching` / `subscribeChatSwitch` — freeze window |
| Defer queue | `src/deferDuringChatSwitch.ts` | Keyed `runOrDeferDuringChatSwitch` — drain on veil down |
| Tests | `src/deferDuringChatSwitch.test.ts` | Immediate run + keyed defer/dedupe |
| Sidebar | `src/components/SidebarStack.tsx` | `.is-chat-switch-frozen` while switching |
| Agent Mode | `src/components/AgentModeShell.tsx` | Same class on `.agent-context` |
| Monaco | `src/components/WorkspaceShell.tsx` → `FileTabHost` | `paneVisible={showSurface}` (`!switching`) |
| Tree I/O | `src/components/FileTree.tsx` | `listDir` via `runOrDeferDuringChatSwitch` |
| Styles | `src/App.css` | `.sidebar.is-chat-switch-frozen …`, `.agent-context.is-chat-switch-frozen …` |

### Data flow

```
pulseChatSwitch({ veil: true })
  → switching = true → notify subscribers
       ├─ SidebarStack / AgentModeShell → add is-chat-switch-frozen
       │     → content-visibility: hidden on section bodies (skip paint)
       ├─ FileTabHost → showSurface=false → EditorPane paneVisible=false
       │     → skip Monaco ed.layout()
       └─ FileTree listDir → queued (keyed) until veil drops

endChatSwitch / CAP
  → switching = false → notify
       ├─ remove freeze classes / paneVisible true → layout() catch-up
       └─ drain deferred listDir callbacks
```

### CSS contract

```css
.sidebar.is-chat-switch-frozen .sidebar-section-body,
.agent-context.is-chat-switch-frozen .agent-context-body {
  content-visibility: hidden;
  contain-intrinsic-size: auto 480px; /* keep approximate box size */
  pointer-events: none;
}
```

Applied to **bodies only** (headers stay) so the sidebar width/flex slot does
not collapse for the pulse duration.

### Defer queue

`runOrDeferDuringChatSwitch(key, fn)`:

| Case | Behavior |
|---|---|
| Not switching | `fn()` immediately |
| Switching | `pending.set(key, fn)` — last write wins per key |
| Veil down | One `subscribeChatSwitch` listener drains the map |

Keys used: `ft-root:{root}`, `ft:{dirPath}`. Avoids N per-Node
`subscribeChatSwitch` listeners.

### What is NOT frozen

- Chat hosts / transcript hydrate (must run under the veil — see `075` gotcha)
- Agent Hub rail status (cheap)
- New chat (`addNewAIChat`) now pulses `veil: true` (`075`/`087`) — freeze window applies for the adaptive veil floor (~160–220ms)

### Related always-on tree lightening (`034`)

Independent of the pulse — helps idle + switch:

| Technique | Where |
|---|---|
| `content-visibility: auto` on `.tree-row` | `App.css` — browser skips off-screen rows |
| `contain: content` on `.tree` | Layout isolation |
| `memo(Node)` + stable `onContext` | `FileTree.tsx` |
| Per-row git via `useSyncExternalStore` | Only dirty rows re-render (no root `setGitTick`) |

### Verify

1. Editor mode, Explorer open, large dirty tree — switch between two long chats:
   sidebar bodies blank under the veil, then restore; switch feels closer to
   Agent Mode.
2. Expand a folder mid-veil (if possible) — `listDir` runs after veil down.
3. `npm test` → `deferDuringChatSwitch.test.ts` green.
4. New chat — brief freeze under the adaptive veil floor (~160ms warm), then sidebar restores; empty composer visible after fade.

### Gotchas

- **Do not unmount** `SidebarStack` for the pulse — remount would re-`listDir`
  and cost more than freezing paint.
- **`contain-intrinsic-size`** is required with `content-visibility: hidden` or
  the section body can collapse to 0 height and reflow the shell.
- **Monaco:** pass `paneVisible={showSurface}` (not merely hide the host with
  CSS) so the `[paneVisible]` effect skips `ed.layout()`.
- Circular import risk: `deferDuringChatSwitch` → `chatSwitch` only; do not
  import FileTree from `chatSwitch`.

### Related

| Doc | Link |
|---|---|
| Chat switch veil | `075-chat-switch-loader.md` |
| Transcript windowing | `080-transcript-windowing.md` |
| Explorer tree | `034-explorer-tree.md` |
| Workspace heavy-mount | `058-workspace-switch-performance.md` |
| Cold project-switch loader | `079-cold-project-switch-loader.md` |
