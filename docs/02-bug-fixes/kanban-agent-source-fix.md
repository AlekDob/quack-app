# Kanban MCP Agent Source Fix

**Date:** 2026-01-02
**Type:** Improvement
**Status:** Implemented

## Problem

The `kanban_list_agents` MCP tool was only reading agents from `quack-terminals.json` (active terminals), not from the `.quack/agent-personalities/` folder where saved agent configurations are stored.

This meant:
- Only agents with active terminals were shown
- Agents that were configured but had no active terminal ("dormant" agents) were not visible
- Users could not assign tasks to agents they had previously created but weren't currently using

## Analysis

### Data Sources

1. **`quack-terminals.json`** (Tauri Store in `~/Library/Application Support/com.quack.terminal/`)
   - Contains active terminal sessions
   - Has full context: `cwd` (projectPath), `branch`, `workingOn`, `avatar`, `color`, `personality`
   - 19 agents typically active

2. **`.quack/agent-personalities/*.json`** (per-project folder)
   - Contains saved agent configurations
   - Has: `id`, `name`, `role`, `personality`, `skills`, etc.
   - Does NOT have: `projectPath`, `branch`, `workingOn`
   - 180+ agent personalities saved

### Root Cause

The `loadAvailableAgents()` function in `kanban-mcp-server.js:88-113` only read from `TERMINALS_STORE_PATH`:

```javascript
// OLD CODE - Only read from terminals
function loadAvailableAgents() {
  const data = JSON.parse(readFileSync(TERMINALS_STORE_PATH, 'utf8'));
  const terminals = data.terminals || [];
  return terminals.map(t => ({...}));
}
```

## Solution

Implemented a multi-source agent loading strategy:

### New Functions

1. **`loadAgentsFromTerminals()`** - Reads from `quack-terminals.json` (primary source with full context)
2. **`loadAgentsFromPersonalities(projectPath)`** - Reads from `.quack/agent-personalities/*.json` (secondary source)
3. **`loadAvailableAgents()`** - Merges both sources with deduplication

### Deduplication Logic

Terminals have priority. Personalities are only included if:
- Their ID is not already in terminals
- Their name (case-insensitive) is not already in terminals

### Output Enhancement

The `kanban_list_agents` response now includes:
- `fromTerminals`: count of agents from active terminals
- `fromPersonalities`: count of agents from saved personalities
- `source`: 'terminal' or 'personality' for each agent

## Files Changed

- `src-tauri/node-sdk/kanban-mcp-server.js`:
  - Added `readdirSync` to imports
  - Added `loadAgentsFromTerminals()` function
  - Added `loadAgentsFromPersonalities()` function
  - Rewrote `loadAvailableAgents()` with merge logic
  - Updated `handleListAgents()` to show source info

## Testing

### Before Fix
```
Total agents: 19 (only active terminals)
```

### After Fix
```
Total agents: 130 (19 from terminals + 111 from personalities)
fromTerminals: 19
fromPersonalities: 111
```

## Notes

- Personalities don't have `projectPath`, so when filtering by project they will be included (as available agents that could be used in any project)
- The fix requires MCP server restart to take effect
- No breaking changes to existing API

## Acceptance Criteria

- [x] `kanban_list_agents` reads from both terminals and personalities
- [x] Agents are deduplicated (terminals have priority)
- [x] `source` field indicates where agent came from
- [x] Filtering by `projectPath` still works (includes personalities as they are project-agnostic)
- [x] No regressions on other Kanban functions
