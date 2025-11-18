# 🔥 App.tsx Refactoring - The Monster (P0)

**Priority**: P0 Critical 🔴
**Effort**: 3 weeks (phased approach)
**Impact**: Maintainability, testability, scalability
**Status**: ⏳ Pending

---

## 📊 Summary

Refactor App.tsx from **7,293 lines** (2,331% over limit) to **<300 lines**. This is the #1 architectural violation blocking maintainability and scalability.

---

## Problem Statement

### The Monster File

```
Current: App.tsx - 7,293 lines 🔥🔥🔥
Target:  App.tsx - <300 lines ✅
Reduction: -96% (6,993 lines to extract)
```

### Why This is Critical

1. **Unmaintainable**: Impossible to understand the full component
2. **Untestable**: Too complex to write meaningful tests
3. **Merge conflicts**: Multiple devs can't work on it simultaneously
4. **Performance**: React struggles with such large components
5. **Onboarding**: New developers overwhelmed
6. **Debugging**: Finding bugs is like finding a needle in a haystack

### Current Responsibilities (Too Many!)

App.tsx currently handles:
- Terminal management (create, delete, restore) ~1,200 lines
- Storage persistence (save/load) ~800 lines
- Agent chat management ~900 lines
- Git operations integration ~600 lines
- UI state management ~700 lines
- Event listeners (terminal output, exit) ~500 lines
- Drawers/Modals state ~400 lines
- Settings management ~300 lines
- Misc utilities & helpers ~1,893 lines

**Violates Single Responsibility Principle!**

---

## Target State

### After Refactoring

```typescript
// App.tsx - AFTER (~250 lines)
function App() {
  // All complex logic moved to custom hooks!
  const terminalManagement = useTerminalManagement()
  const storagePersistence = useStoragePersistence()
  const gitIntegration = useGitIntegration()
  const agentChats = useAgentChats()

  // Restore state on mount
  useEffect(() => {
    const restoreState = async () => {
      const metadata = await storagePersistence.load('terminals')
      await terminalManagement.restoreTerminals(metadata)
    }
    restoreState()
  }, [])

  return (
    <ErrorBoundary>
      <GitContext.Provider value={gitIntegration}>
        <TerminalContext.Provider value={terminalManagement}>
          <ChatContext.Provider value={agentChats}>
            <MainLayout />
          </ChatContext.Provider>
        </TerminalContext.Provider>
      </GitContext.Provider>
    </ErrorBoundary>
  )
}
```

### New File Structure

```
src/
├── App.tsx (~250 lines) - Orchestration only
├── hooks/
│   ├── useTerminalManagement.ts (~300 lines)
│   ├── useStoragePersistence.ts (~250 lines)
│   ├── useAgentChats.ts (~200 lines)
│   ├── useGitIntegration.ts (~180 lines)
│   ├── useTerminalEvents.ts (~150 lines)
│   └── useDrawersState.ts (~120 lines)
├── components/
│   ├── MainLayout.tsx (~200 lines)
│   ├── TerminalContainer.tsx (~180 lines)
│   ├── ChatContainer.tsx (~150 lines)
│   └── ModalsManager.tsx (~100 lines)
└── contexts/
    ├── TerminalContext.tsx (~100 lines) [may already exist]
    ├── GitContext.tsx (~100 lines) [may already exist]
    └── ChatContext.tsx (~150 lines) [may already exist]
```

**Result**: 7,293 lines → 12 files averaging ~170 lines each ✅

---

## Implementation Strategy

### Phase 1: Extract Hooks (Week 1)
**Goal**: Move all logic to custom hooks, keep App.tsx structure

**Files to create**:
1. `hooks/useTerminalManagement.ts` (~300 lines)
2. `hooks/useStoragePersistence.ts` (~250 lines)
3. `hooks/useAgentChats.ts` (~200 lines)
4. `hooks/useGitIntegration.ts` (~180 lines)
5. `hooks/useTerminalEvents.ts` (~150 lines)
6. `hooks/useDrawersState.ts` (~120 lines)

**Result**: App.tsx ~3,500 lines (intermediate state)

### Phase 2: Extract Components (Week 2)
**Goal**: Split UI into manageable components

**Files to create**:
1. `components/MainLayout.tsx` (~200 lines)
2. `components/TerminalContainer.tsx` (~180 lines)
3. `components/ChatContainer.tsx` (~150 lines)
4. `components/ModalsManager.tsx` (~100 lines)

**Result**: App.tsx ~1,200 lines (intermediate state)

### Phase 3: Context Refactoring (Week 3)
**Goal**: Clean up context providers, final polish

