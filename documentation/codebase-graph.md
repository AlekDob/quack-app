---
type: codebase-graph
project: quack-app
generated: 2026-03-05
language: TypeScript (React + Tauri)
total_files: 542
---

# Quack — Codebase Dependency Graph

> Auto-generated navigational map. 542 TypeScript/TSX files scanned.
> Only local imports tracked (`@/`, `./`, `../`). External packages excluded.

---

## Core Files (Top 30 by Import Centrality)

| # | File | Imported By | Role |
|---|------|:-----------:|------|
| 1 | `types.ts` | 193 | Global type definitions |
| 2 | `components/TabBar.tsx` | 23 | Tab navigation system |
| 3 | `utils/platform.ts` | 17 | OS detection helpers |
| 4 | `components/CodeEditorCodeMirror.tsx` | 14 | Code editor component |
| 5 | `hooks/useSlashCommands.ts` | 14 | Slash command registry |
| 6 | `utils/agentAvatars.ts` | 14 | Agent avatar resolution |
| 7 | `stores/kanbanStore.ts` | 13 | Kanban board state |
| 8 | `stores/sessionStore.ts` | 13 | Agent session state |
| 9 | `components/MarkdownText.tsx` | 13 | Markdown renderer |
| 10 | `stores/ideStore.ts` | 12 | IDE integration state |
| 11 | `components/settings/controls/SectionHeader.tsx` | 12 | Settings section header |
| 12 | `components/RevealInFinderButton.tsx` | 11 | File reveal button |
| 13 | `services/brainFileService.ts` | 11 | Brain knowledge CRUD |
| 14 | `components/droid-factory/types.ts` | 11 | Droid/skill type defs |
| 15 | `stores/settingsStore.ts` | 10 | App preferences store |
| 16 | `components/modal-steps/types.ts` | 10 | Modal wizard types |
| 17 | `components/office/officeLayout.ts` | 10 | Office layout config |
| 18 | `stores/chatStore.ts` | 9 | Chat message state |
| 19 | `hooks/useAgentAvatar.ts` | 9 | Avatar hook |
| 20 | `components/settings/controls/SettingsRow.tsx` | 9 | Settings row layout |
| 21 | `hooks/useClaudeChat.ts` | 8 | Claude SDK chat hook |
| 22 | `utils/customAvatarStorage.ts` | 8 | Custom avatar storage |
| 23 | `services/modelService.ts` | 7 | LLM model config |
| 24 | `utils/version.ts` | 6 | Version comparison |
| 25 | `utils/projectUtils.ts` | 6 | Project path helpers |
| 26 | `components/store/StoreIcons.tsx` | 6 | Store icon components |
| 27 | `components/store/storeConstants.ts` | 6 | Store constants |
| 28 | `types/structuredOutputs.ts` | 6 | Structured output types |
| 29 | `hooks/maxPlanTypes.ts` | 6 | Plan mode types |
| 30 | `stores/fileSystemStore.ts` | 5 | File system state |

---

## Orchestrators (Highest Out-Degree)

Files that import the most other files — entry points and integration hubs.

| File | Imports | Role |
|------|:-------:|------|
| `App.tsx` | 113 | **Main app shell** — routes, providers, layout |
| `AppRefactored.tsx` | 19 | Refactored app variant |
| `components/SidePanel.tsx` | 19 | Left sidebar navigation |
| `components/StreamMessage.tsx` | 19 | Chat message renderer |
| `components/settings/UnifiedSettings.tsx` | 18 | Settings mega-panel |
| `components/ChatInput.tsx` | 16 | Chat input with slash cmds |
| `components/ChatView.tsx` | 16 | Chat conversation view |
| `components/SidePanelAccordion.tsx` | 16 | Sidebar accordion |
| `components/TerminalSidebar.tsx` | 15 | Terminal panel sidebar |
| `components/ChatMessage.tsx` | 12 | Single chat message |
| `components/RepositoryGroup.tsx` | 12 | Git repository group |
| `components/QuackStoreDrawer.tsx` | 10 | Plugin store drawer |
| `components/automation/AutomationJobForm.tsx` | 10 | Automation job editor |

