---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React 18 TS)
created: 2026-04-17
last_verified: 2026-04-17
tags: [brain, knowledge-base, timeline, markdown-viewer, file-explorer, search]
---

## Quack Brain UI
**Purpose:** Dedicated Tauri webview window that browses, searches, filters and renders the two-level knowledge store (project `documentation/` + global `~/.quack/brain/`) across timeline, categorized entries, guides and a force-graph.
**Stack:** Tauri v2 webview window + React 18 + TypeScript strict + Zustand (settings) + lucide-react + react-force-graph-2d + Mermaid.

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Route/Page | brain.html | Secondary Tauri entry point — loads `brain-main.tsx` |
| Route/Page | src/brain-main.tsx | `BrainRoot` — bootstraps window, reads `?project=` param, listens `brain-project-update` event |
| Component | src/components/brain/BrainApp.tsx | Top-level shell — scope (project/global), view router (timeline/knowledge/graph/guide), category counts, guide feature discovery |
| Component | src/components/brain/BrainSidebar.tsx | Left nav — scope switcher, view tabs, category accordion (decisions/bugs/patterns/gotchas), guide features tree, map.md + CLAUDE.md quick links |
| Component | src/components/brain/BrainTimeline.tsx | Chronological feed — merges JSONL activity events + diary bullets + brain entries, grouped by Today/Yesterday/Week/Date, with search input and type-filter buttons |
| Component | src/components/brain/BrainKnowledge.tsx | Category list view — filters entries by type (decision/bug_fix/pattern/gotcha), renders `BrainEntryCard` grid sorted by date desc |
| Component | src/components/brain/BrainEntryCard.tsx | Single entry preview card — title, type badge, tags, date |
| Component | src/components/brain/BrainGuide.tsx | Human guides viewer — lists pages under `documentation/guide/{featureId}/`, opens markdown in editor |
| Component | src/components/brain/BrainGraph.tsx | Force-directed graph — nodes per entry, links via shared tags, color per type, Human/AI filter, click opens entry |
| Component | src/components/brain/BrainEditor.tsx | Markdown viewer/editor — view/edit toggle, save to disk, Mermaid rendering with zoom/pan, CLAUDE.md raw fallback |
| Component | src/components/BrainContextBanner.tsx | In-chat banner surfacing Brain hits for current context |
| Service | src/services/brainFileService.ts | `listBrainEntries()`, `readBrainEntry()`, `saveBrainEntry()`, `appendDiaryEntry()`, `getProjectDocPath()`, `getBrainRootPath()`, `initBrainStructure()`, `openBrainFolder()`, `setBrainCustomPath()` |
| Service | src/services/activityLogService.ts | `readActivities()` — JSONL activity event reader for timeline |
| Service | src/services/brainSessionService.ts | Session-level brain persistence helpers |
| Model/Type | src/schemas/brainEntry.schema.ts | `BrainEntry` YAML-frontmatter schema validation |
| Model/Type | src/types/activity.ts | `ActivityEvent`, `ActivityEventType` union (task/bug_fix/decision/deploy/refactor/feature/pattern/gotcha/diary/note) |
| Store/State | src/hooks/useBrainStats.ts | Stats hook — entry counts, stale detection |
| Util | src/utils/brainPathDetection.ts | Auto-detect brain location from project markers |
| Util | src/utils/platform.ts | `normalizeToForwardSlash()` — Windows path compat |
| Config | src/components/settings/categories/SecondBrainSettings.tsx | Settings pane — custom brain path, Obsidian toggle, open folder |
| Route/Page | src-tauri/src/brain_window.rs | `open_brain_window(project_path)` Tauri command — reuses existing window, builds 1200x800 webview, macOS overlay titlebar |
| Config | knip.json | Registers `src/brain-main.tsx` as entry point (prevents dead-code deletion) |

### Data Flow
User clicks Brain button in App → `invoke('open_brain_window', { projectPath })` → `brain_window.rs` builds/focuses webview → `brain.html` loads `brain-main.tsx` → `BrainRoot` reads `?project=` + listens `brain-project-update` → `BrainApp` resolves `brainPath` via `getProjectDocPath()` / `getBrainRootPath()` → `listBrainEntries()` invokes `list_directory` (Rust) → `readBrainEntry()` invokes `read_file_content` + parses YAML frontmatter → rendered in `BrainTimeline` / `BrainKnowledge` / `BrainGuide` / `BrainGraph` → selection sets `selectedEntry` → `BrainEditor` loads + renders markdown / Mermaid → edit + Save invokes `write_file_content`.

