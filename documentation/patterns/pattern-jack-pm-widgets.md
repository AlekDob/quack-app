---
type: pattern
project: quack-app
created: 2026-05-27
last_verified: 2026-05-27
tags: [widget, markdown, inline, jack, pm-tools]
---

# Jack PM Widgets — Inline Visual Tools via Markdown Code Blocks

## Problem

Jack (supervisor meta-agent) needs to render structured visual tools (workstream board, task suggestions, agent grid, daily briefing) inline in the chat stream — not as separate dashboard tabs, not as plain text lists, but as interactive visual widgets contextual to the conversation.

## Solution

Use fenced code blocks with special language tags as widget manifests. `MarkdownText` intercepts code blocks and renders React components instead of code when the language matches a known widget.

```markdown
```ws-board
{ workstreams: [...] }
```
```

`MarkdownText.flushCodeBlock()` checks `codeBlockLang` and renders:
- `ws-board` → `<WorkstreamBoard data={JSON.parse(codeContent)} />`
- `task-suggest` → `<TaskSuggester>`
- `agent-grid` → `<AgentActivityGrid>`
- `briefing` → `<DailyBriefing>`

## Why code blocks

- **Semantic:** language tag = widget type, content = JSON data
- **Progressive enhancement:** Jack generates JSON in a code block; if the renderer isn't loaded, it's still readable as text
- **No new protocol:** reuses existing markdown rendering infrastructure
- **Lazy loading:** widgets are `lazy(() => import('./jack/widgets/...'))` — zero JS cost until used

## Widget anatomy

Each widget:
1. `widgets/types.ts` — shared types + color constants
2. `widgets/WidgetName.tsx` — React component receiving typed data
3. `widgets/JackWidgets.css` — shared `.jack-widget` shell + per-widget `.ws-board-*`, `.task-suggest-*`, etc.

## Hook for real data

A future `useJackPMData()` hook should feed real data:
- Workstreams → read `documentation/workstreams/INDEX.md` via Tauri invoke
- Agents → from `jackStore.agents` (already populated by `useJackAgentRefresh`)
- Task suggestions → generated from analysis of workstream gaps + idle agents
- Briefing → aggregated from recent diary entries + active workstreams

## Adding a new widget

1. Add type to `widgets/types.ts`
2. Create `widgets/NewWidget.tsx` — component accepting typed data
3. Add styles to `JackWidgets.css`
4. Add lazy import to `MarkdownText.tsx`
5. Add branch to `flushCodeBlock()` switch

## Related

- Feature: `073-jack-supervisor-window.md` (PM Widgets section)
- Workstream: `07-jack-supervisor-agent.md`
- Component: `src/components/MarkdownText.tsx` (flushCodeBlock switch)