**Files to update/create**:
1. Update existing contexts or create new ones
2. Move remaining utilities to appropriate locations
3. Final cleanup of App.tsx

**Result**: App.tsx <300 lines ✅

---

## Detailed Implementation

### Week 1, Day 1-2: useTerminalManagement Hook

```typescript
// hooks/useTerminalManagement.ts (~300 lines)
import { useState, useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { TerminalInfo, CreateTerminalOptions, TerminalMetadata } from '../types'

export function useTerminalManagement() {
  const [terminals, setTerminals] = useState<TerminalInfo[]>([])
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null)

  // Create new terminal
  const createTerminal = useCallback(async (options: CreateTerminalOptions) => {
    try {
      const newTerminal = await invoke<TerminalInfo>('create_terminal', options)
      setTerminals(prev => [...prev, newTerminal])
      setActiveTerminalId(newTerminal.id)
      return newTerminal
    } catch (error) {
      console.error('Failed to create terminal:', error)
      throw error
    }
  }, [])

  // Delete terminal
  const deleteTerminal = useCallback(async (id: string) => {
    try {
      await invoke('kill_terminal', { id })
      setTerminals(prev => prev.filter(t => t.id !== id))

      // Switch to another terminal if deleting active one
      if (id === activeTerminalId) {
        const remaining = terminals.filter(t => t.id !== id)
        setActiveTerminalId(remaining[0]?.id || null)
      }
    } catch (error) {
      console.error('Failed to delete terminal:', error)
      throw error
    }
  }, [activeTerminalId, terminals])

  // Restore terminals from metadata
  const restoreTerminals = useCallback(async (metadata: TerminalMetadata[]) => {
    try {
      const restored = await Promise.all(
        metadata.map(meta => invoke<TerminalInfo>('restore_terminal', meta))
      )
      setTerminals(restored)

      // Restore active terminal
      const lastActive = metadata.find(m => m.wasActive)
      if (lastActive) {
        const restoredActive = restored.find(t => t.label === lastActive.label)
        setActiveTerminalId(restoredActive?.id || restored[0]?.id || null)
      }
    } catch (error) {
      console.error('Failed to restore terminals:', error)
    }
  }, [])

  // Update terminal properties
  const updateTerminal = useCallback((id: string, updates: Partial<TerminalInfo>) => {
    setTerminals(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates } : t
    ))
  }, [])

  // Get terminal by ID
  const getTerminal = useCallback((id: string) => {
    return terminals.find(t => t.id === id)
  }, [terminals])

  // Get active terminal
  const activeTerminal = terminals.find(t => t.id === activeTerminalId)

  return {
    terminals,
    activeTerminalId,
    activeTerminal,
    setActiveTerminalId,
    createTerminal,
    deleteTerminal,
    restoreTerminals,
    updateTerminal,
    getTerminal,
  }
}
```

### Week 1, Day 3: useStoragePersistence Hook

```typescript
// hooks/useStoragePersistence.ts (~250 lines)
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Store } from '@tauri-apps/plugin-store'

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

export function useStoragePersistence<T>(
  storeName: string,
  key: string,
  initialValue: T
) {
  const [data, setData] = useState<T>(initialValue)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Load from storage on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const store = await Store.load(storeName)
        const stored = await store.get<T>(key)

        if (stored !== null && stored !== undefined) {
          setData(stored)
        }
      } catch (err) {
        console.error(`Failed to load ${key} from ${storeName}:`, err)
        setError(err as Error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [storeName, key])

  // Save to storage with debounce
  const saveData = useMemo(
    () => debounce(async (value: T) => {
      try {
        const store = await Store.load(storeName)
        await store.set(key, value)
        await store.save()
        console.log(`Saved ${key} to ${storeName}`)
      } catch (err) {
        console.error(`Failed to save ${key} to ${storeName}:`, err)
        setError(err as Error)
      }
    }, 1000),
    [storeName, key]
  )

  // Auto-save whenever data changes
  useEffect(() => {
    if (!isLoading) {
      saveData(data)
    }
  }, [data, isLoading, saveData])

  // Manual save (immediate, no debounce)
  const save = useCallback(async (value?: T) => {
    try {
      const store = await Store.load(storeName)
      await store.set(key, value ?? data)
      await store.save()
    } catch (err) {
      console.error(`Failed to save ${key}:`, err)
      throw err
    }
  }, [storeName, key, data])

  // Clear storage
  const clear = useCallback(async () => {
    try {
      const store = await Store.load(storeName)
      await store.delete(key)
      await store.save()
      setData(initialValue)
    } catch (err) {
      console.error(`Failed to clear ${key}:`, err)
      throw err
    }
  }, [storeName, key, initialValue])

  return {
    data,
    setData,
    isLoading,
    error,
    save,
    clear,
  }
}
```

