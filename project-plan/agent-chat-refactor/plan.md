# AgentChat Refactor - Implementation Plan

**Project Owner**: Mike - The Project Manager
**Status**: 🚧 In Development
**Start Date**: 2025-01-16
**Estimated Duration**: 2-3 days
**Risk Level**: Medium-High (affects core terminal management)

## Executive Summary

Refactoring the terminal management system to introduce **AgentChat** as a workspace container concept, separating the logical grouping of terminals (workspace/project) from individual terminal tabs. This allows multiple terminals to belong to the same project context while maintaining independent state and configuration.

### Why This Refactor?

Currently, terminals are grouped visually but lack a proper workspace container concept. This leads to:
- Terminals scattered across different projects without clear organization
- No way to manage multiple terminals as a cohesive project unit
- Difficulty in maintaining project context when switching between workspaces
- Inefficient workflow when working on multiple projects simultaneously

### Success Criteria
✅ All existing terminals automatically migrate to appropriate AgentChats
✅ Zero data loss during migration
✅ Clean separation between AgentChat (workspace) and Terminal (tab)
✅ Intuitive UI that clearly shows workspace boundaries
✅ Backward compatibility for terminal operations
✅ No performance regression

## Architectural Changes

### Before (Current State)
```
Terminals (flat list)
├── Terminal 1 (cwd: /project-a)
├── Terminal 2 (cwd: /project-b)
├── Terminal 3 (cwd: /project-a)
└── Terminal 4 (cwd: /project-c)
```

### After (Target State)
```
AgentChats (workspaces)
├── AgentChat: project-a
│   ├── Terminal 1
│   └── Terminal 3
├── AgentChat: project-b
│   └── Terminal 2
└── AgentChat: project-c
    └── Terminal 4
```

## Phase 1: Foundation & State Management (Day 1, Morning)
**Duration**: 3-4 hours
**Risk**: Low
**Rollback**: Simple - just remove new code

### 1.1 Create AgentChat State Management Handlers
**File**: `src/App.tsx`

#### New Functions to Implement:
```typescript
// Handler to create new AgentChat
const handleCreateAgentChat = useCallback((
  name: string,
  cwd: string,
  color?: string
) => AgentChat)

// Handler to delete AgentChat and its terminals
const handleDeleteAgentChat = useCallback((
  agentChatId: string
) => void)

// Handler to select active AgentChat
const handleSelectAgentChat = useCallback((
  agentChatId: string | null
) => void)

// Handler to update AgentChat properties
const handleUpdateAgentChat = useCallback((
  agentChatId: string,
  updates: Partial<AgentChat>
) => void)

// Handler to find or create AgentChat for a cwd
const findOrCreateAgentChatForCwd = useCallback((
  cwd: string
) => AgentChat)
```

### 1.2 Implement Persistence Layer
**Files**: `src/App.tsx`

#### Storage Functions:
```typescript
const AGENT_CHATS_KEY = "agentChats";
const ACTIVE_AGENT_CHAT_KEY = "activeAgentChat";

const saveAgentChatsToStorage = async (chats: AgentChat[])
const loadAgentChatsFromStorage = async (): Promise<AgentChat[]>
const saveActiveAgentChatToStorage = async (id: string | null)
const loadActiveAgentChatFromStorage = async (): Promise<string | null>
```

### Testing Checkpoint 1.1
- [ ] Create AgentChat programmatically
- [ ] Delete AgentChat (verify no side effects yet)
- [ ] Update AgentChat properties
- [ ] Save/load AgentChats from storage
- [ ] Verify no impact on existing terminal functionality

### Dependencies
- ✅ TypeScript types already defined
- ✅ Store plugin already configured
- No external dependencies

---

## Phase 2: Migration System (Day 1, Afternoon)
**Duration**: 2-3 hours
**Risk**: Medium - affects existing data
**Rollback**: Keep original terminal loading as fallback

### 2.1 Automatic Migration on Load
**File**: `src/App.tsx` - modify `loadTerminals` function

#### Migration Logic:
1. Load existing terminals from storage
2. Group terminals by unique `cwd`
3. Create one AgentChat per unique `cwd`
4. Assign `agentChatId` to each terminal
5. Save migrated data
6. Mark migration as complete (flag in storage)

```typescript
const migrateTerminalsToAgentChats = async (
  terminals: TerminalInfo[]
): Promise<{
  agentChats: AgentChat[],
  migratedTerminals: TerminalInfo[]
}>
```

### 2.2 Migration Validation
- Verify all terminals have valid `agentChatId`
- Ensure no orphaned terminals
- Check AgentChat references are valid
- Log migration results for debugging

### Testing Checkpoint 2.1
- [ ] Load app with existing terminals (no AgentChats)
- [ ] Verify automatic migration creates correct AgentChats
- [ ] Check each terminal has correct `agentChatId`
- [ ] Reload app - verify no duplicate migration
- [ ] Test with edge cases:
  - [ ] Terminals with same cwd
  - [ ] Terminals with no cwd
  - [ ] Empty terminal list

