---
type: pattern
project: quack-app
created: 2026-03-22
last_verified: 2026-03-22
tags: [frontend, agent, droid, subagent, tool-result, rendering, markdown]
---
# Pattern: Agent Result Card

## Problem

The Claude Agent SDK (v0.2.81+) returns rich structured results from subagents/droids as an array `[{text, type}]`. The first block contains full markdown (tables, code blocks, headings) and the second block contains metadata (agentId, tokens, duration). Without a dedicated handler, these results fall through to `ToolMinimalStream` which does `JSON.stringify()` — producing unreadable raw JSON walls.

Two tool names trigger subagent results:
- `agent` — the SDK Agent tool (no special handler existed before)
- `task` — the legacy Task tool (had `TaskWidget` but never rendered the result content)

## Solution

`AgentResultCard` component (`src/components/AgentResultCard.tsx`) with dedicated CSS.

### Result Parsing

```typescript
// rawResult.content is an array of {text, type} blocks
// Block 1: markdown content (the actual report)
// Block 2: metadata with patterns:
//   agentId: <id>
//   <usage>total_tokens: N\ntool_uses: N\nduration_ms: N</usage>
```

The `parseAgentResult()` function handles:
- `rawResult.content` as array (standard SDK format)
- `rawResult.content` as string (legacy or plain text)
- `rawResult` itself as array (no wrapper)
- Fallback: treat everything as markdown, no metadata

### Integration in StreamMessage.tsx

```
renderToolContent() flow:
  toolName === 'task' && input.subagent_type
    → toolResult exists? → AgentResultCard (report)
    → no result?        → TaskWidget (spinner)

  toolName === 'agent'
    → toolResult exists? → AgentResultCard (report)
    → no result?        → TaskWidget (spinner)
```

TeammateWidget takes priority over both when the task matches a team member name.

### Component Structure

- **Header** (always visible): avatar + droid name + description + "Rapporto" badge + metadata pills (duration, tokens, tool uses) + expand/collapse chevron
- **Body** (collapsible): markdown rendered via `<MarkdownText>`
- Uses `useAgentInfo()` for avatar/color resolution
- Glassmorphism design consistent with TaskWidget

## Key Files

| File | Role |
|------|------|
| `src/components/AgentResultCard.tsx` | Component + parser |
| `src/components/AgentResultCard.css` | Glassmorphism card styles |
| `src/components/StreamMessage.tsx` | Integration point (renderToolContent) |
| `src/components/TaskWidget.tsx` | Loading state (spinner) |
| `src/hooks/useAgentInfo.ts` | Avatar + color resolution |

## Gotchas

- The `task` tool handler checks for team members FIRST — `TeammateWidget` takes priority
- `toolName` is lowercased at line 496 of StreamMessage.tsx — always compare with lowercase
- Metadata block detection uses `text.includes('<usage>')` — if SDK changes the format, parsing silently falls back to no metadata (safe degradation)
