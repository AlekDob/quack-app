# Agent Sessions UI Components

Documentation for Phase 2: UI components for AgentSession management.

## Overview

The Agent Sessions UI provides a clean, intuitive interface for managing multiple chat sessions per agent. Each agent can have multiple sessions, allowing users to organize work by task or context.

## Components

### AgentSessionItem

Individual session card displaying:
- Status emoji (⚪ todo, ⏳ in_progress, ✅ done)
- Session title (truncated at 30 chars)
- Relative time (2m ago, 1h ago, 3d ago)
- Message count badge

**File**: `src/components/AgentSessionItem.tsx`

```tsx
<AgentSessionItem
  session={session}
  onClick={handleSessionClick}
  isActive={isActiveSession}
/>
```

### AgentSessionList

Container for sessions under an agent card with:
- Max 5 visible non-done sessions
- "Show all" button if more than 5
- "New Session" button with + icon
- Empty state for first session
- Loading state

**File**: `src/components/AgentSessionList.tsx`

```tsx
<AgentSessionList
  agentId={agent.id}
  projectPath={projectPath}
  projectName={projectName}
  onSessionClick={handleSessionClick}
  onNewSession={handleNewSession}
  activeSessionId={currentSessionId}
/>
```

## Visual Design

### Session Item States

```
┌─────────────────────────────────────┐
│ Normal State (Idle)                 │
├─────────────────────────────────────┤
│ ⏳ Fix auth bug in login flow       │
│ 15m ago              3 msgs         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Hover State                         │
├─────────────────────────────────────┤
│ ⏳ Fix auth bug in login flow    ▶  │  <- Slight shift right
│ 15m ago              3 msgs         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Active State (Currently Open)       │
├─────────────────────────────────────┤
│ ⏳ Fix auth bug in login flow       │  <- Blue highlight
│ 15m ago              3 msgs         │
└─────────────────────────────────────┘
```

### Full Session List Layout

```
┌───────────────────────────────────────────┐
│ Agent Magnus                              │
│ Backend Performance Specialist            │
│ Working on: API optimization              │
├───────────────────────────────────────────┤
│ Technical Context                         │
│ Coordinates feature development...        │
├───────────────────────────────────────────┤
│ [Export Bundle]  [Import Bundle]          │
├───────────────────────────────────────────┤
│                                           │
│ SESSIONS:                                 │
│ ┌───────────────────────────────────────┐ │
│ │ ⏳ Fix auth token expiry bug          │ │
│ │ 5m ago              12 msgs           │ │
│ ├───────────────────────────────────────┤ │
│ │ ⚪ Implement rate limiting            │ │
│ │ 1h ago               3 msgs           │ │
│ ├───────────────────────────────────────┤ │
│ │ ⚪ Add caching layer                  │ │
│ │ 2h ago               7 msgs           │ │
│ ├───────────────────────────────────────┤ │
│ │ ⚪ Database migration script          │ │
│ │ 1d ago               5 msgs           │ │
│ ├───────────────────────────────────────┤ │
│ │ ⚪ Write integration tests            │ │
│ │ 2d ago               8 msgs           │ │
│ └───────────────────────────────────────┘ │
│                                           │
│ [Show all (12)]                           │
│ [+ New Session]                           │
└───────────────────────────────────────────┘
```

### Empty State