### Rollback Plan
If migration fails:
1. Keep original terminal loading code
2. Add feature flag to disable AgentChat system
3. Log errors but continue with legacy mode

---

## Phase 3: Terminal Creation Integration (Day 2, Morning)
**Duration**: 3-4 hours
**Risk**: Medium - affects core user flow
**Rollback**: Revert terminal creation functions

### 3.1 Update Terminal Creation Flow
**Files**: `src/App.tsx`

#### Modify `handleConfirmNewTerminal`:
1. Check if AgentChat exists for selected `cwd`
2. If not, create new AgentChat
3. Assign `agentChatId` to new terminal
4. Set new AgentChat as active

#### Modify `handleQuickCreateTerminal`:
1. Use `activeAgentChatId` if available
2. Otherwise, use current terminal's AgentChat
3. Fallback: create new AgentChat with default cwd

### 3.2 Update Terminal Deletion
**File**: `src/App.tsx` - `handleCloseTerminal`

1. Remove terminal from list
2. Check if AgentChat has no more terminals
3. Optionally delete empty AgentChat
4. Update active AgentChat if needed

### Testing Checkpoint 3.1
- [ ] Create terminal with modal - verify AgentChat assignment
- [ ] Quick create terminal - uses active AgentChat
- [ ] Create terminal in new directory - creates new AgentChat
- [ ] Delete last terminal in AgentChat - handles empty workspace
- [ ] Verify terminal colors remain independent

---

## Phase 4: UI Integration - Terminal Sidebar (Day 2, Afternoon)
**Duration**: 4-5 hours
**Risk**: High - major UI change
**Rollback**: Keep original sidebar as feature flag option

### 4.1 Refactor TerminalSidebar Component
**File**: `src/components/TerminalSidebar.tsx`

#### New Structure:
```
AgentChat Section (Collapsible)
├── AgentChat Header
│   ├── Name & Terminal Count
│   ├── Directory Path
│   └── Actions (Add Terminal, Delete)
└── Terminal List
    ├── Terminal Tab 1
    ├── Terminal Tab 2
    └── Terminal Tab N
```

#### Required Changes:
1. Group terminals by `agentChatId`
2. Show AgentChat sections
3. Highlight active AgentChat
4. Support AgentChat selection
5. Add AgentChat-level actions

### 4.2 Add AgentChat Management UI
- Rename AgentChat inline
- Change AgentChat color (affects new terminals)
- Delete AgentChat (with confirmation)
- Show terminal count per AgentChat
- Keyboard navigation between AgentChats

### Testing Checkpoint 4.1
- [ ] Sidebar shows AgentChats with nested terminals
- [ ] Click AgentChat to select it
- [ ] Click terminal to activate it
- [ ] Create terminal in active AgentChat
- [ ] Delete AgentChat removes all its terminals
- [ ] Rename AgentChat updates display
- [ ] Keyboard shortcuts work (Cmd+1-9 for AgentChats)

---

## Phase 5: Advanced Features & Polish (Day 3, Morning)
**Duration**: 3-4 hours
**Risk**: Low - enhancement features
**Rollback**: Disable individual features

### 5.1 AgentChat Context Features
- Show aggregate status (any terminal busy = AgentChat busy)
- Quick actions menu per AgentChat
- Duplicate AgentChat (clone all terminals)
- Export/Import AgentChat configurations
- AgentChat-wide operations (close all, restart all)

### 5.2 UI Enhancements
- Drag & drop terminals between AgentChats
- AgentChat search/filter
- Recently used AgentChats
- AgentChat templates
- Custom icons per AgentChat type

### 5.3 Integration Points
- Git panel shows current AgentChat's repo
- File explorer syncs with AgentChat cwd
- AI Assistant binds to AgentChat context
- Preview panel filtered by AgentChat

### Testing Checkpoint 5.1
- [ ] Drag terminal to different AgentChat
- [ ] Search for AgentChat by name
- [ ] Use AgentChat template to create preset
- [ ] Verify Git panel updates with AgentChat switch
- [ ] Check file explorer follows AgentChat

---

## Phase 6: Testing & Stabilization (Day 3, Afternoon)
**Duration**: 3-4 hours
**Risk**: Low - bug fixes only
**Rollback**: N/A - fix forward

### 6.1 Comprehensive Testing
#### User Flows:
1. **New User Flow**:
   - Fresh install → Create first terminal → AgentChat auto-created
   - Create multiple terminals → Proper grouping

2. **Migration Flow**:
   - Existing user with 10+ terminals → Automatic migration
   - Verify grouping by cwd is correct
   - Check no data loss

3. **Power User Flow**:
   - 5+ AgentChats with multiple terminals each
   - Rapid switching between AgentChats
   - Performance with 50+ terminals

#### Edge Cases:
- [ ] Terminal with invalid/missing cwd
- [ ] AgentChat with 20+ terminals
- [ ] Rapid create/delete operations
- [ ] Storage corruption recovery
- [ ] Network drive paths
- [ ] Symbolic links in paths

### 6.2 Performance Testing
- Measure startup time with 0, 10, 50 terminals
- Profile AgentChat switching performance
- Memory usage with multiple AgentChats
- Storage size optimization

