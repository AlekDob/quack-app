---
type: pattern
project: quack-app
created: 2026-04-03
last_verified: 2026-04-06
tags: [team, delegation, remote-api, mention, projectTerminals, agents]
---
# Pattern: Team Delegation via @ Mention

## Context

Team delegation lets users dispatch tasks to project agents via `@` mentions in the chat input. Typing `@` shows sibling agents from the same project, each with their avatar. Selecting one inserts `@team delegate to <name>:` which triggers the content enrichment in App.tsx.

This replaced the old team icon button + generic `@team` entry (removed 2026-04-06).

## Two Delegation Patterns

Quack has two distinct delegation modes, both using `POST /api/execute`:

| Mode | Trigger | `leadSessionId` | Auto-done | Notification |
|------|---------|-----------------|-----------|-------------|
| **Direct** | `quack-remote` skill / user prompt | NOT set | No | No |
| **Managed** | `@team` mention (this pattern) | SET | Yes | Yes |

The **only programmatic difference** is whether `leadSessionId` is populated. Title prefixes (`[Team]` vs `[Remote]`) are cosmetic.

## Architecture

### Data Source: projectTerminals

The mention popup's "Team" section sources agents from the sidebar terminals. The flow:

```
App.tsx state: terminals[] (all active agents)
  ↓ filter: same cwd as activeTerminal, exclude self
  ↓
projectTerminals prop → ChatView → ChatInput
  ↓
filteredTeammates (useMemo, filtered by @mention text)
  ↓
Team section in mention popup (AgentAvatar + label + workingOn)
```

This means: **every agent visible in the sidebar under the same project is citeable via `@`**.

### Components

| File | Role |
|------|------|
| `src/App.tsx` | Filters `terminals` by cwd → `projectTerminals` prop; `@team` content enrichment |
| `src/components/ChatView.tsx` | Passes `projectTerminals` prop through to ChatInput |
| `src/components/ChatInput.tsx` | `filteredTeammates`, `selectTeammate()`, Team section JSX, teammate mention chips |
| `src/components/AgentAvatar.tsx` | Reused for teammate avatars in popup (DRY) |
| `src/services/remoteApi.ts` | `notifyLeadAgent()`, `executeRemoteTask()`, `fetchRemoteAgents()` |

### Mention Popup Order

1. **Team** — project terminals (same cwd, exclude self)
2. **Skills** — from `loadAvailableSkills(basePath)`
3. **Droids** — from `agents` prop (AgentInfo[] from list_agents)
4. **Features** — from `useFeatureMapData(basePath)`
5. **Files** — from `search_files_recursive` (debounced)

### Key Implementation Details

- **Teammate filtering**: `projectTerminals.filter(t => t.label.includes(filter) || 'team'.includes(filter))`
- **selectTeammate(name)**: inserts `@team delegate to <name>: ` at cursor — triggers existing `@team` content enrichment
- **Mention chip**: regex `/@team\s+delegate\s+to\s+([\w\s-]+?):/gi` extracts teammate names → renders orange-branded chip with AgentAvatar
- **Index chain**: keyboard nav offsets: `filteredTeammates.length + filteredSkills.length + filteredAgents.length + ...`
- **No store dependency**: uses `projectTerminals` prop from App.tsx, not any Zustand store

### CSS Classes

| Class | Purpose |
|-------|---------|
| `.team-member-item` | Mention popup row for teammates |
| `.team-member-item .agent-autocomplete-name` | Orange (#FF6B35) name color |
| `.agent-autocomplete-avatar` | 24px round avatar (shared with droids) |
| `.chat-input-team-chip` | Input mention chip (orange background/border) |
| `.chat-input-team-chip .chat-input-mention-name` | Orange (#FF6B35) chip text |

## Notification Format

```
[Team Complete] Agent {agentId} ha completato il task assegnato.

Task: {taskSummary}
Status: Completato
```

## When to Use This Pattern

- Adding new delegation targets (MCP servers, external agents)
- Modifying the auto-done/notification flow
- Adding new mention types to the popup (same index chain pattern)
- Building teammate-aware UI (use `projectTerminals` prop, not store)
