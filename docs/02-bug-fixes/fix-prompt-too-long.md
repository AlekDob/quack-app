# Fix: "Prompt is too long" Error

## Problem

When using complex agents (like Carmelo Prompt Engineer) with large CLAUDE.md files, the Claude Agent SDK throws:

```
Error: Node.js SDK script failed with status: exit status: 1
Stderr output: [Auth] Claude Code OAuth found at /Users/alekdob/.claude.json
[DEBUG] Model mapping: "opus" → "claude-opus-4-5-20251101"
Prompt is too long
```

This happens because the SDK automatically loads context from multiple sources:
- `project`: Project CLAUDE.md
- `user`: User global CLAUDE.md (`~/.claude/CLAUDE.md`)
- `local`: Local directory settings

## Root Cause

The `settingSources` parameter in `stream-claude.js` was set to `['project', 'user', 'local']`, which loads ALL available context files. For large projects with detailed CLAUDE.md files, this exceeds the model's context window.

## Solutions

We implemented **3 levels of control** to prevent this error:

### ✅ Solution 1: Reduced Default (Active)

**File**: `src-tauri/node-sdk/stream-claude.js`
**Change**: Line 214 - Default `settingSources` changed from `['project', 'user', 'local']` to `['project']`

```javascript
const options = {
  model: modelId,
  // NOTE: Limited to 'project' only to avoid "Prompt is too long" errors
  settingSources: settingSources !== undefined ? settingSources : ['project'],
};
```

**Impact**: Automatically reduces context loading for all agents by default.

### ✅ Solution 2: Configurable Parameter

**Files Modified**:
- `src-tauri/node-sdk/stream-claude.js` (lines 44, 216)
- `src-tauri/src/claude_cli.rs` (lines 129, 773, 870-877)

**Usage**: Pass `settingSources` as optional parameter in `ClaudeCliRequest`:

```rust
pub struct ClaudeCliRequest {
    // ... other fields
    pub setting_sources: Option<Vec<String>>,
}
```

**Example** (from frontend TypeScript):
```typescript
const request = {
  prompt: "Your prompt here",
  model: "opus",
  settingSources: ["project"], // Only load project CLAUDE.md
};

// Or disable all automatic loading:
const minimalRequest = {
  prompt: "Your prompt here",
  model: "opus",
  settingSources: [], // No automatic context loading
};
```

### ✅ Solution 3: Complete Disabling

**When to use**: For agents that already receive extensive context (like Carmelo, who processes other agents' prompts)

**Usage**:
```typescript
const request = {
  prompt: complexPromptWithContext,
  model: "opus",
  settingSources: [], // Disable ALL automatic context loading
};
```

## Configuration Options

| Value | Context Loaded | When to Use |
|-------|---------------|-------------|
| `[]` | None | Complex agents with pre-filled context |
| `["project"]` | Project CLAUDE.md only | **Default** - Most agents |
| `["project", "user"]` | Project + User global | When user preferences needed |
| `["project", "user", "local"]` | All contexts | **Avoid** - Can cause "Prompt too long" |

## Implementation Details

### Backend (Rust)

Added `setting_sources` field to `ClaudeCliRequest` struct:

```rust
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCliRequest {
    // ... existing fields
    pub setting_sources: Option<Vec<String>>,
}
```

Pass to Node.js SDK in `send_message_via_sdk_streaming`:

```rust
// Add settingSources if provided (to control prompt length)
if let Some(sources) = setting_sources {
    config["settingSources"] = serde_json::Value::Array(
        sources.iter().map(|s| serde_json::Value::String(s.clone())).collect()
    );
    log::info!("[SDK DEBUG] Adding settingSources to config: {:?}", sources);
}
```

### Node.js SDK Script

Modified `stream-claude.js` to accept and use `settingSources`:

```javascript
const {
  prompt,
  model = 'sonnet',
  // ... other fields
  settingSources, // NEW: Optional control
} = config;

const options = {
  model: modelId,
  // Use provided settingSources or default to ['project'] only
  settingSources: settingSources !== undefined ? settingSources : ['project'],
};
```

## Testing

### Test Case 1: Default Behavior
```bash
# Should use ['project'] only
npm run tauri:dev
# Send message with any agent
# Verify in logs: "[SDK DEBUG] Using default settingSources: ['project']"
```

### Test Case 2: Custom settingSources
```typescript
// In your Claude chat component
const request = {
  prompt: "Test prompt",
  model: "sonnet",
  settingSources: [], // Empty array
};
// Verify in logs: "[SDK DEBUG] Adding settingSources to config: []"
```

### Test Case 3: Carmelo with Complex Context
```typescript
const carmeloRequest = {
  prompt: longPromptWithMultipleAgents,
  model: "opus",
  settingSources: [], // Disable auto-loading
};
// Should NOT throw "Prompt is too long"
```

## Verification

After implementing these changes:

1. **Check logs** for `settingSources` configuration:
   ```
   [SDK DEBUG] Using default settingSources: ['project']
   ```

2. **No more "Prompt is too long" errors** when using complex agents

3. **Reduced token usage** (visible in cost tracking)

## Related Files

- `src-tauri/node-sdk/stream-claude.js` - Node.js SDK script
- `src-tauri/src/claude_cli.rs` - Rust backend command handler
- `src/types.ts` - TypeScript type definitions (TODO: add `settingSources` field)

## Future Improvements

- [ ] Add `settingSources` to TypeScript `ClaudeCliRequest` interface in `src/types.ts`
- [ ] Expose UI toggle in Settings to control default `settingSources`
- [ ] Add agent-specific `settingSources` configuration in Agent Personalities
- [ ] Implement smart context window detection (auto-reduce when approaching limit)

## Date

2025-01-16

## Status

✅ Fixed and Implemented
