# Agent Teams Integration - Test & Documentation Guide

This document serves two purposes:
1. **Documentation**: Explains how Agent Teams works in Quack
2. **Manual Test Plan**: Step-by-step verification in Quack App

---

## How Agent Teams Works

Agent Teams turns Quack into the visual display layer for Claude Code's experimental Swarm/Agent Teams feature. Instead of requiring tmux, Quack manages multiple Claude Code sessions (teammates) through its own sidebar and chat infrastructure. A designated Team Lead agent coordinates work by spawning teammates via the SDK's `TeammateTool`, and each teammate reads a shared Team Roster injected into the project's `CLAUDE.md`.

The feature is entirely behind the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` feature flag, toggled from Settings > Claude Code > Experimental Features.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Quack App (Tauri + React)                              │
│                                                         │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │ Settings UI  │    │ RepositoryGroup.tsx           │   │
│  │  Toggle:     │    │  [Create Team] button         │   │
│  │  AGENT_TEAMS │    │  TeamStatusBadge (on lead)    │   │
│  │  env var     │    │  TeamCreationModal            │   │
│  └──────┬───────┘    └──────────┬───────────────────┘   │
│         │                       │                        │
│         │              invoke("create_team")              │
│         │                       │                        │
│  ┌──────▼───────────────────────▼───────────────────┐   │
│  │  Rust Backend (src-tauri/)                        │   │
│  │                                                   │   │
│  │  teams.rs                                         │   │
│  │  ├─ create_team()  → .quack/teams/{id}.json      │   │
│  │  ├─ disband_team() → cleanup JSON + CLAUDE.md     │   │
│  │  ├─ get_active_team()                             │   │
│  │  └─ inject_team_roster_to_claude_md()             │   │
│  │       ↓                                           │   │
│  │  CLAUDE.md ← <!-- QUACK_TEAM_ROSTER_START -->     │   │
│  │                                                   │   │
│  │  claude_cli.rs                                    │   │
│  │  ├─ TeamContext struct in ClaudeCliRequest         │   │
│  │  └─ Propagate env var + config to Node            │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                                │
│  ┌──────────────────────▼───────────────────────────┐   │
│  │  Node SDK (stream-claude.js)                      │   │
│  │  ├─ Parse teamContext from config                 │   │
│  │  ├─ buildTeamPromptAugmentation()                 │   │
│  │  └─ Augment system prompt for Team Lead           │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                                │
│  ┌──────────────────────▼───────────────────────────┐   │
│  │  App.tsx (Event Interception)                     │   │
│  │  ├─ Listen for 'agent' events                     │   │
│  │  ├─ action: 'start' → TeammateStatus = 'active'  │   │
│  │  └─ action: 'stop'  → TeammateStatus = 'stopped' │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Key Concepts

1. **Team Roster Injection**: When a team is created, Quack injects a markdown block into the project's `CLAUDE.md` between `<!-- QUACK_TEAM_ROSTER_START -->` and `<!-- QUACK_TEAM_ROSTER_END -->` markers. This block lists every team member with their name, role, and communication style. Each teammate reads `CLAUDE.md` on startup and finds their own personality.

2. **Team Lead Augmentation**: The Team Lead's system prompt is augmented (in `stream-claude.js`) with instructions about being a Team Lead, the list of available teammates, and guidance to use `TeammateTool` for delegation.

3. **In-Process Mode**: Quack forces `TEAMMATE_MODE=in-process`, replacing tmux as the display layer. Quack's sidebar and chat render teammate sessions natively.

4. **Feature Flag Isolation**: Everything is gated behind `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. The "Create Team" button, roster injection, and prompt augmentation all check this flag.

5. **Agent Personality Loading**: Team member personalities are loaded from `.quack/agent-personalities/{agentId}.json` during team creation, populating the roster with each agent's name, role, communication style, and preferred skills.

### Where Things Live

