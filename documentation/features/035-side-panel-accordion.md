---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React 18)
created: 2026-04-04
last_verified: 2026-04-06
tags: [accordion, side-panel, ui, layout, navigation]
---

## Side Panel Accordion
**Purpose:** Collapsible side panel with 13 sections (focus-one-at-a-time pattern), compact icon-strip mode with peek-on-hover overlay, each section hosting a dedicated content panel for workspace management.
**Stack:** React 18, TypeScript strict, CSS (glassmorphism)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/SidePanelAccordion.tsx` | Main accordion container with AccordionSection sub-component, CATEGORY_COLORS map, SVG icons |
| Component | `src/components/ChangesPanel.tsx` | Git diff panel (branch, modified files, commit history) |
| Component | `src/components/FileExplorer.tsx` | File tree browser with lazy-load children |
| Component | `src/components/FeaturesPanel.tsx` | Feature map entries viewer |
| Component | `src/components/AgentContextPanel.tsx` | Active agent personality, avatar, workspace info |
| Component | `src/components/ProjectContextPanel.tsx` | Project notes, Brain, bookmarks |
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
- `CATEGORY_COLORS`: per-section color map (changes=#34d399, brain=#e879f9, skills=#f28c52, agents=#f28c52, droids=#4ecdc4, rules=#60a5fa, hooks=#a78bfa, features=#FFD700, sessions=#00d9ff, mcp=#34d399, commands=#f472b6, context=#f28c52, project-context=#60a5fa)
- `sectionIds`: fixed order array -- `['changes', 'context', 'brain', 'features', 'agent-context', 'project-context', 'rules', 'agents', 'skills', 'commands', 'mcp', 'hooks', 'sessions']`

### Sections (13 total, 1 hidden)
| # | ID | Title | Content Panel | Badge Source |
|---|-----|-------|---------------|-------------|
| 0 | changes | Changes | ChangesPanel | modifiedFiles.size |
| 1 | context | File Explorer | FileExplorer | -- |
| 2 | brain | Brain | FileExplorer (rooted at documentation/) | .md + .mmd file count |
| 3 | features | Features | FeaturesPanel | -- |
| 4 | agent-context | Agent Personality | AgentContextPanel | -- |
| 5 | project-context | Context | ProjectContextPanel | -- |
| 6 | rules | Agent Rules | RulesPanel | rulesCount (project + global) |
| 7 | agents | Droids | AgentsPanel | agents.length |
| 8 | skills | Skills | SkillsPanel | skills.length |
| 9 | commands | Commands | CommandsPanel | commandsCount (hidden) |
| 10 | mcp | MCP Servers | MCPPanel | mcpCount |
| 11 | hooks | Hooks | HooksPanel | hooks.filter(enabled).length |
| 12 | sessions | Sessions | SessionsPanel | -- |

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
