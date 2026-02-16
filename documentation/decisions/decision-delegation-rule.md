---
type: decision
created: 2026-02-11
tags: [delegation, teams, subagents, coordination, workflow]
---

# Delegation Decision Rule for Agent Coordination

## Context

Agents were doing everything themselves instead of delegating to team members or subagents, even when the task would benefit from parallel work. The Project Manager agent completed a 6-file bug fix solo instead of delegating implementation to the developer agent and documentation to the docs agent.

## Problem

No structured enforcement existed to make agents evaluate delegation before acting. The existing rule in Quack rules said "delegate as much as possible" but this was a suggestion, not a checkpoint.

## Decision

Added a structured 3-level decision tree with a mandatory checkpoint:

1. **Agent Team** - For multi-domain, parallel, non-overlapping work (>15 min per subtask)
2. **Subagent/Droid** - For focused, single-domain tasks where only the result matters
3. **Single Agent** - For small (<= 3 file) interconnected fixes

Before implementing, agents must declare: level chosen, why, and who does what.

## Source

- Claude Agent SDK docs on agent teams (code.claude.com/docs/en/agent-teams)
- Practical experience: agent teams add significant coordination overhead and token cost
- Official guidance: "For sequential tasks, same-file edits, or work with many dependencies, a single session or subagents are more effective"

## Implementation

- Added to global Quack rules (`~/.claude/rules/Quack rules.md`)
- Published as marketplace plugin (`delegation-rule`)
- Documented in user guide (`docs/guide/02-core-concepts/delegation-rule.md`)
