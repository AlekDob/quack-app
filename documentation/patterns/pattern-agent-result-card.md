---
type: pattern
project: quack-app
created: 2026-03-22
last_verified: 2026-03-24
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

## Nested Tool Indentation

When the orchestrator runs tools (Read, Grep, etc.) while a subagent is active, those tools appear indented with a purple sidebar to distinguish them from the subagent's work.

**Critical**: the SDK does NOT stream subagent tool calls to the parent. Any Read/Grep visible in the UI during an Agent tool execution belong to the **orchestrator**, never the subagent.

### Implementation

In `ChatMessage.tsx`, `nestedEventIndices` is a `Map<number, string>` (event index → subagentType) computed by scanning events:
1. Track `pendingAgentTools` (`Map<string, string>`) — toolUseId → subagentType for Agent/Task tools
2. Clear when matching `tool_result` arrives in a user event
3. Assistant events between tool_use and tool_result (that don't contain the Agent tool itself) are marked nested with the active droid's subagentType

`StreamMessage` receives `isNestedUnderAgent` + `nestedDroidType` props:
- `.nested-under-agent` CSS class applies indentation + purple bar
- When `nestedDroidType` is set, `useAgentInfo(nestedDroidType)` loads the droid's avatar and color; the name is formatted from kebab-case (e.g. `git-commit-manager` → "Git Commit Manager")

### Key Files (nesting)

| File | Role |
|------|------|
| `src/components/ChatMessage.tsx` | nestedEventIndices Map computation + droidType prop passing |
| `src/components/StreamMessage.tsx` | isNestedUnderAgent + nestedDroidType props, useAgentInfo for droid avatar/name |
| `src/components/StreamMessage.css` | .nested-under-agent styles |
| `src/hooks/useAgentInfo.ts` | Fetches droid avatar/color from Tauri agent registry |

## DroidActivityBlock Merging

When the orchestrator calls the same subagent type multiple times consecutively (e.g. `Agent(Explore)` x5), each invocation produces its own `[nested tools] + [agent result]` pair. Without merging, each gets its own `DroidActivityBlock` with a repeated avatar.

### Problem

After the reorder step, the sequence looks like:
```
nested tools (Explore)   → droidType = "Explore"
agent result #1          → droidType = undefined (has agent tool)
nested tools (Explore)   → droidType = "Explore"
agent result #2          → droidType = undefined
```

The agent-result groups (which have no `droidType`) break the consecutive chain, creating separate blocks.

### Solution

`getAgentToolDroidType()` helper extracts `subagent_type` from agent-result groups. The render loop absorbs agent-result groups of the same droid into the merged block:

```typescript
// In the collect loop, absorb agent results + intermediate non-droid groups:
if (gDroid === droidType) {
  droidTools.push(g);          // nested tool group
} else if (groupHasAgentTool(g) && getAgentToolDroidType(g) === droidType) {
  droidAgentResults.push(g);   // agent result for same droid
} else if (!gDroid && !groupHasAgentTool(g)) {
  // Lookahead: check if same droid reappears within next 3 groups
  // If yes, absorb intermediate group into the block
  // Brain: fix-droid-avatar-repeated
  if (hasMoreSameDroid) { droidIntermediate.push(g); }
  else { break; }
} else {
  break;                       // different droid or non-nested → stop
}
```

Tools render first, then intermediate groups, then agent results (AgentResultCards) at the end of the block.

### Collapsible Behavior

`DroidActivityBlock` is collapsible: expanded by default, with a chevron toggle. When collapsed, shows a "N tools" count badge. Uses `Children.count()` for the count.

### Key Files (merging)

| File | Role |
|------|------|
| `src/components/ChatMessage.tsx` | `getAgentToolDroidType()` + merge loop |
| `src/components/DroidActivityBlock.tsx` | Collapsible wrapper with chevron |
| `src/components/StreamMessage.css` | `.droid-activity-header`, `.droid-activity-chevron`, `.droid-activity-count` |

## Gotchas

- The `task` tool handler checks for team members FIRST — `TeammateWidget` takes priority
- `toolName` is lowercased at line 496 of StreamMessage.tsx — always compare with lowercase
- Metadata block detection uses `text.includes('<usage>')` — if SDK changes the format, parsing silently falls back to no metadata (safe degradation)
- `agent` must be in `SPECIAL_WIDGET_TOOLS` — without it, the Agent tool gets grouped with other tools instead of having its own row
- Subagent tools are invisible to the parent stream — only start/stop events and final result are visible
- Merging now uses **lookahead** (max 3 groups ahead) to absorb intermediate non-droid events between runs of the same droid. Breaks only on a DIFFERENT droid type.
- CSS `.droid-activity-content > .stream-message` has compact 2px margin for tighter tool list inside droid blocks