### Week 1, Day 4-5: Other Hooks

Continue pattern for:
- `useAgentChats.ts`
- `useGitIntegration.ts`
- `useTerminalEvents.ts`
- `useDrawersState.ts`

Each follows similar structure:
1. State management
2. Business logic
3. Side effects
4. Return public API

---

### Week 2: Extract Components

```typescript
// components/MainLayout.tsx (~200 lines)
export function MainLayout() {
  const { terminals, createTerminal, deleteTerminal } = useTerminalManagement()
  const { agentChats, createChat } = useAgentChats()
  const { openDrawer, closeDrawer, drawerState } = useDrawersState()
  const { gitStatus, refresh } = useGitIntegration()

  return (
    <div className="app-container">
      <TitleBar onSettingsClick={() => openDrawer('settings')} />

      <div className="main-content">
        <TerminalContainer
          terminals={terminals}
          onCreateTerminal={createTerminal}
          onDeleteTerminal={deleteTerminal}
        />

        <ChatContainer
          agentChats={agentChats}
          onCreateChat={createChat}
        />

        <SidePanel
          gitStatus={gitStatus}
          onRefreshGit={refresh}
        />
      </div>

      <ModalsManager
        drawerState={drawerState}
        onClose={closeDrawer}
      />
    </div>
  )
}
```

---

### Week 3: Final Cleanup

```typescript
// App.tsx - FINAL VERSION (~250 lines)
import { ErrorBoundary } from 'react-error-boundary'
import { useTerminalManagement } from './hooks/useTerminalManagement'
import { useStoragePersistence } from './hooks/useStoragePersistence'
import { useAgentChats } from './hooks/useAgentChats'
import { useGitIntegration } from './hooks/useGitIntegration'
import { MainLayout } from './components/MainLayout'
import { GitContext, TerminalContext, ChatContext } from './contexts'

function App() {
  // Initialize hooks
  const terminalManagement = useTerminalManagement()
  const gitIntegration = useGitIntegration()
  const agentChats = useAgentChats()

  // Storage persistence
  const terminalStorage = useStoragePersistence(
    'quack-terminals.json',
    'terminals',
    []
  )

  // Restore terminals on mount
  useEffect(() => {
    const restoreState = async () => {
      if (!terminalStorage.isLoading && terminalStorage.data.length > 0) {
        await terminalManagement.restoreTerminals(terminalStorage.data)
      }
    }
    restoreState()
  }, [terminalStorage.isLoading])

  // Save terminals on changes
  useEffect(() => {
    if (terminalManagement.terminals.length > 0) {
      const metadata = terminalManagement.terminals.map(t => ({
        id: t.id,
        label: t.label,
        cwd: t.cwd,
        color: t.color,
        wasActive: t.id === terminalManagement.activeTerminalId,
      }))
      terminalStorage.setData(metadata)
    }
  }, [terminalManagement.terminals, terminalManagement.activeTerminalId])

  // Error fallback
  const handleError = (error: Error) => {
    console.error('Application error:', error)
    // Could show error UI here
  }

  return (
    <ErrorBoundary fallbackRender={ErrorFallback} onError={handleError}>
      <GitContext.Provider value={gitIntegration}>
        <TerminalContext.Provider value={terminalManagement}>
          <ChatContext.Provider value={agentChats}>
            <MainLayout />
          </ChatContext.Provider>
        </TerminalContext.Provider>
      </GitContext.Provider>
    </ErrorBoundary>
  )
}

export default App
```

---

## Acceptance Criteria

### Phase 1 Complete
- [ ] 6 custom hooks created and working
- [ ] App.tsx reduced to ~3,500 lines
- [ ] All existing functionality works
- [ ] No regressions in tests
- [ ] Git commit: "refactor: extract custom hooks from App.tsx (Phase 1)"

### Phase 2 Complete
- [ ] 4 layout components created
- [ ] App.tsx reduced to ~1,200 lines
- [ ] UI renders correctly
- [ ] No performance regressions
- [ ] Git commit: "refactor: extract components from App.tsx (Phase 2)"

### Phase 3 Complete
- [ ] App.tsx reduced to <300 lines ✅
- [ ] All contexts properly organized
- [ ] Full test coverage for hooks (>80%)
- [ ] Documentation updated
- [ ] Git commit: "refactor: finalize App.tsx refactoring (Phase 3)"

### Overall Success
- [ ] App.tsx: 7,293 → <300 lines (-96%)
- [ ] All 37 existing tests still pass
- [ ] New tests for hooks created (>50 new tests)
- [ ] Performance metrics unchanged or improved
- [ ] Developer feedback positive (easier to work with)

