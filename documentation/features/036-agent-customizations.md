---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-04
last_verified: 2026-07-04
tags: [agent-customizations, instructions, skills, mcp, providers, privacy, modal, agent-hub, agent-mode]
---

## Agent Customizations (sidebar + modal)

**Purpose:** One surface for everything that teaches or extends the agent — workspace
instructions, skills, plugins, MCP servers, tool permissions, API providers, and AI
privacy paths. Replaces scattered Settings deep-links with a VS Code–style
"Agent Customizations" dialog. The **entry list** (`.agent-custom`) is pinned to the
bottom of whichever agents sidebar is visible; each row opens the shared modal at the
matching tab.

**Stack:** React 19, TypeScript strict, `FileEditorPane` for Instructions, existing
panes for Skills/Plugins/MCP/Privacy.

### Entry points (`.agent-custom`)

| Layout | Container | When visible |
|---|---|---|
| Editor mode | `AIChatsRail` → `.agent-hub-list` footer | Hub **expanded** only (240px rail) |
| Agent mode | `AgentModeShell` → `.agent-agents` footer | Always (agents column is always wide) |

Both import the shared `AgentCustomizations` component — no duplicated menu items.

Layout (editor hub, expanded):

```
.agent-hub
├── .agent-hub-header          ← New chat + collapse
└── .agent-hub-list            ← flex column, min-height 0
    ├── .agent-hub-list-body   ← scrollable status groups
    └── .agent-custom          ← pinned bottom (flex-shrink 0, margin-top auto)
```

Collapsed hub (36px) hides Customizations — there is no room for labels.

### Modal (`CustomizationsModal`)

Single tabbed dialog opened from any entry row. Left nav tabs, content on the right.

| Tab | Surface |
|---|---|
| Instructions | `FileEditorPane` on workspace rules (`loadWorkspaceRules`) |
| Skills | `SkillsPane` |
| Plugins | `PluginsPane` |
| MCP Servers | `McpServerBrowser` |
| Tool Access | `ToolPermissionRow` list |
| Providers | `ApiKeyRow` per `PROVIDERS` |
| Privacy | `AIPrivacyEditor` |

Modal uses `.cust-modal` shell (liquid glass). Instructions tab gets Edit/Split/Preview
via `FileEditorPane` + `EditorTabToolbar` (see `027-editor-tab-toolbar.md`).

### Key files

| Concern | File |
|---|---|
| Shared footer menu | `src/components/AgentCustomizations.tsx` |
| Tabbed modal | `src/components/CustomizationsModal.tsx` |
| Hub mount + modal state | `src/components/AIChatsRail.tsx` |
| Agent-mode mount + modal state | `src/components/AgentModeShell.tsx` |
| Footer + hub scroll layout | `src/App.css` → `.agent-custom`, `.agent-hub-list`, `.agent-hub-list-body` |

### Data / scope

- Hub opens the modal with **`activeId` workspace `root`** — same project context as the
  focused editor tab.
- Agent mode uses the active workspace from `AgentModeShell` props (`wsId`).
- No new persistence; each tab reads/writes its existing stores (rules file, skills dir,
  `~/.claude/settings.json`, etc.).

### Gotchas

- **Two modal instances** (hub + agent shell) are fine — only one layout mounts at a time
  (`App.tsx` switches `AgentModeShell` vs `WorkspaceShell`).
- **Don't duplicate the item list** — always extend `AgentCustomizations.tsx`; the modal
  tab list in `CustomizationsModal` is the authoritative tab set (keep in sync when adding
  tabs).

### Related docs

- `009-agent-hub.md` — cross-project hub; Customizations footer when expanded
- `001-ai-session-library.md` — Agent Mode sessions column
- `027-editor-tab-toolbar.md` — markdown preview inside Instructions tab