### 6.3 Bug Fixes & Polish
- Fix any issues discovered in testing
- Optimize render performance
- Add loading states where needed
- Improve error messages
- Update tooltips and help text

---

## Risk Assessment & Mitigation

### High Risk Areas
1. **Data Migration**
   - **Risk**: Losing terminal configurations
   - **Mitigation**: Backup storage before migration, validation checks

2. **UI Breaking Changes**
   - **Risk**: Users confused by new sidebar
   - **Mitigation**: Gradual rollout, tutorial on first launch

3. **Performance Regression**
   - **Risk**: Slower with AgentChat overhead
   - **Mitigation**: Profile and optimize, lazy loading

### Medium Risk Areas
1. **Terminal Creation Flow**
   - **Risk**: Confusing AgentChat assignment
   - **Mitigation**: Clear UI indicators, smart defaults

2. **Storage Format Change**
   - **Risk**: Backward compatibility issues
   - **Mitigation**: Version storage format, migration path

### Low Risk Areas
1. **New Handler Functions**
   - **Risk**: Minimal, additive changes
   - **Mitigation**: Comprehensive unit tests

---

## Implementation Checklist

### Phase 1 ✅ Complete When:
- [ ] All handler functions implemented
- [ ] Storage layer working
- [ ] No regression in existing features
- [ ] Unit tests passing

### Phase 2 ✅ Complete When:
- [ ] Migration runs automatically
- [ ] All terminals have agentChatId
- [ ] Storage contains AgentChats
- [ ] No data loss verified

### Phase 3 ✅ Complete When:
- [ ] New terminals get correct agentChatId
- [ ] Quick create uses active AgentChat
- [ ] Terminal deletion handles edge cases
- [ ] Integration tests passing

### Phase 4 ✅ Complete When:
- [ ] Sidebar shows AgentChat structure
- [ ] All interactions working
- [ ] Visual design approved
- [ ] Accessibility verified

### Phase 5 ✅ Complete When:
- [ ] Advanced features working
- [ ] Integrations updated
- [ ] Performance acceptable
- [ ] Feature flags configured

### Phase 6 ✅ Complete When:
- [ ] All test scenarios passing
- [ ] Performance benchmarks met
- [ ] No critical bugs
- [ ] Documentation updated

---

## Success Metrics

### Quantitative
- ✅ 100% of existing terminals migrated successfully
- ✅ No increase in startup time (< 2s)
- ✅ Memory usage increase < 10%
- ✅ Zero data loss incidents
- ✅ All automated tests passing

### Qualitative
- ✅ Users understand AgentChat concept immediately
- ✅ Workflow feels more organized
- ✅ No confusion during migration
- ✅ Positive feedback on workspace management

---

## Rollback Strategy

### Phase-Specific Rollbacks

#### Phase 1-2 Rollback (State & Migration)
```bash
git revert [commits]
# Keep terminal loading original code
# Feature flag: ENABLE_AGENT_CHATS=false
```

#### Phase 3-4 Rollback (UI Changes)
```bash
# Revert UI components
git revert [ui-commits]
# Keep backend changes, disable UI
# Show legacy sidebar
```

#### Phase 5-6 Rollback (Features)
```bash
# Disable individual features via flags
# Keep core AgentChat system
# Fix forward for bugs
```

### Data Recovery
1. Export terminal configurations before migration
2. Keep backup of storage file
3. Migration rollback function ready
4. Manual recovery script if needed

---

## Post-Implementation

### Documentation Updates
- [ ] Update README with AgentChat concept
- [ ] Add user guide for workspace management
- [ ] Document keyboard shortcuts
- [ ] Create migration guide for users

### Monitoring
- Track migration success rate
- Monitor performance metrics
- Collect user feedback
- Watch for error reports

### Future Enhancements
- AgentChat sharing between team members
- Cloud sync for AgentChats
- AI-powered workspace suggestions
- Terminal session recording per AgentChat
- Workspace templates marketplace

---

## Notes for Jack

*Mike here. Look, I've seen "simple refactors" turn into month-long debugging sessions because someone forgot that terminals can have symbolic links in their paths. Or that Windows uses backslashes. Or that some genius user has 147 terminals open because they "might need them later."*

*This plan accounts for all that nonsense. Follow the phases, don't skip the testing checkpoints, and for the love of all that is holy, DON'T try to do Phase 4 (the UI stuff) before Phase 2 (the migration). I've structured this so each phase builds on the previous one, and the risk increases as we go deeper.*

*The migration system is critical - mess that up and users lose their terminals, and then we're getting angry emails at 3 AM. The UI can be ugly for a day, but data loss? That's a career-limiting move.*

*Also, Alek mentioned "task grande" - yeah, no kidding. This touches literally every part of the terminal system. But I've broken it down so we can ship incrementally and rollback if something explodes. Each phase is a safe checkpoint.*

*Trust the process, follow the plan, and we'll have this working smoothly. And hey, at least we're not refactoring the authentication system - now THAT would be a nightmare! 🦆*

---

**Last Updated**: 2025-01-16
**Next Review**: After Phase 2 completion