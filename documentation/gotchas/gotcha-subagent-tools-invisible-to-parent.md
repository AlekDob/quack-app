---
type: gotcha
project: quack-app
created: 2026-03-22
last_verified: 2026-03-22
tags: [sdk, agent, subagent, tools, streaming, ui]
---
# Gotcha: Subagent tools are invisible to the parent stream

## Trigger

When rendering tool calls during a subagent (Agent/Task tool) execution and trying to understand which tools belong to whom.

## Problem

The Claude Agent SDK does NOT stream a subagent's individual tool calls (Read, Grep, Write, etc.) to the parent orchestrator. The parent only receives:

1. `agent` event with `action: 'start'` — subagent started
2. `agent` event with `action: 'stop'` — subagent stopped
3. `tool_result` — the final result (markdown + metadata)

Any Read/Grep/Write tool calls visible in the UI **during** an Agent tool execution belong to the **orchestrator**, not the subagent. The subagent runs in its own process and its tools are completely opaque to the parent.

## Why it matters

Without visual distinction, users assume the Read/Grep calls shown under the Agent widget belong to the subagent. This causes confusion about who is doing what. The nested tool indentation feature (purple sidebar via `.nested-under-agent` CSS class) was added specifically to address this.

## Solution

- `ChatMessage.tsx` computes `nestedEventIndices` to detect orchestrator tools running while a subagent is pending
- `StreamMessage` applies `.nested-under-agent` class to indent these tools with a purple sidebar
- See `documentation/patterns/pattern-agent-result-card.md` for full implementation details
