---
type: pattern
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

Shown on every assistant message when a team is active. Uses `useTeamStore` to get the active team. Mini avatars (16x16, overlap -4px) show all team members.

### 2. TeamMemberMiniAvatar (StreamMessage.tsx)

Tiny avatar circle for the badge. Uses `useAgentAvatar` hook (NOT `useAgentInfo`).

### 3. TeammateWidget (TeammateWidget.tsx)

Inline widget shown when a Task tool event matches a team member name.

## Detection Logic (StreamMessage.tsx)

When rendering a `Task` tool use, the system checks if the task name matches a team member. If match found, renders TeammateWidget instead of default tool widget.

## Critical: useAgentAvatar vs useAgentInfo

**DO NOT use `useAgentInfo`** for team member avatars. It's designed for droids (`.claude/agents/` YAML files) and returns duckdroid default when no match.

**USE `useAgentAvatar`** instead — works with both default avatars and custom avatars (UUID format).

## Frontend Enrichment Pattern

TeamMember from Rust has no avatar/color. These are enriched at frontend in `teamStore.ts` after Rust returns team data.

See `decisions/decision-team-avatar-enrichment-frontend-only.md` for rationale.

## Files Involved

| File | Purpose |
|------|---------|
| `StreamMessage.tsx` | TeamModeBadge, TeamMemberMiniAvatar, Task to TeammateWidget matching |
| `TeammateWidget.tsx` | Standalone teammate activity widget |
| `ToolWidgets.css` | Badge and widget styling |
| `teamStore.ts` | Active team state + enrichment |
| `types.ts` | TeamMember with optional avatar/color |
