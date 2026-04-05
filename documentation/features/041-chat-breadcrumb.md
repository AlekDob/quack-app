---
type: feature-doc
project: quack-app
stack: React 18 + TypeScript strict + CSS liquid glass
created: 2026-04-05
last_verified: 2026-04-05
tags: [chat, breadcrumb, ux, navigation, liquid-glass]
---

## Chat Breadcrumb
**Purpose:** Liquid glass breadcrumb at the top of the chat area showing current project name and git branch. Solves the UX issue where users can't tell which chat/project they're in at a glance.
**Stack:** React 18 + TypeScript strict + CSS (backdrop-filter liquid glass)
**Origin:** Community feedback (Marco P.) — sidebar glow effect insufficient for orientation.

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/ChatView.tsx` | Inline breadcrumb div between banners and MessageList. Uses existing `projectName` and `gitBranch` props. |
| Style | `src/components/ChatView.css` | `.chat-breadcrumb`, `.chat-breadcrumb-project`, `.chat-breadcrumb-sep`, `.chat-breadcrumb-branch` — liquid glass styling |

### Data Flow
```
[App.tsx projectName/gitBranch state] → [ChatView props] → [.chat-breadcrumb div] → renders "projectName / branch"
```

### Key Behaviors
- Shows `projectName / gitBranch` when both available
- Falls back to only `projectName` when no branch (no git repo)
- Hidden entirely when no project name (empty state)
- Branch updates reactively (same source as stream chat branch indicator)
- Non-interactive, `user-select: none`

### Visual Style
- Liquid glass: `background: rgba(255,255,255,0.03)`, `backdrop-filter: blur(12px)`
- Project name at 50% white opacity, branch at 35%, separator at 15%
- Branch in monospace font (`SF Mono` / `Fira Code` / `JetBrains Mono`)
- `border-bottom: 1px solid rgba(255,255,255,0.04)` — barely visible separator
- 11px font size, 500 weight, 0.3px letter spacing
