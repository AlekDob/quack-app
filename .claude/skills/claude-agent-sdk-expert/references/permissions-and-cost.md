# Permissions and Cost Tracking

## SDK Permissions

The Claude Agent SDK provides powerful permission controls that allow you to manage how Claude uses tools in your application.

### Four Ways to Control Tool Usage

1. **Permission Modes** - Global permission behavior settings
2. **canUseTool callback** - Runtime permission handler
3. **Hooks** - Fine-grained control over every tool execution
4. **Permission rules (settings.json)** - Declarative allow/deny rules

### Permission Flow

**Processing Order**: PreToolUse Hook → Deny Rules → Allow Rules → Ask Rules → Permission Mode Check → canUseTool Callback → PostToolUse Hook

## Permission Modes

Permission modes provide global control over how Claude uses tools.

### Available Modes

| Mode | Description | Tool Behavior |
|------|-------------|---------------|
| `default` | Standard permission behavior | Normal permission checks apply |
| `plan` | Planning mode - no execution | Claude can only use read-only tools (Not currently supported in SDK) |
| `acceptEdits` | Auto-accept file edits | File edits and filesystem operations are automatically approved |
| `bypassPermissions` | Bypass all permission checks | All tools run without permission prompts (use with caution) |

### Setting Permission Mode

#### Initial Configuration

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const result = await query({
  prompt: "Help me refactor this code",
  options: {
    permissionMode: 'default'  // Standard permission mode
  }
});
```

#### Dynamic Mode Changes (Streaming Only)

```typescript
async function* streamInput() {
  yield {
    type: 'user',
    message: {
      role: 'user',
      content: "Let's start with default permissions"
    }
  };

  yield {
    type: 'user',
    message: {
      role: 'user',
      content: "Now let's speed up development"
    }
  };
}

const q = query({
  prompt: streamInput(),
  options: {
    permissionMode: 'default'
  }
});

// Change mode dynamically
await q.setPermissionMode('acceptEdits');

for await (const message of q) {
  console.log(message);
}
```

### Mode-Specific Behaviors

#### Accept Edits Mode (`acceptEdits`)

In accept edits mode:
- All file edits are automatically approved
- Filesystem operations (mkdir, touch, rm, mv, cp) are auto-approved
- Other tools still require normal permissions
- Speeds up development when you trust Claude's edits

Auto-approved operations:
- File edits (Edit, Write tools)
- Bash filesystem commands (mkdir, touch, rm, mv, cp)
- File creation and deletion

#### Bypass Permissions Mode (`bypassPermissions`)

In bypass permissions mode:
- **ALL tool uses are automatically approved**
- No permission prompts appear
- Hooks still execute (can still block operations)
- **Use with extreme caution** - Claude has full system access
- Recommended only for controlled environments

### Mode Priority in Permission Flow

1. **Hooks execute first** - Can allow, deny, ask, or continue
2. **Deny rules** are checked - Block tools regardless of mode
3. **Allow rules** are checked - Permit tools if matched
4. **Ask rules** are checked - Prompt for permission if matched
5. **Permission mode** is evaluated:
   - **`bypassPermissions` mode** - Allows all remaining tools
   - **Other modes** - Defer to `canUseTool` callback
6. **`canUseTool` callback** - Handles remaining cases

This means:
- Hooks can always control tool use, even in `bypassPermissions` mode
- Explicit deny rules override all permission modes
- Ask rules are evaluated before permission modes
- `bypassPermissions` mode overrides the `canUseTool` callback

### Best Practices

1. **Use default mode** for controlled execution
2. **Use acceptEdits mode** when working on isolated files or directories
3. **Avoid bypassPermissions** in production or on systems with sensitive data
4. **Combine modes with hooks** for fine-grained control
5. **Switch modes dynamically** based on task progress

Example progression:
```typescript
// Start in default mode
permissionMode: 'default'

// Switch to acceptEdits for rapid iteration
await q.setPermissionMode('acceptEdits')
```

## canUseTool Callback

The `canUseTool` callback fires whenever Claude Code would show a permission prompt - when hooks and permission rules don't cover it and it's not in acceptEdits mode.

### Implementation Example

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

async function promptForToolApproval(toolName: string, input: any) {
  console.log("\n🔧 Tool Request:");
  console.log(`   Tool: ${toolName}`);

  if (input && Object.keys(input).length > 0) {
    console.log("   Parameters:");
    for (const [key, value] of Object.entries(input)) {
      let displayValue = value;
      if (typeof value === 'string' && value.length > 100) {
        displayValue = value.substring(0, 100) + "...";
      } else if (typeof value === 'object') {
        displayValue = JSON.stringify(value, null, 2);
      }
      console.log(`     ${key}: ${displayValue}`);
    }
  }

  const approved = await getUserApproval();

  if (approved) {
    console.log("   ✅ Approved\n");
    return {
      behavior: "allow",
      updatedInput: input
    };
  } else {
    console.log("   ❌ Denied\n");
    return {
      behavior: "deny",
      message: "User denied permission for this tool"
    };
  }
}

const result = await query({
  prompt: "Help me analyze this codebase",
  options: {
    canUseTool: async (toolName, input) => {
      return promptForToolApproval(toolName, input);
    }
  }
});
```

---

## Cost Tracking

The Claude Agent SDK provides detailed token usage information for each interaction with Claude.

### Understanding Token Usage

#### Key Concepts

1. **Steps**: A single request/response pair between your application and Claude
2. **Messages**: Individual messages within a step
3. **Usage**: Token consumption data attached to assistant messages

### Usage Reporting Structure

#### Single vs Parallel Tool Use