---

## Feature Clusters

Grouped by directory. Central file = most-imported within the cluster.

### `components/` — 202 files (UI layer)

| Sub-cluster | Files | Central File | In-Degree |
|-------------|:-----:|--------------|:---------:|
| settings/ | 27 | `controls/SectionHeader.tsx` | 12 |
| office/ | 12 | `officeLayout.ts` | 10 |
| droid-factory/ | 9 | `types.ts` | 11 |
| store/ | 9 | `StoreIcons.tsx` | 6 |
| brain/ | 8 | `BrainSidebar.tsx` | 3 |
| kanban/ | 7 | `KanbanCard.tsx` | 3 |
| modal-steps/ | 7 | `types.ts` | 10 |
| terminal/ | 7 | `TerminalMain.tsx` | 2 |
| automation/ | 5 | `AutomationHistoryList.tsx` | 1 |
| claude-assets/ | 6 | `AssetCard.tsx` | 2 |
| structured-outputs/ | 5 | `index.ts` | 2 |
| docs/ | 4 | `DocsViewer.tsx` | 3 |
| Root components | ~100 | `TabBar.tsx` | 23 |

### `hooks/` — 54 files (Business logic)

| Key Hook | In-Degree | Purpose |
|----------|:---------:|---------|
| `useSlashCommands.ts` | 14 | Slash command registry |
| `useAgentAvatar.ts` | 9 | Agent avatar resolution |
| `useClaudeChat.ts` | 8 | Claude SDK streaming |
| `useMarketplace.ts` | 5 | Plugin marketplace |
| `useAppConfig.ts` | 4 | App configuration |
| `useRules.ts` | 4 | CLAUDE.md rules |
| `useBackgroundAgents.ts` | 3 | Background task mgmt |

### `stores/` — 20 files (Zustand state)

| Store | In-Degree | Purpose |
|-------|:---------:|---------|
| `kanbanStore.ts` | 13 | Task board |
| `sessionStore.ts` | 13 | Active sessions |
| `ideStore.ts` | 12 | IDE integration |
| `settingsStore.ts` | 10 | Preferences |
| `chatStore.ts` | 9 | Chat messages |
| `fileSystemStore.ts` | 5 | File tree |
| `teamStore.ts` | 4 | Agent teams |
| `terminalStore.ts` | 4 | Terminal state |
| `uiStore.ts` | 3 | UI panels/theme |

### `services/` — 23 files (Backend integration)

| Service | In-Degree | Purpose |
|---------|:---------:|---------|
| `brainFileService.ts` | 11 | Knowledge CRUD |
| `modelService.ts` | 7 | LLM model config |
| `cronUtils.ts` | 4 | Cron parsing |
| `giphyService.ts` | 5 | GIF search |

### `utils/` — 30 files (Utilities)

| Utility | In-Degree | Purpose |
|---------|:---------:|---------|
| `platform.ts` | 17 | OS detection |
| `agentAvatars.ts` | 14 | Avatar URLs |
| `customAvatarStorage.ts` | 8 | Custom avatars |
| `version.ts` | 6 | Version compare |
| `projectUtils.ts` | 6 | Path helpers |
| `skillsAndDroidsLoader.ts` | 5 | Lazy skill loading |
| `agentNames.ts` | 5 | Agent name gen |
| `testModeStorage.ts` | 5 | Test mode flags |

### `contexts/` — 10 files (React contexts)

| Context | In-Degree | Purpose |
|---------|:---------:|---------|
| `TestModeContext.tsx` | 4 | Test mode provider |
| `GitContext.tsx` | 2 | Git state provider |
| `TerminalContext.tsx` | 2 | Terminal provider |
| `FileSystemContext.tsx` | 2 | File system provider |

### `tests/` — 61 files

Test files. Not imported by production code.

---

## Top Signatures

Key exports from the 15 most central files.

**`types.ts`** (193 importers)
`AgentChat`, `TerminalInfo`, `ProjectTerminal`, `AgentTerminal`, `ProcessInfo`, `DirectoryEntry`, `NativeTerminal`, `SavedCommand`