---

## Testing Strategy

### Unit Tests for Hooks

```typescript
// hooks/useTerminalManagement.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTerminalManagement } from './useTerminalManagement'

describe('useTerminalManagement', () => {
  it('should create terminal', async () => {
    const { result } = renderHook(() => useTerminalManagement())

    await act(async () => {
      await result.current.createTerminal({
        cwd: '/test',
        label: 'Test Terminal',
      })
    })

    expect(result.current.terminals).toHaveLength(1)
    expect(result.current.terminals[0].label).toBe('Test Terminal')
  })

  it('should delete terminal', async () => {
    const { result } = renderHook(() => useTerminalManagement())

    // Create then delete
    await act(async () => {
      const terminal = await result.current.createTerminal({ cwd: '/test' })
      await result.current.deleteTerminal(terminal.id)
    })

    expect(result.current.terminals).toHaveLength(0)
  })

  // ... more tests
})
```

### Integration Tests

```typescript
// App.integration.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

describe('App - Post Refactoring', () => {
  it('should render main layout', () => {
    render(<App />)
    expect(screen.getByTestId('main-layout')).toBeInTheDocument()
  })

  it('should restore terminals on mount', async () => {
    // Mock storage with saved terminals
    const mockTerminals = [
      { id: '1', label: 'Terminal 1', cwd: '/test' }
    ]

    vi.mocked(Store.load).mockResolvedValue({
      get: vi.fn().mockResolvedValue(mockTerminals)
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Terminal 1')).toBeInTheDocument()
    })
  })

  // ... more integration tests
})
```

---

## Risks & Mitigation

### High Risk: Breaking Changes

**Risk**: Refactoring such a large file could break functionality

**Mitigation**:
- Phased approach (3 weeks, not all at once)
- Comprehensive testing at each phase
- Git commits after each phase for easy rollback
- Feature flags for testing new code paths

### Medium Risk: Performance Regression

**Risk**: Extra components/hooks could slow down rendering

**Mitigation**:
- Use React.memo for expensive components
- Profile with React DevTools before/after
- Benchmark key operations (terminal creation, etc.)
- Monitor bundle size (should stay same or reduce)

### Medium Risk: State Management Complexity

**Risk**: Context providers could cause unnecessary re-renders

**Mitigation**:
- Split contexts by domain (terminal, git, chat separate)
- Use context selectors to prevent over-rendering
- Consider Zustand if context becomes problematic
- Profile rendering with React DevTools

---

## Benefits

### Developer Experience
- ✅ Easier to understand codebase
- ✅ Faster to add new features
- ✅ Less merge conflicts
- ✅ Better onboarding for new developers
- ✅ Easier debugging (smaller functions)

### Code Quality
- ✅ Single Responsibility Principle followed
- ✅ Testable code (hooks are easy to test)
- ✅ Reusable logic (hooks can be used elsewhere)
- ✅ Better type safety (TypeScript can infer better)

### Performance
- ✅ Better code splitting potential
- ✅ Easier to optimize (smaller units)
- ✅ React can optimize smaller components better

---

## Related Tasks

### Prerequisites
- ✅ Message duplication fix (completed - test infrastructure ready)

### Enables Future Work
- Easier to add new terminal features
- Easier to add new chat features
- Better test coverage (hooks are testable)
- Performance optimizations (smaller units)

### Follow-up Tasks
- P0: ChatInput refactoring (similar pattern)
- P0: RepositoryGroup refactoring
- P1: Add comprehensive hook tests
- P2: Consider moving to Zustand for complex state

---

## Timeline

### Week 1 (Days 1-5)
- Day 1-2: useTerminalManagement + tests
- Day 3: useStoragePersistence + tests
- Day 4: useAgentChats + useGitIntegration + tests
- Day 5: useTerminalEvents + useDrawersState + tests

**Milestone**: App.tsx ~3,500 lines

### Week 2 (Days 6-10)
- Day 6-7: MainLayout + TerminalContainer components
- Day 8-9: ChatContainer + ModalsManager components
- Day 10: Integration testing + bug fixes

**Milestone**: App.tsx ~1,200 lines

### Week 3 (Days 11-15)
- Day 11-12: Context refactoring
- Day 13: Final cleanup + utilities
- Day 14: Comprehensive testing
- Day 15: Documentation + code review

**Milestone**: App.tsx <300 lines ✅

---

**Priority**: P0 Critical 🔴
**Estimated Completion**: 3 weeks
**ROI**: Massive (maintainability, testability, scalability)
**Blockers**: None (can start immediately)

---

🦆 **Impact**: Transform unmaintainable monster into clean, testable architecture!
