---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React 18)
created: 2026-04-04
last_verified: 2026-05-26
tags: [accordion, side-panel, ui, layout, navigation, brain, documentation-explorer, task-hub, workstreams, project-ops]
---

## Side Panel Accordion
**Purpose:** Collapsible side panel with 16 sections (focus-one-at-a-time pattern), compact icon-strip mode with peek-on-hover overlay, each section hosting a dedicated content panel for workspace management. Task Hub lives at slot #0 with a badge surfacing sessions that need user action. Workstreams + Status slots (project-ops layer) sit right after Changes.
**Stack:** React 18, TypeScript strict, CSS (glassmorphism)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/SidePanelAccordion.tsx` | Main accordion container with AccordionSection sub-component, CATEGORY_COLORS map, SVG icons |
| Component | `src/components/TaskHubView.tsx` | Task Hub view: priority-grouped session triage with internal search (slot #0) |
| Component | `src/components/ChangesPanel.tsx` | Git diff panel (branch, modified files, commit history) |
| Component | `src/components/FileExplorer.tsx` | File tree browser with lazy-load children |
| Component | `src/components/FeaturesPanel.tsx` | Feature map entries viewer |
| Component | `src/components/AgentContextPanel.tsx` | Active agent personality, avatar, workspace info |
| Component | `src/components/WorkstreamsPanel.tsx` | project-ops workstreams grouped by focus (current/active/background/…) |
| Component | `src/components/WorkstreamStatusPanel.tsx` | Snapshot of `focus: current` workstreams with their status field |
| Hook | `src/hooks/useWorkstreams.ts` | Lists `documentation/workstreams/NN-*.md`, parses YAML frontmatter |
| Component | `src/components/RulesPanel.tsx` | Agent rules (global + project scope) |
| Component | `src/components/AgentsPanel.tsx` | Droids list, create/select/use agents |
| Component | `src/components/SkillsPanel.tsx` | Skills list with search and refresh |
| Component | `src/components/CommandsPanel.tsx` | Slash commands (currently hidden in UI) |
| Component | `src/components/MCPPanel.tsx` | MCP server list, config access |
| Component | `src/components/HooksPanel.tsx` | Hook configs (save/delete/toggle) |
| Component | `src/components/SessionsPanel.tsx` | Session history list |
| Config/Style | `src/components/SidePanelAccordion.css` | Glassmorphism panel, compact mode overrides, focus-mode layout |
| Service | `src/hooks/useRules.ts` | Rules fetcher for badge counter |
| Service | `src/hooks/useSlashCommands.ts` | Commands fetcher for badge counter |
| Service | `src/hooks/useMCPServers.ts` | MCP servers fetcher for badge counter |

### Data Flow
- [App.tsx] --> props --> [SidePanelAccordion] --> renders --> [AccordionSection x12]
- [AccordionSection] --> CSS class toggle (accordion-content--open/closed) --> [ContentPanel child]
- [useRules/useSlashCommands/useMCPServers] --> badge counts --> [AccordionSection badge prop]
- [Parent] --> forceExpandSection prop --> [SidePanelAccordion] --> setFocusedSection --> auto-scroll top

### Key Functions
- `AccordionSection(props: AccordionSectionProps) --> JSX` -- collapsible section with chevron, icon, badge, category color CSS var; supports hover-to-open via onHoverEnter/onHoverLeave
- `toggleSection(sectionId: string) --> void` -- focus/unfocus pattern (click focused = collapse, click other = focus it)
- `handleSectionHoverEnter(sectionId: string) --> void` -- debounced (500ms) hover-to-open: sets focusedSection on mouseenter (compact mode only)
- `handleSectionHoverLeave() --> void` -- debounced (300ms) hover-to-close: clears focusedSection on mouseleave (compact mode only)
- `getOrder(sectionId: string) --> number` -- fixed DOM order via sectionIds array index

### State
- `focusedSection`: string | null -- which section is expanded (single-focus pattern) (component)
- `isPeekExpanded`: boolean -- whether peek overlay is shown in compact mode (component)
- `peekTimeoutRef`: RefObject -- debounce timer for peek enter/leave (component)
- `hoverTimeoutRef`: RefObject -- debounce timer for section hover-to-open/close (component)
- `containerRef`: RefObject<HTMLDivElement> -- scroll-to-top on focus change (component)
- `rules`: RulesResponse -- fetched via useRules for badge count (component)
- `commands`: SlashCommandsResponse -- fetched via useSlashCommands for badge count (component)
- `mcpServers`: MCPServer[] -- fetched via useMCPServers for badge count (component)
- `brainLoaded`: boolean -- whether Brain documentation/ root has been loaded (component)
- `brainLoading`: boolean -- Brain initial load in progress (component)
- `brainFileCount`: number -- count of .md + .mmd files in documentation/ for badge (component)
- `brainRootPath`: string | null -- derived from `rootPath + '/documentation'` (component)

### Compact Mode (Icon Strip + Peek Overlay)
| Concept | Detail |
|---------|--------|
| Trigger | `userCollapsed=true` (user clicked toggle) AND `activeAgentId` exists |
| Strip width | 44px grid column, icons centered with colored badge dots |
| Peek trigger | mouseEnter 80ms debounce → `isPeekExpanded=true` |
| Peek close | mouseLeave 300ms debounce → `isPeekExpanded=false` |
| Overlay | `position: fixed; right: 0; width: 420px; z-index: 9999;` |
| Animation | CSS `transition: transform 0.3s` with `translateX(calc(100% - 44px))` → `translateX(0)` |
| Shadow | `-12px 0 40px rgba(0,0,0,0.6)` — bi-directional transition |
| Hover-to-open | mouseEnter on section → 500ms debounce → expand section (compact mode only) |
| Hover-to-close | mouseLeave from section → 300ms debounce → collapse section (compact mode only) |
| Auto-collapse tabs | `isCollapsed && !userCollapsed` → fully hidden (`display: none`), NOT compact strip |

- `isCompact`: derived — `userCollapsed && !!activeAgentId`
- `shouldBeHidden`: derived — `!activeAgentId || (isCollapsed && !userCollapsed)`
- `userCollapsed` prop: distinguishes user-initiated collapse from tab-auto-collapse (docs, kanban, feature map)

### Persistence
- `sidePanelCollapsed` persisted via Zustand `ui-storage` localStorage key
- App.tsx reads initial value from localStorage on mount, syncs back via `useEffect` → `setSidePanelCollapsed` store action
- Compact mode preference survives app restart
- Hydration flow: localStorage → `ui-storage` JSON parse → `sidePanelCollapsed` boolean → App.tsx `useEffect` sets Zustand store on mount

### Config
- `CATEGORY_COLORS`: per-section color map (taskhub=#a855f7, changes=#34d399, workstreams=#fbbf24, status=#84cc16, brain=#e879f9, skills=#f28c52, agents=#f28c52, droids=#4ecdc4, rules=#60a5fa, hooks=#a78bfa, features=#FFD700, sessions=#00d9ff, mcp=#34d399, commands=#f472b6, context=#f28c52, token-stats=#22d3ee)
- `sectionIds`: fixed order array -- `['taskhub', 'changes', 'workstreams', 'status', 'context', 'brain', 'features', 'agent-context', 'rules', 'agents', 'skills', 'commands', 'mcp', 'hooks', 'sessions', 'token-stats']`

### Sections (16 total, 1 hidden)
| # | ID | Title | Content Panel | Badge Source |
|---|-----|-------|---------------|-------------|
| 0 | taskhub | Task Hub | TaskHubView | `computeTaskHubBadge(...)` = P1 (Needs attention) + P3 (Agent done) |
| 1 | changes | Changes | ChangesPanel | modifiedFiles.size |
| 2 | workstreams | Workstreams | WorkstreamsPanel | -- (count visible inline) |
| 3 | status | Status | WorkstreamStatusPanel | -- (focus:current count inline) |
| 4 | context | File Explorer | FileExplorer | -- |
| 5 | brain | Brain | FileExplorer (rooted at documentation/, sortBy=modified) | .md + .mmd file count |
| 6 | features | Features | FeaturesPanel | -- |
| 7 | agent-context | Agent Personality | AgentContextPanel | -- |
| 8 | rules | Agent Rules | RulesPanel | rulesCount (project + global) |
| 9 | agents | Droids | AgentsPanel | agents.length |
| 10 | skills | Skills | SkillsPanel | skills.length |
| 11 | commands | Commands | CommandsPanel | commandsCount (hidden) |
| 12 | mcp | MCP Servers | MCPPanel | mcpCount |
| 13 | hooks | Hooks | HooksPanel | hooks.filter(enabled).length |
| 14 | sessions | Sessions | SessionsPanel | -- |
| 15 | token-stats | Token Stats | AgentTokenStatsPanel | -- |

### Workstreams + Status (project-ops integration)
| Aspect | Detail |
|--------|--------|
| Source | `documentation/workstreams/NN-*.md` — YAML frontmatter (ws/title/status/focus/warning/updated) |
| Hook | `useWorkstreams(rootPath)` — lists dir, parses frontmatter, returns typed `Workstream[]` |
| Workstreams panel | Groups by `focus` (current → active → background → candidate → superseded → completed); each card shows num, title, status, warning, upd date |
| Status panel | Only `focus:current`; surfaces the `status` field as a snapshot for daily standups / status reports |
| Open file | Click on a card → `onOpenFile` → CodeMirror editor tab (same pipeline as FileExplorer) |
| Refresh | Manual button; auto-refresh via PostToolUse hook regenerating `INDEX.md` after any Edit/Write |
| Empty state | Hint to bootstrap via `bash ~/.claude/skills/project-ops/scripts/setup-pm-docs.sh` |
| Colors | workstreams=amber `#fbbf24`, status=lime `#84cc16` |