```
project/
├── .quack/
│   ├── teams/
│   │   └── {uuid}.json          # Team config (members, lead, task)
│   └── agent-personalities/
│       └── {agentId}.json       # Agent personality data
├── CLAUDE.md                    # Receives roster injection block
│
src-tauri/
├── src/
│   ├── teams.rs                 # Rust: CRUD + roster injection
│   ├── claude_cli.rs            # Rust: TeamContext propagation
│   └── lib.rs                   # Rust: command registration
├── node-sdk/
│   └── stream-claude.js         # Node: prompt augmentation
│
src/
├── types.ts                     # TS: TeamConfig, TeamMember, etc.
├── stores/
│   └── teamStore.ts             # Zustand: team state management
├── components/
│   ├── TeamCreationModal.tsx     # Modal: create a team
│   ├── TeamStatusBadge.tsx       # Badge: crown + count + name
│   ├── RepositoryGroup.tsx       # Wiring: button, badge, modal
│   └── settings/.../ClaudeCodeSettings.tsx  # Toggle: feature flag
└── App.tsx                       # Event: teammate status tracking
```

### Code Map

| File | Responsibility |
|------|---------------|
| `src-tauri/src/teams.rs` | Team CRUD, `.quack/teams/` storage, CLAUDE.md roster injection/removal |
| `src-tauri/src/claude_cli.rs` | `TeamContext` struct, pass to Node, propagate env var |
| `src-tauri/node-sdk/stream-claude.js` | `buildTeamPromptAugmentation()`, system prompt augmentation |
| `src/types.ts` | `TeamConfig`, `TeamMember`, `TeamContext`, `TeammateStatus` types |
| `src/stores/teamStore.ts` | Zustand store: `activeTeam`, `teammateStatus`, CRUD actions |
| `src/components/TeamCreationModal.tsx` | UI: agent selection, lead designation, team creation form |
| `src/components/TeamStatusBadge.tsx` | UI: compact badge showing crown icon + count + team name |
| `src/components/RepositoryGroup.tsx` | UI: "Create Team" button, badge display, modal orchestration |
| `src/App.tsx` | Runtime: intercept agent events, update teammate status |
| `src/components/settings/.../ClaudeCodeSettings.tsx` | Settings: feature flag toggle |

---

## Manual Testing in Quack App

Open Quack and follow each section in order.

---

### Test 1: Feature Flag Toggle

**What to check**: The Agent Teams toggle exists in Settings and writes the correct env var.

1. Open Quack App
2. Go to **Settings** (gear icon)
3. Navigate to **Claude Code** category
4. Look for the **Experimental Features** section
5. Find the **Agent Teams** toggle

**Pass criteria**:
- [ ] Toggle labeled "Agent Teams" is visible
- [ ] Description reads: "Coordinate multiple Claude Code sessions working in parallel as a team. Quack provides the visual layer."
- [ ] Toggle starts in OFF position (if not previously enabled)
- [ ] Toggle can be switched ON and OFF without errors

**If it doesn't work**: Check the browser console (Cmd+Shift+I) for errors from `get_claude_env_vars` or `set_claude_env_var` Tauri commands.

---

### Test 2: Feature Flag Persistence

**What to check**: The toggle state persists after restart.

1. Open Settings > Claude Code > Experimental Features
2. Enable "Agent Teams" toggle
3. Close and reopen Quack App
4. Go back to Settings > Claude Code > Experimental Features

**Pass criteria**:
- [ ] Agent Teams toggle is still ON after restart
- [ ] Toggle OFF, restart, verify it stays OFF

---

### Test 3: Create Team Button Visibility (Flag OFF)

**What to check**: The "Create Team" button does NOT appear when the feature flag is disabled.

1. Ensure Agent Teams toggle is **OFF** in Settings
2. Open a project with 2+ agents in the sidebar
3. Look at the repository group header

**Pass criteria**:
- [ ] No "Create Team" button (users icon) is visible in the repository group header
- [ ] Single-agent workflow is completely unaffected

---

### Test 4: Create Team Button Visibility (Flag ON)

**What to check**: The "Create Team" button appears when the feature flag is enabled and there are 2+ agents.

1. Enable Agent Teams toggle in Settings
2. Open a project that has **2 or more agents** assigned
3. Look at the repository group header actions area

