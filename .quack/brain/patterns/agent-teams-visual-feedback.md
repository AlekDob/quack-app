---
type: pattern
project: quack-app
created: 2026-02-06
tags: [agent-teams, chat-stream, avatar, ui, teammate-widget]
---

# Pattern: Agent Teams Visual Feedback in Chat Stream

## Context

When Agent Teams is active, the Team Lead spawns teammates via `Task` tool (subagent). The user needs visual feedback in the chat stream showing:
1. Which team is active (badge on every message)
2. When a teammate starts/stops working (inline widget)

## Components

### 1. TeamModeBadge (StreamMessage.tsx)

Shown on every assistant message when a team is active:

```tsx
function TeamModeBadge({ team }: { team: TeamConfig }) {
  return (
    <span className="team-mode-badge">
      <span className="team-mode-badge-avatars">
        {team.members.map(m => (
          <TeamMemberMiniAvatar key={m.agentId} name={m.name} avatar={m.avatar} />
        ))}
      </span>
      {team.name}
    </span>
  );
}
```

Uses `useTeamStore` to get the active team. Mini avatars (16x16, overlap -4px) show all team members.

### 2. TeamMemberMiniAvatar (StreamMessage.tsx)

Tiny avatar circle for the badge. Uses `useAgentAvatar` hook (NOT `useAgentInfo`):

```tsx
function TeamMemberMiniAvatar({ name, avatar }: { name: string; avatar?: string }) {
  const avatarUrl = useAgentAvatar(name, avatar);
  return <img src={avatarUrl} alt={name} title={name} style={{ width: 16, height: 16, ... }} />;
}
```

### 3. TeammateWidget (TeammateWidget.tsx)

Inline widget shown when a Task tool event matches a team member name:

```tsx
export function TeammateWidget({ name, role, agentId, action, avatar, color }: TeammateWidgetProps) {
  const avatarUrl = useAgentAvatar(name, avatar);
  // Renders: avatar + name + role + status indicator (pulse/spinner or completed)
}
```

## Detection Logic (StreamMessage.tsx)

When rendering a `Task` tool use, the system checks if the task name matches a team member:

```typescript
// Match task name against team member names
const matchedMember = activeTeam?.members.find(m =>
  taskName.toLowerCase().includes(m.name.toLowerCase())
);

if (matchedMember) {
  return <TeammateWidget
    name={matchedMember.name}
    role={matchedMember.role}
    avatar={matchedMember.avatar}
    color={matchedMember.color}
    action={isRunning ? 'start' : 'stop'}
  />;
}
```

## Critical: useAgentAvatar vs useAgentInfo

**DO NOT use `useAgentInfo`** for team member avatars. It's designed for droids (`.claude/agents/` YAML files):
- Normalizes ID to kebab-case
- Matches against `list_agents` Tauri command (droids only)
- Returns duckdroid default when no match → WRONG for unified agents

**USE `useAgentAvatar`** instead:
- Works with both default avatars (duck1.jpeg...) and custom avatars (UUID format)
- Proper URL resolution via `getAgentAvatar()` utility
- No droid-specific assumptions

## Frontend Enrichment Pattern

TeamMember from Rust has no avatar/color. These are enriched at frontend:

```typescript
// teamStore.ts — after Rust returns team data
if (agentAvatars) {
  for (const member of team.members) {
    const data = agentAvatars.get(member.agentId);
    if (data) {
      member.avatar = data.avatar;
      member.color = data.color;
    }
  }
}
```

See `decisions/decision-team-avatar-enrichment-frontend-only.md` for rationale.

## CSS (ToolWidgets.css)

```css
.team-mode-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px 2px 4px;
  border-radius: 12px;
  background: rgba(255, 107, 53, 0.12);
  border: 1px solid rgba(255, 107, 53, 0.25);
  font-size: 0.65rem;
  color: rgba(255, 107, 53, 0.85);
}

.team-mode-badge-avatars {
  display: flex;
  /* Overlap effect: each avatar except first shifts left */
}
.team-mode-badge-avatars img:not(:first-child) {
  margin-left: -4px;
}
```

## Files Involved

| File | Purpose |
|------|---------|
| `StreamMessage.tsx` | TeamModeBadge, TeamMemberMiniAvatar, Task→TeammateWidget matching |
| `TeammateWidget.tsx` | Standalone teammate activity widget |
| `ToolWidgets.css` | Badge and widget styling |
| `teamStore.ts` | Active team state + enrichment |
| `types.ts` | TeamMember with optional avatar/color |

## Related

- `decisions/decision-team-avatar-enrichment-frontend-only.md` — Why enrichment is frontend-only
- `patterns/pattern-claude-settings-env-vars-toggle.md` — Agent Teams toggle
- `patterns/agent-system.md` — Agent vs Droid distinction