**`TabBar.tsx`** (23)
`Tab`, `PopoutPosition` interfaces

**`platform.ts`** (17)
`getPlatform()`, `isMacOS()`, `isWindows()`, `cleanPath()`, `getModifierKey()`, `formatShortcut()`

**`useSlashCommands.ts`** (14)
`SlashCommand` interface, `useSlashCommands()` hook

**`agentAvatars.ts`** (14)
`AVAILABLE_AVATARS`, `getAvatarUrl()`, `getAgentAvatar()`, `getRandomAvatar()`

**`kanbanStore.ts`** (13)
`useKanbanStore`, `kanbanWriteLock`, `KanbanNotification`

**`sessionStore.ts`** (13)
`useSessionStore`, `shouldArchiveSession()`

**`ideStore.ts`** (12)
`useIDEStore`, `IDE_REGISTRY`, `IDEInfo`, `IDEConfig`, selectors

**`brainFileService.ts`** (11)
`BrainEntry`, `getProjectDocPath()`, `getCustomBrainPath()`

**`settingsStore.ts`** (10)
`useSettingsStore`

**`chatStore.ts`** (9)
`useChatStore`

**`useClaudeChat.ts`** (8)
`useClaudeChat()`, `ThinkingMode`, `PermissionMode`, `ChatSendOptions`

**`modelService.ts`** (7)
`getModels()`, `getModelId()`, `getDefaultModel()`, `ModelConfig`

**`version.ts`** (6)
`parseVersion()`, `compareVersions()`, `isNewerVersion()`

**`projectUtils.ts`** (6)
`extractProjectId()`, `isValidProjectPath()`, `formatProjectName()`

---

## Dependency Flow

```
                        ┌─────────────────────────────┐
                        │          App.tsx             │
                        │   (113 imports — main hub)   │
                        └─────────┬───────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
     ┌────────▼───────┐  ┌───────▼────────┐  ┌──────▼────────┐
     │   ChatView     │  │  SidePanel     │  │ UnifiedSettings│
     │   ChatInput    │  │  SidePanelAcc  │  │ (18 imports)   │
     │   (16 imports) │  │  (19 imports)  │  └───────┬────────┘
     └────────┬───────┘  └───────┬────────┘          │
              │                   │                   │
     ┌────────▼──────────────────▼──────────────────▼────┐
     │                    Shared Layer                     │
     │  ┌──────────┐ ┌───────────┐ ┌──────────────────┐  │
     │  │  Stores  │ │   Hooks   │ │    Services      │  │
     │  │ session  │ │ useChat   │ │ brainFileService │  │
     │  │ kanban   │ │ useSlash  │ │ modelService     │  │
     │  │ settings │ │ useAvatar │ │ cronUtils        │  │
     │  │ chat     │ │           │ │                  │  │
     │  └────┬─────┘ └─────┬────┘ └────────┬─────────┘  │
     │       │              │               │             │
     │  ┌────▼──────────────▼───────────────▼──────────┐  │
     │  │              types.ts (193)                   │  │
     │  │  + utils/platform.ts (17)                     │  │
     │  │  + utils/agentAvatars.ts (14)                 │  │
     │  └──────────────────────────────────────────────┘  │
     └────────────────────────────────────────────────────┘
```

**Data flow**: `App.tsx` orchestrates views → views use hooks/stores → hooks/stores depend on services → everything depends on `types.ts`.

---

## Quick Reference

- **Need types?** → `src/types.ts` (193 importers — the universal contract)
- **Need state?** → `src/stores/` — Zustand stores, `sessionStore` and `kanbanStore` are most used
- **Need AI chat?** → `hooks/useClaudeChat.ts` → services/modelService
- **Need UI component?** → `components/` — `TabBar`, `MarkdownText`, `CodeEditorCodeMirror` are shared
- **Need platform info?** → `utils/platform.ts`
- **Need brain/knowledge?** → `services/brainFileService.ts`
- **Entry point?** → `App.tsx` (113 imports, the mega-orchestrator)