**Pass criteria**:
- [ ] A button with a "users" icon (two people silhouette) is visible
- [ ] Button has orange color (`rgba(255, 107, 53, ...)`)
- [ ] Button is NOT visible if only 1 agent exists for the project

**If it doesn't work**: Check that `agentTeamsEnabled` is being loaded correctly in `RepositoryGroup.tsx`. Open console and look for errors from `get_claude_env_vars`.

---

### Test 5: Create Team Button - Minimum Agent Requirement

**What to check**: The button only shows when 2+ agents are available.

1. Enable the feature flag
2. Navigate to a project with only 1 agent
3. Check that no team creation button appears
4. Navigate to a project with 2+ agents
5. Check that the button appears

**Pass criteria**:
- [ ] Button hidden with 0-1 agents
- [ ] Button visible with 2+ agents

---

### Test 6: Team Creation Modal - Opening

**What to check**: Clicking the "Create Team" button opens the creation modal.

1. Enable feature flag, navigate to a project with 2+ agents
2. Click the "Create Team" (users icon) button

**Pass criteria**:
- [ ] Modal opens with dark backdrop and blur effect
- [ ] Modal header reads "Create Agent Team"
- [ ] Modal contains: Team Name input, Task input, Agent selection list
- [ ] Close button (X) is visible in the header

---

### Test 7: Team Creation Modal - Form Fields

**What to check**: All form fields work correctly.

1. Open the Team Creation modal
2. Type a name in "Team Name" field (e.g., `Refactor Auth`)
3. Type a task in "Task" field (e.g., `Refactor the authentication module`)
4. Verify both fields accept text input

**Pass criteria**:
- [ ] Team Name field has placeholder "e.g., Refactor Auth"
- [ ] Task field has placeholder "What should this team work on?"
- [ ] Both fields are marked as "(optional)"
- [ ] Token usage warning is visible: "Each teammate runs a separate Claude Code session. Token usage scales with team size."

---

### Test 8: Team Creation Modal - Agent Selection

**What to check**: Agents can be selected/deselected with checkboxes.

1. Open the Team Creation modal
2. Click on an agent row to select it
3. Click again to deselect it
4. Select 2 or more agents

**Pass criteria**:
- [ ] Each agent shows: checkbox, color dot, agent name
- [ ] Clicking an agent row toggles the checkbox
- [ ] Selected agents show a colored border and tinted background
- [ ] Deselected agents revert to neutral styling

---

### Test 9: Team Creation Modal - Lead Designation

**What to check**: The first selected agent is auto-designated as lead, and lead can be changed.

1. Open the modal, select 2 agents
2. Observe that the first selected agent shows "LEAD" badge
3. Click "Set Lead" on the second agent
4. Observe the lead designation moves

**Pass criteria**:
- [ ] First selected agent is automatically designated as lead
- [ ] Lead agent shows orange "LEAD" button
- [ ] Non-lead selected agents show "Set Lead" button
- [ ] Clicking "Set Lead" changes the lead designation
- [ ] Deselecting the lead agent clears the lead (requires re-selection)

---

### Test 10: Team Creation Modal - Submit Validation

**What to check**: The "Create Team" button enforces minimum requirements.

1. Open modal with no agents selected
2. Try clicking "Create Team"
3. Select only 1 agent
4. Try clicking "Create Team"
5. Select 2 agents (lead auto-assigned)

**Pass criteria**:
- [ ] "Create Team" button is disabled with 0 agents selected
- [ ] "Create Team" button is disabled with 1 agent selected
- [ ] "Create Team" button is disabled if no lead is designated
- [ ] "Create Team" button becomes enabled with 2+ agents and a lead

---

### Test 11: Team Creation Modal - Keyboard Shortcuts

**What to check**: Escape closes the modal, Enter submits.

1. Open the modal
2. Press **Escape**
3. Reopen the modal, select 2 agents
4. Press **Enter**

**Pass criteria**:
- [ ] Escape closes the modal without creating a team
- [ ] Enter submits the form (when valid - 2+ agents, lead selected)
- [ ] Clicking the backdrop (outside the modal) also closes it

---

### Test 12: Team Creation Modal - Form Reset

