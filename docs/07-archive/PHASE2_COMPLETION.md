# Phase 2 Completion: UI Components for AgentSession

## Overview

Fase 2 completata: componenti UI per visualizzare e gestire le AgentSession seguendo i pattern di design esistenti in Quack.

## Files Created

### 1. Time Formatting Utility
**File**: `/src/utils/timeFormat.ts`

Utility per formattare timestamp in formato relativo (2m ago, 1h ago, 3d ago) e assoluto.

**Functions**:
- `formatRelativeTime(timestamp: number): string` - Formato relativo
- `formatAbsoluteTime(timestamp: number): string` - Formato assoluto

### 2. AgentSessionItem Component
**File**: `/src/components/AgentSessionItem.tsx`

Componente per singola sessione in una lista.

**Features**:
- Status emoji: ⚪ (todo), ⏳ (in_progress), ✅ (done)
- Titolo troncato (max 30 caratteri)
- Tempo relativo (2m, 15m, 1h ago)
- Badge con message count
- Hover/active states
- Keyboard navigation (Enter/Space)

**Props**:
```typescript
interface AgentSessionItemProps {
  session: AgentSession;
  onClick: (sessionId: string) => void;
  isActive?: boolean;
}
```

### 3. AgentSessionList Component
**File**: `/src/components/AgentSessionList.tsx`

Lista di sessioni sotto una agent card.

**Features**:
- Mostra max 5 sessioni non-done
- "Show all" button se > 5 sessioni
- "New Session" button con icona +
- Empty state con CTA
- Loading state
- Integrazione con storage (TODO: Tauri invoke)

**Props**:
```typescript
interface AgentSessionListProps {
  agentId: string;
  projectPath: string;
  projectName: string;
  onSessionClick: (sessionId: string) => void;
  onNewSession: () => void;
  activeSessionId?: string;
}
```

### 4. CSS Styling
**File**: `/src/components/AgentSessionList.css`

Segue pattern esistenti da `AgentPersonalityCard.css`:

**Color Palette**:
- Background: `rgba(20, 20, 25, 0.6)`
- Border: `rgba(255, 255, 255, 0.08)`
- Hover: `rgba(255, 255, 255, 0.08)`
- Active: `rgba(0, 212, 255, 0.15)`
- Message badge: `rgba(77, 212, 179, 0.15)`

**Font Sizes**:
- Title: `0.75rem`
- Meta: `0.625rem`
- Buttons: `0.7rem`

### 5. Integration Example
**File**: `/src/components/AgentCardWithSessions.example.tsx`

Esempio completo di integrazione con AgentPersonalityCard + AgentSessionList.

Include esempio di usage in SidePanel con Zustand store integration.

## UI Design Patterns

### Session Item Layout
```
┌─────────────────────────────────────┐
│ ⏳ Fix auth bug in login flow       │  <- Status + Title
│ 15m ago              3 msgs         │  <- Time + Count
└─────────────────────────────────────┘
```

### Session List Layout
```
┌─────────────────────────────────────┐
│ AgentPersonalityCard                │
├─────────────────────────────────────┤
│ ⏳ Session 1                        │
│ ⚪ Session 2                        │
│ ⚪ Session 3                        │
│ ⚪ Session 4                        │
│ ⚪ Session 5                        │
│                                     │
│ [Show all (12)]                     │
│ [+ New Session]                     │
└─────────────────────────────────────┘
```

## Next Steps (Phase 3)

Per completare l'integrazione:

1. **Storage Layer**:
   - Implementare `load_agent_sessions` Tauri command
   - Implementare `create_agent_session` Tauri command
   - File storage in `.quack/agent-sessions/{agentId}/{sessionId}.json`

2. **State Management**:
   - Aggiungere `agentSessions` array in `terminalStore` o nuovo store
   - Hook `useAgentSessions(agentId, projectPath)`
   - Sync con Claude SDK session management

3. **Chat Integration**:
   - Collegare session click → open chat drawer
   - Passare `sessionId` a `useClaudeChat` hook
   - Resume session con Claude SDK

4. **UI Integration**:
   - Aggiungere `AgentSessionList` in `AgentContextPanel`
   - Handler per session click → apri chat
   - Handler per new session → crea task

## Design Decisions

### Status Emojis
- ⚪ `todo` - Not started yet
- ⏳ `in_progress` - Currently working
- ✅ `done` - Completed

### Pagination Strategy
- Show 5 sessions by default (avoid overwhelming UI)
- "Show all" button for easy expansion
- Filter only non-done sessions (done sessions can be viewed elsewhere)

### Message Count Badge
- Only shown if `messageCount > 0`
- Green color (`#4dd4b3`) matching Quack brand
- Compact format: "3 msgs" not "3 messages"

### Empty State
- Clear CTA: "Create First Session"
- Primary button style for emphasis
- Friendly empty message

## Browser Compatibility

All CSS uses standard properties compatible with:
- Chrome/Edge 90+
- Safari 14+
- Firefox 88+

No experimental CSS features used.

## Accessibility

- Keyboard navigation support (Enter/Space)
- Focus-visible outlines
- ARIA roles for interactive elements
- Semantic HTML structure
- Color contrast WCAG AA compliant

## Performance

- Efficient component structure (minimal re-renders)
- CSS transitions for smooth UX
- Lazy loading ready (pagination built-in)
- No heavy dependencies

## Testing TODO

Suggested test cases:

```typescript
describe('AgentSessionItem', () => {
  it('should display correct status emoji', () => {});
  it('should truncate long titles', () => {});
  it('should format relative time correctly', () => {});
  it('should show message count badge', () => {});
  it('should handle keyboard navigation', () => {});
});

describe('AgentSessionList', () => {
  it('should limit to 5 sessions by default', () => {});
  it('should show all button when > 5 sessions', () => {});
  it('should filter out done sessions', () => {});
  it('should show empty state when no sessions', () => {});
  it('should handle new session creation', () => {});
});
```

---

**Status**: ✅ Phase 2 Complete

**Next Phase**: Storage & State Management (Phase 3)