```
┌───────────────────────────────────────────┐
│ Agent Magnus                              │
│ Backend Performance Specialist            │
├───────────────────────────────────────────┤
│                                           │
│ SESSIONS:                                 │
│ ┌───────────────────────────────────────┐ │
│ │                                       │ │
│ │         No sessions yet               │ │
│ │                                       │ │
│ │    [+ Create First Session]           │ │
│ │                                       │ │
│ └───────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

## Color Scheme

Following Quack's glassmorphism design:

| Element | Color | Usage |
|---------|-------|-------|
| Background | `rgba(20, 20, 25, 0.6)` | Card background |
| Border | `rgba(255, 255, 255, 0.08)` | Default borders |
| Hover BG | `rgba(255, 255, 255, 0.08)` | Interactive hover |
| Active BG | `rgba(0, 212, 255, 0.15)` | Selected session |
| Active Border | `rgba(0, 212, 255, 0.4)` | Selected border |
| Message Badge BG | `rgba(77, 212, 179, 0.15)` | Message count |
| Message Badge Border | `rgba(77, 212, 179, 0.3)` | Badge border |
| Message Badge Text | `rgba(77, 212, 179, 0.9)` | Badge text |
| New Button BG | `rgba(0, 212, 255, 0.1)` | New session button |
| New Button Hover | `rgba(0, 212, 255, 0.2)` | Button hover |

## Typography

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Session Title | 0.75rem | 500 | rgba(255,255,255,0.9) |
| Time Text | 0.625rem | 400 | rgba(255,255,255,0.5) |
| Message Count | 0.625rem | 600 | rgba(77,212,179,0.9) |
| Button Text | 0.7rem | 600 | varies |

## Interactions

### Session Click Flow

1. User clicks session item
2. Item highlights (blue border)
3. Callback `onSessionClick(sessionId)` fires
4. Parent component handles:
   - Load session from storage
   - Open chat drawer
   - Resume Claude SDK session

### New Session Flow

1. User clicks "+ New Session" button
2. Callback `onNewSession()` fires
3. Parent component handles:
   - Create new `AgentSession` object
   - Generate unique ID
   - Link to agent + project
   - Open chat drawer with empty session

### Show All Flow

1. User clicks "Show all (X)" button
2. Component expands to show all non-done sessions
3. Button disappears
4. List becomes scrollable if > 10 items

## Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move focus between sessions |
| Enter / Space | Open selected session |
| Esc | Close if in modal context |

## Accessibility

- Semantic HTML structure
- Focus-visible outlines (2px solid cyan)
- ARIA roles for interactive elements
- Screen reader friendly labels
- Color contrast WCAG AA compliant

## Performance Considerations

- Max 5 sessions rendered by default (virtualization not needed)
- CSS transitions for smooth animations
- Minimal re-renders (React.memo on items)
- No heavy computations in render

## Integration Points

### With AgentPersonalityCard

```tsx
<div className="agent-card-container">
  <AgentPersonalityCard {...agentProps} />
  <AgentSessionList {...sessionProps} />
</div>
```

### With Zustand Store

```tsx
const { selectTask, openDrawer } = useKanbanStore();

function handleSessionClick(sessionId: string) {
  selectTask(sessionId);
  openDrawer();
}
```

### With Storage Layer (TODO - Phase 3)

```tsx
const sessions = await invoke<AgentSession[]>('load_agent_sessions', {
  agentId,
  projectPath,
});
```

## Future Enhancements

- [ ] Drag-and-drop session reordering
- [ ] Session duplication
- [ ] Quick actions menu (rename, delete, archive)
- [ ] Session tags/labels
- [ ] Search/filter sessions
- [ ] Session templates
- [ ] Batch operations (select multiple)

## File Structure

```
src/
├── components/
│   ├── AgentSessionItem.tsx          # Individual session card
│   ├── AgentSessionList.tsx          # Session list container
│   ├── AgentSessionList.css          # Shared styles
│   └── AgentCardWithSessions.example.tsx  # Integration example
├── utils/
│   └── timeFormat.ts                 # Time formatting utilities
└── types.ts                          # AgentSession interface
```

## TypeScript Types

```typescript
export interface AgentSession {
  id: string;                      // UUID
  claudeSessionId?: string;        // Claude SDK session ID
  title: string;                   // Session name
  agentId: string;                 // TerminalInfo.id
  projectPath: string;             // Project directory
  projectName: string;             // Display name
  status: AgentSessionStatus;      // todo | in_progress | done
  createdAt: number;               // Timestamp
  updatedAt: number;               // Timestamp
  completedAt?: number;            // Timestamp
  messageCount: number;            // Number of messages
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalCost?: number;
}

export type AgentSessionStatus = 'todo' | 'in_progress' | 'done';
```

---

**Status**: Phase 2 Complete ✅
**Next**: Storage Layer & State Management (Phase 3)