**What to check**: The form resets each time the modal opens.

1. Open the modal, type a name, select some agents
2. Close the modal (Escape or Cancel)
3. Reopen the modal

**Pass criteria**:
- [ ] Team Name field is empty
- [ ] Task field is empty
- [ ] No agents are selected
- [ ] No lead is designated

---

### Test 13: Team Creation - File System Verification

**What to check**: Creating a team writes the correct JSON file.

1. Open the modal, name the team "Test Team Alpha"
2. Select 2+ agents, designate a lead
3. Add task: "Test task description"
4. Click "Create Team"
5. After modal closes, check the file system

**Pass criteria**:
- [ ] File exists at `{project}/.quack/teams/{uuid}.json`
- [ ] JSON contains: `name: "Test Team Alpha"`, `taskDescription: "Test task description"`
- [ ] JSON contains `members` array with correct agent data
- [ ] JSON contains `leadAgentId` matching the designated lead
- [ ] JSON contains `createdAt` timestamp

**Verification command** (in terminal):
```bash
ls .quack/teams/
cat .quack/teams/*.json | python3 -m json.tool
```

---

### Test 14: CLAUDE.md Roster Injection

**What to check**: Creating a team injects the Team Roster block into CLAUDE.md.

1. Create a team (Test 13)
2. Open the project's `CLAUDE.md` file

**Pass criteria**:
- [ ] Block starts with `<!-- QUACK_TEAM_ROSTER_START -->`
- [ ] Block ends with `<!-- QUACK_TEAM_ROSTER_END -->`
- [ ] Contains `## Agent Team: "Test Team Alpha"`
- [ ] Lists the Team Lead with `### Team Lead: {name}` and correct role/style
- [ ] Lists each teammate with `### Teammate: {name}` and correct role/style
- [ ] Existing CLAUDE.md content (above and below) is preserved intact
- [ ] The individual `QUACK_AGENT_HEADER` block is NOT affected

**If it doesn't work**: Check that `.quack/agent-personalities/{agentId}.json` files exist for each team member. The roster builder reads personalities from these files.

---

### Test 15: Team Status Badge Display

**What to check**: After creating a team, the lead agent's card shows a team badge.

1. Create a team (if not already active)
2. Look at the repository group in the sidebar

**Pass criteria**:
- [ ] The repository display name has a small badge next to it
- [ ] Badge shows: crown icon + teammate count + team name
- [ ] Badge is orange-themed
- [ ] Badge disappears if no active team exists

---

### Test 16: Team Disbanding

**What to check**: Disbanding a team cleans up all artifacts.

1. Ensure a team is active (create one if needed)
2. Note the team JSON file path and CLAUDE.md roster block
3. Disband the team (via store action or future UI button)

**Pass criteria**:
- [ ] Team JSON file at `.quack/teams/{id}.json` is deleted
- [ ] CLAUDE.md roster block (`QUACK_TEAM_ROSTER_START` to `END`) is removed
- [ ] Remaining CLAUDE.md content is intact
- [ ] Individual `QUACK_AGENT_HEADER` block is NOT affected
- [ ] TeamStatusBadge disappears from the sidebar
- [ ] "Create Team" button reappears (if 2+ agents still exist)

**Verification command**:
```bash
ls .quack/teams/
grep "QUACK_TEAM_ROSTER" CLAUDE.md
```

---

### Test 17: Single-Agent Workflow Not Broken

**What to check**: With no active team, single-agent sessions work exactly as before.

1. Ensure no active team exists (disband if needed)
2. Start a new session with any agent
3. Use the agent normally (send a message, wait for response)

**Pass criteria**:
- [ ] Agent starts without errors
- [ ] Chat works normally
- [ ] No team-related content appears in the UI
- [ ] No team-related errors in the console
- [ ] `CLAUDE.md` has no `QUACK_TEAM_ROSTER` block

---

### Test 18: Roster Idempotency

**What to check**: Creating a team twice doesn't duplicate the roster block.

1. Create a team
2. Check CLAUDE.md for the roster block
3. Note that creating another team (or re-injecting) replaces the existing block

