---
type: feature-doc
project: codetta
stack: Tauri (Rust + React/TypeScript)
created: 2026-07-12
last_verified: 2026-07-24
tags: [agent-mode, tasks, todo, composer, checklist]
related:
  - 001-ai-session-library.md
  - 022-chat-composer.md
  - 085-agent-ide-mode-toggle.md
  - 006-chat-tool-render.md
  - 082-cursor-compact-action-stream.md
---

## Agent Tasks Checklist
**Purpose:** Cursor-style expandable chip of the active agent's live TodoWrite/TaskCreate items, docked **above the composer** in both IDE and Agent Mode. Collapsed by default; expands upward into the full checklist.
**Stack:** React 19 + TypeScript

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Store/State | `src/aiTaskStore.ts` | Module-level pub/sub (`tasksByChat` by chatId) — transient; feeds `workProgressStore` |
| Component | `src/components/chatPanelChrome.tsx` | `TodosCard` — chip + upward popover |
| Component | `src/components/AIChatPanel.tsx` | Owns `todos` state; `publishTasks`; mounts chip in `.ai-todos-bar` |
| Component | `src/components/AgentModeShell.tsx` | `clearTasks` on session close only (no sidebar Tasks UI) |
| Config | `src/App.css` | `.ai-todos-bar`, `.ai-todos-wrap`, `.ai-todos-chip`, `.ai-todos-pop`, `.ai-todo*` |

### Data Flow
Claude Code stream (`TodoWrite` / `TaskCreate` / `TaskUpdate`) → `AIChatPanel` `todos` state → `publishTasks(chatId, items)` → `aiTaskStore` (+ `workProgressStore`) **and** local `todos` → `TodosCard` above composer

### Key Functions
- `publishTasks(chatId, items | null) → void` — write/clear mirror; identical lists are no-ops
- `clearTasks(chatId) → void` — drop on Agent Mode session close
- `getTasks(chatId?) → AiTaskItem[]` — read snapshot (progress)
- `subscribeTasks(cb) → unsubscribe` — re-render listeners
- `TodosCard({ items }) → JSX` — chip (`N/M · current` or `Plan · N/M`) + expand-up list

### State
| State | Where | Notes |
|---|---|---|
| `todos` | `AIChatPanel` | Authoritative UI list for the chip |
| `open` | `TodosCard` | Popover toggle (local) |
| `tasksByChat` | `aiTaskStore` | Mirror for progress / other subscribers |

### Behavior Notes
- Same chip in Agent Mode (`compact`) and IDE — no `!compact` skip.
- Hidden when `todos.length === 0`.
- TodoWrite / TaskCreate / TaskUpdate / TaskList stay **out of** the compact action stream (006 / 082); the chip is the surface.
- Agent Mode left rail has **no** Tasks section and **no** “Editor layout” exit — Agents ↔ IDE is TopBar / `085`.

### Gotchas
- Do not resurrect a second checklist under the sessions rail — one surface only (composer chip).
- `aiTaskStore` is not the chip’s render path; the chip reads `AIChatPanel` `todos`. The store still matters for `workProgressStore` and `clearTasks`.
- Removed CSS: `.agent-tasks*`, `.agent-exit` (do not reintroduce without updating this doc).

### Related
- Composer dock family: `022-chat-composer.md` (Plan chip section)
- Layout toggle: `085-agent-ide-mode-toggle.md`
- Not the sessions hub: `009-agent-hub.md` / `001-ai-session-library.md`
