---
type: feature-doc
project: quack-app
stack: React 18 + TypeScript strict + CSS custom properties
created: 2026-04-06
last_verified: 2026-04-08
tags: [tool-call-rendering, chat, ui, badges, widgets, drag-drop, split-view, diff-viewer, fullscreen]
---

## Tool Call Rendering
**Purpose:** Renders agent tool invocations in chat as compact expandable badges (ToolCallMinimal) and specialized rich widgets (ToolWidgets), with consecutive tool grouping, status animations, and Brain path detection.
**Stack:** React 18, CSS custom properties, monospace font system

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | src/components/ToolCallMinimal.tsx | `ToolCallMinimal` (default, memo) -- compact expandable badge for any tool call |
| Component | src/components/ToolWidgets.tsx | `getToolColor`, `ToolIcon`, `SystemInitializedWidget`, `EditWidget`, `WriteWidget`, `BashWidget`, `ReadWidget`, `GrepWidget`, `TodoWriteWidget`, `ExitPlanModeWidget`, `EnterPlanModeWidget`, `ImagePreviewWidget` -- specialized rich widgets |
| Component | src/components/DiffViewer.tsx | `DiffViewer` -- renders diffs with 3 modes: unified, split (side-by-side), fullscreen overlay |
| Component | src/components/TodoWidget.tsx | `TodoWidget` -- renders TodoWrite items (used by both ToolCallMinimal and TodoWriteWidget) |
| Component | src/components/PlanWidget.tsx | `PlanWidget` -- renders ExitPlanMode plan content with approval UI |
| Component | src/components/RevealInFinderButton.tsx | `RevealInFinderButton` -- Finder/Explorer button used in ImagePreviewWidget |
| Component | src/components/TaskOutputWidget.tsx | `TaskOutputWidget` -- renders background task (subagent) output |
| Component | src/components/StreamMessage.tsx | Orchestrates tool rendering inside chat stream, decides ToolCallMinimal vs widget |
| Component | src/components/ChatMessage.tsx | Renders completed messages with tool calls |
| Component | src/components/ToolCallCard.tsx | Legacy/alternative card-style tool rendering |
| Util | src/utils/brainPathDetection.ts | `isBrainRead`, `isBrainPath`, `BRAIN_COLOR` -- detects Brain knowledge path access |
| Config | src/components/ToolCallMinimal.css | Styles for compact badges, status indicators, animations, tool-group-row |
| Config | src/components/ToolWidgets.css | Styles for rich widgets (SystemInit, Edit, Write, Bash, Read, Grep, Task, EnterPlanMode, ImagePreview) |

### Data Flow
```
[SDK stream event (tool_use/tool_result)] --> [StreamMessage / ChatMessage] --> [ToolCallMinimal (badge)] or [ToolWidgets (specialized widget)]
[ToolCallMinimal] --> [DiffViewer] (if hasDiff) or [<pre> result] (if hasResult)
[ToolCallMinimal] --> [TodoWidget] (if TodoWrite tool)
[Consecutive same-type tools] --> [.tool-group-row flex container] (horizontal flow)
[tool.input path] --> [isBrainRead()] --> [Brain badge + rose styling]
```

### Key Functions
- `ToolCallMinimal({ tool, onOpenFile, onUndoEdit }) --> JSX` -- renders a single tool as inline badge with expand/collapse, file-path bar with Open button + drag-to-split
- `getToolColor(toolName) --> string` -- maps tool name to CSS color (MCP Brain rose, MCP IDE purple, Bash purple, Edit accent, Read cyan, Write green, etc.)
- `ToolIcon({ name }) --> JSX` -- returns SVG icon for each tool type (30+ tool icons)
- `SystemInitializedWidget({ sessionId, model, cwd, tools }) --> JSX` -- session init banner with available tools grid
- `EditWidget({ file_path, old_string, new_string, result }) --> JSX` -- diff viewer with file link
- `WriteWidget({ filePath, content, result }) --> JSX` -- file creation with line count
- `BashWidget({ command, description, result }) --> JSX` -- command + output viewer
- `ReadWidget({ filePath, result }) --> JSX` -- file content viewer
- `GrepWidget({ pattern, path, result }) --> JSX` -- search results with match count
- `EnterPlanModeWidget({ objective }) --> JSX` -- purple header plan mode entry
- `ExitPlanModeWidget({ plan, pendingApprovalRequestId, onApprovalResponse }) --> JSX` -- plan display with approval
- `ImagePreviewWidget({ filePath, imageData, mediaType, onOpenInTab }) --> JSX` -- inline image with open-in-tab overlay
- `isBrainRead(toolName, input) --> boolean` -- detects if tool targets documentation/ or .quack/brain/ paths
- `isBrainPath(path) --> boolean` -- checks path against Brain path regex patterns
- `createDiffFromStrings(oldString, newString, fileName) --> ToolDiff` -- converts raw strings to diff format
- `buildSplitRows(lines: DiffLine[]) --> SplitRow[]` -- aligns removed/added lines into left/right pairs for side-by-side view; unchanged lines mirrored on both sides
- `DiffContent({ lines, splitMode, splitRows }) --> JSX` -- shared rendering component for both inline and fullscreen, avoids duplicating split/unified logic