**Pass criteria**:
- [ ] Only ONE `QUACK_TEAM_ROSTER_START` marker exists in CLAUDE.md
- [ ] Only ONE `QUACK_TEAM_ROSTER_END` marker exists in CLAUDE.md
- [ ] No duplicate or leftover roster content

---

### Test 19: Default Team Name Generation

**What to check**: When no team name is provided, a default is generated.

1. Open the Team Creation modal
2. Leave the "Team Name" field empty
3. Select 2+ agents, designate lead
4. Click "Create Team"
5. Check the team JSON or badge

**Pass criteria**:
- [ ] Team is created successfully
- [ ] Team name is auto-generated as `Team {Mon DD}` format (e.g., "Team Feb 6")

---

### Test 20: Node SDK - Team Prompt Augmentation

**What to check**: When a team session starts, the Team Lead's system prompt is augmented.

1. Create a team
2. Start a session for the Team Lead agent
3. Check the Node process logs or add a temporary `console.log` in `stream-claude.js` at the augmentation point

**Pass criteria**:
- [ ] System prompt includes `## Agent Teams Mode`
- [ ] System prompt includes `You are the **TEAM LEAD** of team "{teamName}"`
- [ ] System prompt includes `Quack is the visual display layer - do NOT use tmux`
- [ ] System prompt lists each teammate with name, role, and style
- [ ] `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` env var is set on the Node process

**If it doesn't work**: Add `console.log('teamContext:', JSON.stringify(teamContext))` at line ~138 of `stream-claude.js` to verify the context is being passed from Rust.

---

## Troubleshooting

### Team creation fails silently

- **Diagnose**: Open DevTools Console (Cmd+Shift+I), look for `Failed to create team` error
- **Common cause**: Missing `.quack/teams/` directory (should be auto-created by `create_team`)
- **Fix**: Manually create the directory: `mkdir -p .quack/teams`

### CLAUDE.md roster not appearing

- **Diagnose**: Check if `.quack/agent-personalities/{agentId}.json` files exist for selected agents
- **Common cause**: Agent personalities not saved (agent was created before personality system)
- **Fix**: Re-save agent personality from Agent Settings, then recreate the team

### Toggle doesn't persist

- **Diagnose**: Check `~/.claude/settings.json` for `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` key
- **Common cause**: Permission issues writing to `~/.claude/settings.json`
- **Fix**: Check file permissions: `ls -la ~/.claude/settings.json`

### "Create Team" button not showing

- **Diagnose**: Verify feature flag is ON and project has 2+ agents
- **Common cause**: `get_claude_env_vars` returns stale data
- **Fix**: Toggle the feature flag off and on, or restart the app

### Teammate status not updating in sidebar

- **Diagnose**: Check console for `agent` type events in `handleClaudeEvent`
- **Common cause**: Agent events from SDK don't have `agent_name` field
- **Fix**: This depends on the Claude Agent SDK version emitting correct agent events. Verify SDK version >= 0.2.32

---

## Architecture Summary

### Before (without Agent Teams)

```
Quack App
├── Single agent per session
├── CLAUDE.md has QUACK_AGENT_HEADER only
├── No team coordination
└── tmux required for multi-agent SDK usage
```

### After (with Agent Teams)

```
Quack App
├── Team Lead + N teammates per project
├── CLAUDE.md has QUACK_AGENT_HEADER + QUACK_TEAM_ROSTER
├── Zustand store manages team state
├── Sidebar shows badge + teammate status
├── stream-claude.js augments Team Lead prompt
└── Quack IS the display layer (replaces tmux)
```

### Key Design Decisions

1. **CLAUDE.md Roster Injection**: All team personalities go into CLAUDE.md rather than per-session config, so teammates can discover each other by reading the shared project file
2. **Feature Flag Isolation**: 100% of team code is behind `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, allowing safe rollback
3. **In-Process Mode**: Quack replaces tmux as the visual layer, using its existing sidebar/chat infrastructure
4. **Personality Loading from Disk**: Agent personalities are read from `.quack/agent-personalities/` at team creation time, keeping the roster fresh with any personality changes
