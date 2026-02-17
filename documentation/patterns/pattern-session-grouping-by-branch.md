---
type: pattern
created: 2025-02-11
tags: [ui, sessions, branch, sidebar, grouping]
---

# Pattern: Session Grouping by Branch in Agent List

## Context

With branch-per-session support, an agent can have sessions on different branches simultaneously. The sidebar needs to visualize this without confusion.

## Solution: Sub-header Branch

Sessions under each agent are grouped by branch with a mini-header:

```
Agent Graydon
  branch main (3)
    - Ciao                  8s ago
    - Grouping projects     4m ago
  branch hotfix/crash (1)
    - Fix critical bug      2h ago
  branch feature/x (1)
    - New UI component      1d ago
```

## Implementation (AgentSessionList.tsx)

Group sessions by branch (`session.branch || agentBranch || 'main'`), render branch sub-headers with count.

## Badge Branch Individuale

The orange badge on `AgentSessionItem` now appears only when the session has an explicit branch different from the agent's branch. This avoids redundancy.

## Design Rationale

1. Clear visual hierarchy: Agent > Branch > Sessions
2. Sub-header at 9px, white/40%, JetBrains Mono
3. Padding-left 20px aligns to metro line
4. Count shown as `(N)` at 8px, white/20%

## Files

- `src/components/AgentSessionList.tsx` -- grouping logic and sub-header rendering
- `src/components/AgentSessionItem.tsx` -- conditional branch badge