### State
- `isExpanded`: boolean -- toggle for badge/widget content (component)
- `copied`: boolean -- clipboard feedback on target click (component)
- `tool.status`: `'running' | 'completed' | 'error'` -- drives status indicator + animations (component)
- `splitMode`: boolean -- DiffViewer toggle between unified (inline) and split (side-by-side) view
- `fullscreen`: boolean -- DiffViewer toggle for fullscreen overlay via createPortal

### External Dependencies
- `ChatToolCall` type from `src/types.ts`: tool name, input, result, status, diff fields
- `TodoItem` type from `src/types.ts`: todo structure for TodoWrite rendering
- `ToolDiff` / `DiffLine` types from `src/types.ts`: diff data model

### Config
- `--accent-color`: Edit tool badge color (CSS variable, user-customizable)
- `--radius-sm` / `--radius-md` / `--radius-lg`: border radius tokens
- `--bg-elevated` / `--bg-hover` / `--border-default` / `--text-tertiary`: theme tokens
- Tool color map (hardcoded in `getToolColor`): Edit=accent, Read=#00D9FF, Write=#22c55e, Bash=#9B59B6, Grep/Glob=#6b7280, MCP Brain=#E84A7F, MCP IDE=#a855f7, Skill=#fbbf24, etc.

### Behaviors
- **File path wrapping**: `.tool-minimal-file-path-text` uses `word-break: break-all` so long paths wrap instead of being truncated with ellipsis
- **Open button**: Both StreamMessage and ToolCallMinimal render an "Open" button inside the `.tool-minimal-file-path` bar. The button calls `onFilePathClick` (which is `handleFilePathClick` in App.tsx), respecting the `fileOpenTarget` setting: `internal` opens in Code Editor tab, `external` opens in preferred IDE
- **Drag-to-split**: The `.tool-minimal-file-path` bar is `draggable` with `application/quack-file` MIME type (same format as FileExplorer). Users can drag file paths from tool results onto `SplitDropZone` to open in split view
- **File path detection**: ToolCallMinimal extracts `filePath` from `input.file_path` (Edit/Write/Read) or `input.path` (Read/Glob), showing the file-path bar for all file-referencing tools
- **ChatMessage wiring**: `ChatMessage` passes `onFilePathClick || onOpenFile` to ToolCallMinimal, preferring the fileOpenTarget-aware handler

### DiffViewer Modes
| Mode | Trigger | Layout | Description |
|------|---------|--------|-------------|
| Unified | Default | Single column, removed (red) then added (green) | Standard inline diff |
| Split | Toggle button (split-pane icon) | Two 50% columns, left=old right=new | Side-by-side comparison, `buildSplitRows()` pairs removed/added lines |
| Fullscreen | Toggle button (expand icon) | Portal overlay, no max-height, 12px font | Full-viewport diff viewer, backdrop-blur, Escape/click-outside to close |

- Split + Fullscreen can be combined (split view inside fullscreen overlay)
- Header buttons: fixed 22x22px, `first-of-type` gets `margin-left: auto` to push right
- Fullscreen uses `createPortal(document.body)` to escape parent overflow constraints

### CSS Animations
- `typing-bounce`: 3-dot bounce for running status
- `shimmer`: horizontal sweep on running badge
- `text-glow`: brightness pulse on running tool name
- `pulse-dot`: scale/opacity pulse on status dot
- `expand-down`: slide-in for expanded content
- `spin`: spinner rotation for widget loading state
