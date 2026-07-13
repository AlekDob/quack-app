---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-29
last_verified: 2026-07-13
tags: [whiteboard, organigramma, subagents, skills, frontmatter, drag-and-drop, runbook, markdown-export, quack-v1, team, editor-drawer]
---

> **2026-07-13 update:** fixed **black screen** when clicking a subagent card on the Team
> tab. Root cause: `openFile()` briefly made the `.md` the **active editor tab** (hiding Team)
> before `moveTabToDrawer()` ran; the file host often rendered nothing on that frame
> (`editorsReady` gate + preview-only path). Fix: `store.openFileInDrawer()` hydrates the
> buffer and opens **directly in the right drawer** without stealing the main pane's active
> tab; `WhiteboardOrganigramma.AgentNode` calls it after `writeEditorMdView("preview")`.
> See `063-surface-view-prefs.md` (drawer open API) and diary `2026-07-13.md`.

> **2026-07-12 update:** renamed "Organigramma"/"Whiteboard" to **"Team"** everywhere
> user-facing (activity bar, command palette, tab labels, sub-tab pill, legend copy) — internal
> identifiers (`WhiteboardPane`, `wb:` tab kind, `WhiteboardOrganigramma.tsx`) were left
> untouched, no reason to churn file/type names for a label change. Also fixed the tab actually
> not being full width: `.whiteboard-org` had `max-width: 920px; margin: 0 auto`, centering the
> org-chart in a narrow column regardless of pane width — now `width: 100%`. New `"users"` icon
> (`src/components/Icon.tsx`) replaces the old `"whiteboard"` icon at every render site. The
> skill-linking drag-and-drop described below was already removed in an earlier round (see
> `062-presets.md`'s "Skill linking was removed" note) — this doc's DnD sections are historical.

## Whiteboard Tab (Organigramma Agente↔Skill)

**Purpose:** A per-workspace "Whiteboard" editor tab that (1) shows a vertical
**organigram** of Jack + every subagent (project + user scope) with the skills
attached underneath, (2) lets the user **drag a skill chip onto an agent** (or
the × on a chip) to update the agent's `.md` frontmatter in place, and (3)
emits an **operational `.md`** with a per-agent Workflow section, copyable or
saveable to `.codetta/whiteboard.md`.

**Stack:** React 19 + TypeScript strict + plain CSS (no new dependency). HTML5
native Drag-and-Drop (no react-dnd / no dnd-kit). Reuses the existing
`MarkdownPreview`, `AIIcon`, `Icon`, and the `subagents`/`skills` loaders. No
YAML dep — a 90-line `frontmatter.ts` does the surgical in-place patcher.

### Why this shape (decisions)

1. **Editor tab, not a modal / sidebar.** Decided during planning: an editor
   tab uses the existing tab-bar infra (focus, close, persistence, multi-tab,
   splash on activation). Adds a `wb:<wsId>` tab kind, mirrors the existing
   `sub:<sid>|<toolUseId>|<agentType>` self-contained keys.
2. **Jack is root, fixed.** The PM persona is already in the product (see
   `features/005-jack-duck-identity.md`); the whiteboard reuses `AIIcon` so
   Jack's identity stays single-sourced at `/jack.jpeg`.
3. **Frontmatter, not sidecar.** Linking a skill to an agent writes
   `skills: [slug1, slug2]` directly in the agent's `.md`. Reviewable in git,
   hand-editable, no new state file. The same frontmatter is what
   `loadSubagents` reads back on next mount — single source of truth.
4. **Pure-function MD generator.** `renderWhiteboardMd` returns the doc as a
   string; the same string feeds the live `MarkdownPreview`, the clipboard,
   and the saved file.

### Tab key + persistence

| Aspect | Where | Behaviour |
|---|---|---|
| Key | `src/store.ts` `wbKey(wsId)` → `"wb:" + wsId` | One tab per workspace |
| `parseKey` kind | `src/store.ts` | `{ kind: "whiteboard"; wsId }` |
| Survives restart | `src/store.ts` `clean()` whitelist `wb:` | Yes — data is reloaded from disk |
| Open via action | `src/actions.ts` `view.open_whiteboard` (View category) | ⌘P → "Open Whiteboard" |
| Tab icon | `src/components/Icon.tsx` `"whiteboard"` (rectangle + 3-dot tree) | Renders in tab bar + Command Palette label |

### Subagent model change

`SubagentDef` (`src/subagents.ts`) gained two fields and a new frontmatter parser:

```ts
interface SubagentDef {
  // ...existing
  skills: string[];   // slugs from `skills:` frontmatter (block or inline form)
  path: string | null; // absolute path to the .md file (needed to write back)
}

function frontmatterList(src: string, key: string): string[]
```

`frontmatterList` accepts all three common YAML list forms:

```yaml
skills:
  - code-navigation
  - brand-guidelines
```
or
```yaml
skills: [code-navigation, brand-guidelines]
```
or
```yaml
skills: code-navigation, brand-guidelines
```

Quotes around items are stripped; missing key → `[]`. Existing call sites
(`AIChatPanel` load) need no changes — they just read what they always did, plus
the new `skills` field is now available to anything that cares.

### Drag-and-drop

**Mouse events, not HTML5 dragstart.** See "Tauri 2 + internal HTML5 drag"
in the gotchas — Tauri 2 on macOS WKWebView fires `dragstart` on the source
chip but never dispatches `dragover`/`drop` to any DOM element when the
window has `dragDropEnabled: true` (default). So we track the cursor with
plain `mousedown` + document-level `mousemove`/`mouseup` and hit-test the
target via `document.elementFromPoint(x, y)` + `closest("[data-wb-agent]")`.

| Phase | What happens |
|---|---|
| `mousedown` on chip | `startDrag(skill, x, y, el)` — source dims + ghost appended to `<body>` (chip-cloned, `position:fixed`, follows cursor) |
| `mousemove` (over `DRAG_THRESHOLD_PX = 4`) | `findAgentAt(x, y)` → update `hoverAgent` (visual highlight) |
| `mouseup` over an agent | `linkSkill(agent, skillName)` → patch frontmatter + reload + toast. Ghost fades out (CSS transition). |
| `mouseup` not over an agent | No link. Ghost fades out anyway — visual feedback is consistent regardless of outcome. |
| `mouseup` that never crossed the threshold | **It's a CLICK.** `onClick(skill)` fires → parent opens `skill.path` (the SKILL.md) in an editor tab. |

- **Link** — drop a free skill chip onto an agent node → toast "Linked X → Y",
  parent reloads `loadSubagents()`, organigramma re-renders with the new chip
  hanging under that agent.
- **Unlink** — click the standalone × on a linked chip inside an agent →
  toast "Unlinked". The × is positioned absolutely on the `<li>` wrapper so
  it doesn't overlap the chip's content.
- **Visual cue** — the target agent gets `--accent` border + `--bg-hover`
  background while a drag is over it (`is-drop-target` class, controlled
  by `hoverAgent` state).
- **Click on agent** — opens its `.md` in the **right editor drawer** in **Preview**
  mode (`writeEditorMdView("preview")` then `openFileInDrawer(wsId, agent.path)`).
  Team stays visible in the main pane; no tab switch, no reload. Global agents
  (e.g. `~/.claude/agents/code-explorer.md`) open the same way. Keyboard:
  `role="button" tabIndex={0}` — Enter/Space trigger the same handler.
  If `agent.path` is null, toast error (no silent no-op).
- **Click on any skill chip** — opens its `SKILL.md` (same `openFileAndReveal`,
  so project skills are revealed in the tree too). Works for both free chips
  (pool) and linked chips (inside an agent), by the chip's `data-wb-skill` attr.
- **DRY note:** `openFileAndReveal` is shared with the Usage → Context view
  (`features/020`) — click-to-open + reveal-if-in-project lives in one place.
- **Click vs drag threshold = 4 px.** Anything under that is treated as a
  click — opens the SKILL.md (if cursor is over a skill) or does nothing.
  Beyond 4 px we attach document-level mousemove and start updating the
  hover state. Keeps accidental drags from firing on clicky mouse users.

The Monaco-DnD gotcha that breaks `useDrop` inside the editor does not apply
here (we're not using react-dnd or any library — pure DOM events).

### Frontmatter writer (`src/frontmatter.ts`)

Single surgical patcher — no YAML lib:

```ts
async function setFrontmatterList(filePath: string, key: string, list: string[]): Promise<void>
function patchFrontmatterList(src: string, key: string, list: string[]): string  // pure
// scalar sibling (added for features/020 — sets/removes a single key like
// `disable-model-invocation`): setFrontmatterScalar / patchFrontmatterScalar
async function setFrontmatterScalar(filePath: string, key: string, value: boolean | string | null): Promise<void>
```

Rules:
- **Block replace** when the key exists and the list is non-empty: drop the key
  line + any indented `- item` lines, insert a fresh `key:\n  - ...\n  - ...`.
- **Insert** when the key is absent and the list is non-empty: insert the block
  just before the closing `---`. Other FM keys are preserved.
- **Remove** when the key exists and the list is empty: drop the key block, no
  orphan `skills: []` left behind.
- **Synthesise** when the file has no frontmatter at all.
- Body (`... ---\n\n<markdown>`) is preserved verbatim.

Pure variant is unit-tested in `/tmp/test-frontmatter.mjs` (18 assertions):
insert / replace / remove / synthesise / round-trip / key-in-middle.

### Operational `.md` (`src/whiteboardMd.ts`)

`renderWhiteboardMd({ workspaceName, agents, skills })` produces a runbook-style
document:

```markdown
# Whiteboard — <workspace name>

> Generated by Quack on <ISO date>. Jack is the project manager …
> Edit the `.claude/agents/*.md` files …

- **N** subagents (M project, K global)
- **S** skills available

## Project subagents
### <agent-name>  (project)
**Description**: …
**Source**: `<absolute path>`
**Skills linked**: `code-navigation`, `brand-guidelines`
**Workflow**:
1. Mention `@<agent-name>` in a Quack chat to delegate this turn.
2. Inside the delegated run, the agent will:
   1. invoke `/skills/code-navigation` — <description>
   2. invoke `/skills/brand-guidelines` — <description>
3. Return a concise final report to the parent session.

## Global subagents
...

## Unassigned skills
- `/skills/<name>` — <description>

---
_Regenerate this file from the Whiteboard tab → Workflows → Save to .codetta/whiteboard.md_
```

Same string feeds:
1. The live `MarkdownPreview` (Workflows sub-tab)
2. The "Copy as Markdown" button (`navigator.clipboard.writeText`)
3. The "Save to `.codetta/whiteboard.md`" button (`fs.writeFile`, creates
   `.codetta/` if missing).

### Files

| Type | Path | Purpose |
|---|---|---|
| Module | `src/frontmatter.ts` | `setFrontmatterList` / `patchFrontmatterList` (read + write, no YAML dep) |
| Module | `src/whiteboardMd.ts` | `renderWhiteboardMd` (pure function, runbook doc) |
| Module | `src/subagents.ts` | +`skills` field, +`path` field, +`frontmatterList` parser |
| Module | `src/store.ts` | `wbKey`, `parseKey` whiteboard case, `wbOpen`, `openFileInDrawer`, `clean()` whitelist |
| Component | `src/components/WhiteboardPane.tsx` | Tab shell + 3 sub-tabs + load/persist lifecycle |
| Component | `src/components/WhiteboardOrganigramma.tsx` | Tree + preset group; `AgentNode` → drawer preview |
| Component | `src/components/Icon.tsx` | +`whiteboard` icon |
| Component | `src/components/WorkspaceShell.tsx` | portal-mount of `WhiteboardPane` (parallel to SubagentTranscriptView) |
| Component | `src/components/PaneNode.tsx` | `tabLabel` + icon dispatch (new `isWhiteboard` branch) |
| Component | `src/components/CommandPalette.tsx` | Hint-priority fix (`c.hint ?? c.accel`) |
| Module | `src/actions.ts` | +`view.open_whiteboard` action, +`CommandSpec.hint?` |
| Styles | `src/App.css` | `.whiteboard-*` rules (overview / organigramma / workflows) |

### Opening the tab

Three ways, all open-or-focus the existing tab:

| Method | Path |
|---|---|
| Command palette | ⌘P / Ctrl+P → "Open Whiteboard" → Enter |
| File menu (planned, not wired) | View → Open Whiteboard (out of scope for now) |
| Editor tab | Close + reopen from any previous session (persistent) |

### Gotchas

- **Tauri 2 + internal HTML5 drag is broken (the real culprit).** With the
  default `dragDropEnabled: true` on the main window, WKWebView fires
  `dragstart` on the source chip but **never** dispatches `dragover` /
  `dragenter` / `drop` to any DOM element on the same webview. We confirmed
  this with window-level `console.log` monitors: only `dragstart` and
  `dragend` fire — every other DnD event is silently swallowed by Tauri's
  native layer (intended for OS file drops; not internal drags). SOLUTION:
  the whiteboard DnD does NOT use HTML5 drag events at all — it uses plain
  `mousedown` on the chip + document-level `mousemove`/`mouseup` +
  `document.elementFromPoint` for hit-testing. Mouse events are independent
  of the drag pipeline, so they work everywhere. Trade-off: no cross-window
  drag of skills (not a use case) and the OS-level drag ghost is gone (we
  don't render one — visual cue is the agent border highlight on cursor
  over it).
- **Skill chip uses a `<div>` instead of `<span>`** for an unrelated
  reason — block-level elements with `display: inline-flex` behave better
  with the `cursor: grab` styling and `onMouseDown` pick-up. Not for DnD —
  there's no `draggable` attribute here at all.
- **Click vs drag threshold = 4 px.** Anything under that is treated as a
  click — opens the .md (if over an agent) or does nothing (if over the
  pool). Beyond 4 px we attach document-level mousemove and start updating
  the hover state. Keeps accidental drags from firing on clicky mouse users.
- **`elementFromPoint` is document-wide** — `findAgentAt` does
  `document.elementFromPoint(x, y).closest("[data-wb-agent]")`. This means
  even if the cursor is over a child element (the chip's name, the avatar)
  inside an agent, the closest() walker finds the agent wrapper. Robust.
- **Vite dev port 1422** is hardcoded and collides with running Tauri sessions
  on this machine. To verify changes without Tauri, pass an alt port
  (`npm run dev -- --port 9999`); the homepage serves fine.
- **Empty agents directory** — both the Overview and the Organigramma show an
  empty-state card with a CTA to "Open Organigramma" / "drop a `.md` in
  `.claude/agents/`". Important: the Organigramma tab is the default so the
  user sees the tree shape even when empty. Drag-target hit-testing only
  matches existing agents — drag with no agent registered = no-op.
- **`SubagentDef.path` may be `null`** when the loader can't resolve a path —
  the organigramma treats this as "read-only" (no write possible), surfaces a
  toast error rather than silently no-op'ing.
- **Subagent click must not call `openFile` + `moveTabToDrawer` in sequence** —
  `openFile` always appends/activates in the main pane first → black frame while
  Team is hidden and the file host is not ready. Use `openFileInDrawer` instead
  (also used by tree → drawer drop in `055`).
- **Whitelist `wb:` keys** — without the `clean()` whitelist, restart would
  drop the tab because there's no backing record (unlike `ai:` chats).
- **Already-open behaviour** — `wbOpen` focuses the existing tab/pane instead
  of duplicating (mirrors `openSubagent`).
- **The "hint" field** — adding it to `CommandSpec` is a small generic
  improvement: any future action can advertise its purpose in the palette
  instead of always showing the accel.

### Style + brand compliance

- Monochrome chrome (no accent orange in the body), `--accent` only on
  drop-target highlight border (1 frame during drag).
- No emoji anywhere — `Icon name="whiteboard"`, `Icon name="star"`,
  `Icon name="x"`, `Icon name="copy"`, `Icon name="save"`, `Icon name="file-text"`,
  `Icon name="git-branch"` only.
- All visual values via CSS variables (`--bg-alt`, `--border`, `--fg-dim`,
  `--accent`, `--radius-md`, etc.). No hardcoded colors, radii, shadows.
- `AIIcon` (Jack's duck) is the only place a duck image appears in the
  organigramma root — same source as the chat assistant identity, so a
  rebrand of `/jack.jpeg` updates the whiteboard + chat together.