### CSS Architecture
- **Glassmorphism base**: `rgba(15,17,21,0.96)` + `backdrop-filter: blur(var(--blur-heavy)) saturate(150%)` (near-opaque for readability)
- **Content animation**: `.accordion-content--open` (max-height 80vh, opacity 1, 0.4s ease-out) / `.accordion-content--closed` (max-height 0, opacity 0, 0.25s ease-in) — smooth expand/collapse without conditional render
- **Focus mode**: `.accordion-section.focused` gets `flex: 1` + content scrolls up to `80vh - 50px`
- **Category color**: CSS custom property `--category-color` set per section, used by badge and icon styles
- **Content compact mode**: `!important` overrides for all child panels (12px base font, 6px padding cards, 14px icons)
- **Changes badge**: always-visible glow animation (`changes-badge-pulse` keyframe)
- **Compact strip**: `.compact:not(.peek-expanded)` — icons centered in 44px, chevron/title hidden, badge as 6px dot
- **Peek overlay**: `.compact .accordion-container` fixed at right, `translateX` transition for smooth slide, `rgba(15,17,21,0.96)` background
- **Hidden**: `.collapsed` — `display: none` (no agent or auto-collapsed by tab)

### Brain Section (Documentation Explorer)
| Aspect | Detail |
|--------|--------|
| Root path | `${rootPath}/documentation` — derived, not configurable |
| Content | Reuses `FileExplorer` component with `sortBy="modified"` |
| Sort order | Directories first, then files by `modified_at` descending (newest first) |
| Badge | Count of `.md` + `.mmd` files via `search_files_recursive` (max 500, depth 5) |
| Lazy load | `documentation/` root loaded on first expand via `onLoadChildren` |
| Tree cache | Shared with main File Explorer (`explorerTree` in App.tsx, path-keyed) |
| File open | Same `onOpenFile` handler — opens in integrated CodeMirror editor tab |
| Reset | `brainLoaded` + `brainFileCount` reset when `rootPath` changes (project switch) |
| Fallback | "No documentation found" when `brainRootPath` is null |
| Color | `#e879f9` (fuchsia) |
| Zero App.tsx changes | All state managed locally in SidePanelAccordion |