When Claude executes tools, usage reporting differs based on execution mode:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const result = await query({
  prompt: "Analyze this codebase and run tests",
  options: {
    onMessage: (message) => {
      if (message.type === 'assistant' && message.usage) {
        console.log(`Message ID: ${message.id}`);
        console.log(`Usage:`, message.usage);
      }
    }
  }
});
```

#### Message Flow Example

```
<!-- Step 1: Initial request with parallel tool uses -->
assistant (text)      { id: "msg_1", usage: { output_tokens: 100, ... } }
assistant (tool_use)  { id: "msg_1", usage: { output_tokens: 100, ... } }
assistant (tool_use)  { id: "msg_1", usage: { output_tokens: 100, ... } }
user (tool_result)
user (tool_result)

<!-- Step 2: Follow-up response -->
assistant (text)      { id: "msg_2", usage: { output_tokens: 98, ... } }
```

### Important Usage Rules

#### 1. Same ID = Same Usage

**All messages with the same `id` field report identical usage**. When Claude sends multiple messages in the same turn, they share the same message ID and usage data.

```typescript
const messages = [
  { type: 'assistant', id: 'msg_123', usage: { output_tokens: 100 } },
  { type: 'assistant', id: 'msg_123', usage: { output_tokens: 100 } },
  { type: 'assistant', id: 'msg_123', usage: { output_tokens: 100 } }
];

// Charge only once per unique message ID
const uniqueUsage = messages[0].usage;
```

#### 2. Charge Once Per Step

**You should only charge users once per step**, not for each individual message. When you see multiple assistant messages with the same ID, use the usage from any one of them.

#### 3. Result Message Contains Cumulative Usage

The final `result` message contains the total cumulative usage from all steps:

```typescript
const result = await query({
  prompt: "Multi-step task",
  options: { /* ... */ }
});

console.log("Total usage:", result.usage);
console.log("Total cost:", result.usage.total_cost_usd);
```

### Implementation: Cost Tracking System

```typescript
class CostTracker {
  private processedMessageIds = new Set<string>();
  private stepUsages: Array<any> = [];

  async trackConversation(prompt: string) {
    const result = await query({
      prompt,
      options: {
        onMessage: (message) => {
          this.processMessage(message);
        }
      }
    });

    return {
      result,
      stepUsages: this.stepUsages,
      totalCost: result.usage?.total_cost_usd || 0
    };
  }

  private processMessage(message: any) {
    if (message.type !== 'assistant' || !message.usage) {
      return;
    }

    // Skip if already processed
    if (this.processedMessageIds.has(message.id)) {
      return;
    }

    this.processedMessageIds.add(message.id);
    this.stepUsages.push({
      messageId: message.id,
      timestamp: new Date().toISOString(),
      usage: message.usage,
      costUSD: this.calculateCost(message.usage)
    });
  }

  private calculateCost(usage: any): number {
    const inputCost = usage.input_tokens * 0.00003;
    const outputCost = usage.output_tokens * 0.00015;
    const cacheReadCost = (usage.cache_read_input_tokens || 0) * 0.0000075;

    return inputCost + outputCost + cacheReadCost;
  }
}

// Usage
const tracker = new CostTracker();
const { result, stepUsages, totalCost } = await tracker.trackConversation(
  "Analyze and refactor this code"
);

console.log(`Steps processed: ${stepUsages.length}`);
console.log(`Total cost: $${totalCost.toFixed(4)}`);
```

### Handling Edge Cases

#### Output Token Discrepancies

In rare cases, you might observe different `output_tokens` values for messages with the same ID. When this occurs:
1. **Use the highest value** - The final message typically contains the accurate total
2. **Verify against total cost** - The `total_cost_usd` in the result message is authoritative
3. **Report inconsistencies** - File issues on GitHub

#### Cache Token Tracking

When using prompt caching, track these token types separately:

```typescript
interface CacheUsage {
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  cache_creation: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  };
}
```

### Best Practices

1. **Use Message IDs for Deduplication**: Always track processed message IDs to avoid double-charging
2. **Monitor the Result Message**: The final result contains authoritative cumulative usage
3. **Implement Logging**: Log all usage data for auditing and debugging
4. **Handle Failures Gracefully**: Track partial usage even if a conversation fails
5. **Consider Streaming**: For streaming responses, accumulate usage as messages arrive

### Usage Fields Reference

Each usage object contains:
- `input_tokens`: Base input tokens processed
- `output_tokens`: Tokens generated in the response
- `cache_creation_input_tokens`: Tokens used to create cache entries
- `cache_read_input_tokens`: Tokens read from cache
- `service_tier`: The service tier used (e.g., "standard")
- `total_cost_usd`: Total cost in USD (only in result message)

### Building a Billing Dashboard

```typescript
class BillingAggregator {
  private userUsage = new Map<string, {
    totalTokens: number;
    totalCost: number;
    conversations: number;
  }>();

  async processUserRequest(userId: string, prompt: string) {
    const tracker = new CostTracker();
    const { result, stepUsages, totalCost } = await tracker.trackConversation(prompt);

    const current = this.userUsage.get(userId) || {
      totalTokens: 0,
      totalCost: 0,
      conversations: 0
    };

    const totalTokens = stepUsages.reduce((sum, step) =>
      sum + step.usage.input_tokens + step.usage.output_tokens, 0
    );

    this.userUsage.set(userId, {
      totalTokens: current.totalTokens + totalTokens,
      totalCost: current.totalCost + totalCost,
      conversations: current.conversations + 1
    });

    return result;
  }

  getUserBilling(userId: string) {
    return this.userUsage.get(userId) || {
      totalTokens: 0,
      totalCost: 0,
      conversations: 0
    };
  }
}
```