Project change from main window: `ChatView` / agent switch → `emitTo('brain', 'brain-project-update', { projectPath })` → `BrainRoot.setProjectPath()` → `BrainApp` effect reloads counts + paths.

### Key Functions
- `open_brain_window(projectPath?: String) → Result<String, String>` — Rust command, creates or focuses the brain webview window
- `BrainApp({ projectPath }) → JSX` — orchestrator; normalizes path, loads counts, discovers guides
- `loadCounts() → void` — counts entries per type for sidebar badges
- `listBrainEntries(options: { projectRoot?, type?, global? }) → Promise<string[]>` — lists markdown files under the resolved base path, optionally filtered by type folder
- `readBrainEntry(filePath: string) → Promise<BrainEntry | null>` — reads + parses YAML frontmatter + body
- `loadDiaryAsEvents(index) → Promise<ActivityEvent[]>` — parses diary bullets `[HH:MM] (Author) text` into timeline events
- `loadBrainAsEvents(index) → Promise<ActivityEvent[]>` — aggregates bug_fix/decision/pattern/gotcha into events
- `groupByDate(events: ActivityEvent[]) → Record<string, ActivityEvent[]>` — Today/Yesterday/Week/formatted-date buckets
- `toggleExpand(index: number, event: ActivityEvent) → void` — inline content reveal
- `saveBrainEntry(entry) → Promise<string>` — writes new knowledge file with frontmatter
- `appendDiaryEntry(projectRoot: string, content: string) → Promise<string>` — append bullet to today's diary
- `initBrainStructure(projectRoot?: string) → Promise<void>` — ensures category folders exist
- `getProjectDocPath(projectRoot: string) → string` — `{root}/documentation` forward-slash normalized
- `getBrainRootPath() → Promise<string>` — global brain path (custom or `~/.quack/brain`)
- `openBrainFolder(inObsidian?: boolean) → Promise<void>` — OS-level reveal

### State
- `projectPath`: string | undefined — current brain scope root (route)
- `activeView`: 'timeline' | 'knowledge' | 'graph' | 'guide' — selected main pane (route)
- `scope`: 'project' | 'global' — project docs vs `~/.quack/brain` (route)
- `activeCategory`: string — decisions/bugs/patterns/gotchas filter (route)
- `activeGuideFeature`: string — selected guide folder id (route)
- `selectedEntry`: string | null — file path open in `BrainEditor` (route)
- `entryCounts`: { decisions, bugs, patterns, gotchas } — sidebar badges (route)
- `guideFeatures`: GuideFeature[] — discovered guide folders + pages (route)
- `brainPath`: string — resolved base path (route)
- `mapPath` / `claudeMdPath`: string | null — quick-link targets (route)
- `events` / `filteredEvents`: ActivityEvent[] — timeline feed (component)
- `filter`: ActivityEventType | 'all' — timeline type filter (component)
- `search`: string — timeline full-text query (component)
- `contentIndex`: Map<string, string> — lowercased content cache for search (component)
- `expanded` / `expandedContent`: Set / Map — inline preview state (component)
- `mode`: 'view' | 'edit' — editor mode (component)
- `zoom` / `pan`: number / {x,y} — Mermaid viewport (component)
- `quack-brain-path`: string — custom brain root override (global, localStorage)

### External Dependencies
- Tauri commands: `open_brain_window`, `list_directory`, `read_file_content`, `write_file_content`, `create_directory`, `get_home_directory`
- Tauri event: `brain-project-update` (main → brain window)
- react-force-graph-2d: canvas graph rendering
- mermaid (dynamic import): diagram rendering in editor
- lucide-react: icons
- Filesystem: `{project}/documentation/` + `~/.quack/brain/` (markdown with YAML frontmatter)

### Config
- `quack-brain-path`: custom global brain root (default `~/.quack/brain`)
- `.quack/brain-path` marker: written on path change for agent discovery
- Window: label `brain`, 1200x800, min 900x600, macOS `TitleBarStyle::Overlay`
- Category folders: `patterns`, `bugs`, `decisions`, `gotchas`, `diary`, `inbox` (project) + `patterns`, `preferences`, `people`, `tools`, `diary` (global)

### UI Strings
- Sidebar views: `Timeline`, `Knowledge`, `Graph`, `Guide`
- Categories: `Decisions`, `Bug Fix`, `Pattern`, `Gotcha`
- Timeline groups: `Today`, `Yesterday`, `This week`
- Timeline search placeholder: `Search content...`
- Empty state: `No activity recorded`
- Editor actions: `View`, `Edit`, `Save`
- Quick links: `map.md`, `CLAUDE.md`
