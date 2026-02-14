---
type: pattern
created: 2026-01-10
---

# Task Switch Performance Optimization

Optimized task switch from 1-2 seconds to ~300ms.

**Problem**: `openTaskTab()` executed sequential blocking operations (loadDirectory, Store.load, ensureListenerReady).

**Solutions**:
1. **Optimistic UI** -- tab appears IMMEDIATELY, data loads in background
2. **Promise.all()** -- parallelize loadDirectory(), chat loading, and saving previous messages
3. **Store caching** -- `getCachedStore()` at module level avoids repeated `Store.load()`
4. **Memoization** -- React.memo() on TasksSidebarSection and TaskItem with custom comparison

**Pattern**: Optimistic UI + Parallel I/O + Component Memoization

**Files**: App.tsx (openTaskTab), TasksSidebarSection.tsx (memo)

**Tests**: openTaskTab.test.ts with 3 test cases
