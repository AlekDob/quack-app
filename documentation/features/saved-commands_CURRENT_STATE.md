---
type: feature-audit
project: quack-app
created: 2026-02-28
last_verified: 2026-02-28
---

# Feature
- Name: Saved Commands (Terminal)
- Status: **Functional** — accessible from both the main window and the standalone terminal window

# What It Does
Lets users save frequently-used terminal commands (e.g. `npm run dev`, `cargo build`) with a name, color, category, optional working directory, and optional project association. Commands can be launched in a new terminal or sent to the active terminal.

# Data Model
**Rust** (`src-tauri/src/commands.rs`):
```rust
pub struct SavedCommand {
    pub id: String,
    pub name: String,
    pub command: String,
    pub cwd: Option<String>,
    pub color: String,
    pub category: String,        // "dev" | "build" | "test" | "custom"
    pub project_path: Option<String>,  // None = global, Some = project-scoped
}
```

**TypeScript** (`src/types.ts:78-88`):
```ts
interface SavedCommand {
  id: string;
  name: string;
  command: string;
  cwd?: string;
  color: string;
  category: SavedCommandCategory;
  projectPath?: string;   // undefined = global, string = project-scoped
}
```

Backward-compatible: existing commands without `projectPath` are treated as global.

# Backend (Rust)
File: `src-tauri/src/commands.rs`

Persistence: Tauri plugin-store → `commands.json`, key `"saved_commands"`.

| Tauri command          | Purpose                         |
|------------------------|---------------------------------|
| `load_saved_commands`  | Read all commands from store    |
| `save_command`         | Create new command (UUID)       |
| `update_command`       | Update existing command by ID   |
| `delete_command`       | Delete command by ID            |

Empty `project_path` strings are sanitized to `None` server-side via `sanitize_optional_string()`.

Registered in `src-tauri/src/lib.rs:1027`.

# UI Surfaces

## Surface 1: Standalone Terminal Window (`TerminalWindowApp`)
The "TERMINALS" window is a separate Tauri window rendered by `src/components/TerminalWindowApp.tsx`. This is the view shown when opening the terminal popout.

**Entry points:**
- **Header button**: Terminal-prompt icon (`>_`) next to the `+` button in the "TERMINALS" sidebar header — opens drawer with all commands
- **Per-project button**: Terminal-prompt icon on each project header row — opens drawer filtered to that project

**Self-contained**: `TerminalWindowApp` manages its own saved commands state, loads from the same backend, and renders its own `SavedCommandsDrawer` + `SavedCommandModal` instances.

## Surface 2: Main App Window (`App.tsx` + `TerminalSidebar`)
The main Quack window has the full sidebar with footer bar.

**Entry points:**
- **Footer button**: "Commands" link in `TerminalSidebar` footer bar (after Settings) — opens drawer with all commands
- **Repo action row**: Teal icon in `RepositoryGroup` action row (visible on hover) — opens drawer filtered to that project

**Prop chains:**
- Global: `App.tsx` → `TerminalSidebar.onOpenSavedCommands`
- Per-project: `App.tsx` → `TerminalSidebar.onOpenProjectSavedCommands` → `SortableRepositoryGroup.onOpenSavedCommands` → `RepositoryGroup.onOpenSavedCommands`

# Frontend Components

| Component | File | Purpose |
|-----------|------|---------|
| `SavedCommandsDrawer` | `src/components/SavedCommandsDrawer.tsx` | Slide-in drawer, grouped by category. Supports `filterProject` prop for project-scoped view with "Show all" link. |
| `SavedCommandModal` | `src/components/SavedCommandModal.tsx` | Create/edit form. Supports `defaultProjectPath` to pre-fill project association. |
| `SavedCommands` | `src/components/SavedCommands.tsx` | Inline list variant (unused — legacy) |

# Filter Logic
When `filterProject` is set:
- Shows commands where `projectPath === filterProject` (project-specific)
- Also shows commands where `!projectPath` (global commands, available everywhere)
- Global commands display a "global" badge in filtered view
- "Show all" link clears the filter

# Dead Code (from earlier implementation)
These components exist but are never imported by active code:
- `src/components/TerminalDrawer.tsx`
- `src/components/TerminalWindowsPanel.tsx`
- `src/components/TerminalToolBar.tsx`
- `src/components/TerminalQuickActions.tsx`

# Relevant Files
**Backend**
- `src-tauri/src/commands.rs` — CRUD, store persistence, sanitization
- `src-tauri/src/lib.rs:1027` — command registration

**Standalone Terminal Window**
- `src/components/TerminalWindowApp.tsx` — state, load, launch handler, drawer/modal rendering, sidebar buttons

**Main App Window**
- `src/components/SavedCommandsDrawer.tsx` — drawer with filter support
- `src/components/SavedCommandModal.tsx` — create/edit modal with project field
- `src/components/TerminalSidebar.tsx` — footer button (global) + prop threading
- `src/components/RepositoryGroup.tsx` — repo action row button (per-project)
- `src/App.tsx` — state, wiring, filter logic, component rendering
