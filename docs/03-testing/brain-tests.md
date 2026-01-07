# Quack Brain Testing Documentation

**Date**: 2025-01-05
**Status**: Complete
**Test Coverage**: 106 tests (100% passing)

## Overview

Comprehensive test suite for Quack Brain (unified memory system) covering types, service layer, and React hooks. All tests use Vitest with mocked Tauri backend.

## Test Files

### 1. `src/tests/brain.test.ts` - Type Validation Tests

**Purpose**: Unit tests for Brain type definitions and validation
**Tests**: 44 passing

**Coverage**:
- **BrainEntity**: Structure, project scoping, global entities, multiple observations
- **BrainRelation**: Entity linking, relation types (belongs_to_project, depends_on, relates_to)
- **CreateEntityInput**: Required fields, optional projectId, observations handling
- **EntityFilters**: Project filtering, type filtering, search queries, combined filters
- **BrainObservation**: Structure, timestamp format support
- **BrainGraph**: Entities and relations structure, empty graph handling

**Entity Types Tested**:
- preference
- fact
- decision
- pattern
- bug_fix
- person
- project
- diary
- document
- gotcha
- tool
- technology

**Relation Types Tested**:
- belongs_to_project
- relates_to
- depends_on
- created_by
- uses
- documented_in

### 2. `src/tests/brainService.test.ts` - Service Integration Tests

**Purpose**: Integration tests for Brain service with mocked Tauri invoke
**Tests**: 34 passing

**Coverage**:

#### Initialization
- `initBrain()` - Database initialization
- Error handling for initialization failures

#### CRUD Operations
- `createEntity()` - Create with observations, project scoping
- `updateEntity()` - Update name and entity type
- `deleteEntity()` - Delete by ID with cascading
- `getEntity()` - Fetch by ID with observations
- `listEntities()` - List with filters (projectId, entityType, combined)

#### Search
- `searchEntities()` - Full-text search using FTS5
- Empty result handling

#### Observations
- `addObservation()` - Add observation with timestamp support
- `deleteObservation()` - Delete by ID

#### Relations
- `createRelation()` - Create typed relations between entities
- `deleteRelation()` - Delete by ID
- Support for `belongs_to_project` relation type

#### Graph Operations
- `getGraph()` - Fetch complete knowledge graph
- Empty graph handling

#### Project Management
- `registerProject()` - Register new project or update existing
- Path uniqueness enforcement

#### Event Handling
- `BRAIN_UPDATED_EVENT` dispatched after all mutations
- Event listeners can trigger UI refresh

### 3. `src/tests/useBrain.test.ts` - React Hook Tests

**Purpose**: Tests for React hooks providing access to Quack Brain
**Tests**: 28 passing

**Coverage**:

#### `useBrain` Hook
- **Basic Functionality**:
  - Auto-load on mount (when `autoLoad: true`)
  - No load on mount (when `autoLoad: false`)
  - Initial state correctness

- **Filters**:
  - Filter by projectId
  - Filter by entityType
  - Combined filters

- **Event Handling**:
  - Refresh on BRAIN_UPDATED_EVENT
  - Event listener cleanup on unmount

- **Error Handling**:
  - Graceful error handling with error state
  - Error clearing on successful refresh

- **Operations**:
  - createEntity() - Create new entity
  - updateEntity() - Update existing entity
  - deleteEntity() - Delete entity
  - search() - Search entities
  - addObservation() - Add observation to entity

- **Manual Refresh**:
  - Manual refresh trigger
  - Loading state during refresh

#### `useBrainSearch` Hook
- Initialize with empty query and results
- Debounced search (300ms delay)
- No search for empty query
- Graceful error handling
- Debounce multiple quick queries
- isSearching state during search
- Manual search trigger

#### `useBrainGlobal` Hook
- Load global entities on mount
- Refresh on BRAIN_UPDATED_EVENT
- Error handling
- Manual refresh

## Running Tests

```bash
# Run all brain tests
npm test -- brain

# Run specific test file
npm test -- brain.test.ts
npm test -- brainService.test.ts
npm test -- useBrain.test.ts

# Run with coverage
npm run test:coverage -- brain

# Watch mode (auto-rerun on changes)
npm run test:watch -- brain

# UI mode (interactive debugging)
npm run test:ui
```

## Test Architecture

### Mocking Strategy

#### Tauri Invoke Mock
```typescript
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: any[]) => mockInvoke(...args),
}));
```

#### Brain Service Mock
```typescript
vi.mock('../services/brainService', () => {
  return {
    brainService: {
      listEntities: vi.fn(),
      getGraph: vi.fn(),
      createEntity: vi.fn(),
      // ... all service methods
    },
    BRAIN_UPDATED_EVENT: 'quack-brain-updated',
  };
});
```

### Test Data Factories

```typescript
// Example entity
const mockEntity: BrainEntity = {
  id: 'ent_123',
  name: 'Test Entity',
  entityType: 'fact',
  observations: [
    { id: 'obs_1', content: 'Test observation', createdAt: Date.now() }
  ],
  projectId: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  mdFilePath: null,
};

// Example graph
const mockGraph: BrainGraph = {
  entities: [mockEntity],
  relations: [
    {
      id: 'rel_1',
      fromEntityId: 'ent_1',
      toEntityId: 'ent_2',
      relationType: 'relates_to',
      createdAt: Date.now(),
    },
  ],
};
```

## Key Testing Patterns

### 1. Async State Testing
```typescript
const { result } = renderHook(() => useBrain({ autoLoad: true }));

await waitFor(() => {
  expect(result.current.isLoading).toBe(false);
});

expect(result.current.entities).toHaveLength(1);
```

### 2. Event Testing
```typescript
const eventSpy = vi.fn();
window.addEventListener(BRAIN_UPDATED_EVENT, eventSpy);

await createEntity({ name: 'Test', entityType: 'fact', observations: [] });

expect(eventSpy).toHaveBeenCalled();

window.removeEventListener(BRAIN_UPDATED_EVENT, eventSpy);
```

### 3. Error Handling Testing
```typescript
mockInvoke.mockRejectedValueOnce(new Error('DB error'));

const { result } = renderHook(() => useBrain({ autoLoad: true }));

await waitFor(() => {
  expect(result.current.error).toBe('DB error');
});
```

### 4. Debounce Testing
```typescript
const { result } = renderHook(() => useBrainSearch(''));

act(() => {
  result.current.setQuery('test');
});

// Wait for debounce (300ms)
await waitFor(
  () => {
    expect(mockBrainService.searchEntities).toHaveBeenCalledWith('test');
  },
  { timeout: 500 }
);
```

## Test Coverage Goals

| Component | Line Coverage | Branch Coverage | Function Coverage |
|-----------|--------------|-----------------|-------------------|
| Types | 100% | 100% | N/A |
| Service | 95%+ | 90%+ | 100% |
| Hooks | 90%+ | 85%+ | 95%+ |

## Next Steps

### Phase 2: E2E Testing (Future)
- Test with real Tauri backend (SQLite database)
- Test database migrations
- Test file system operations (markdown sync)
- Test concurrent operations

### Phase 3: Performance Testing (Future)
- Benchmark search operations (target: <100ms)
- Test with large datasets (1000+ entities)
- Test memory usage
- Test concurrent updates

### Phase 4: Integration Testing (Future)
- Test with MCP Memory import
- Test Obsidian export
- Test semantic search integration

## Known Limitations

1. **Tauri Backend Mocked**: Tests use mocked Tauri invoke, not real SQLite
2. **No Database Testing**: No tests for actual database operations
3. **No File I/O Testing**: Markdown sync not tested
4. **No Concurrent Operations**: Race conditions not tested

## Best Practices Followed

1. **Isolation**: Each test is independent with proper setup/teardown
2. **Mocking**: External dependencies (Tauri, browser APIs) are mocked
3. **Async Handling**: Proper use of `waitFor()` and `act()` for React hooks
4. **Type Safety**: All test data uses TypeScript types
5. **Descriptive Names**: Test names clearly describe what they test
6. **Error Testing**: Both success and error paths are tested
7. **Event Testing**: Event dispatching and listening are tested

## Common Patterns

### Testing Service Operations
```typescript
it('should create entity', async () => {
  const mockEntity: BrainEntity = { /* ... */ };
  mockInvoke.mockResolvedValueOnce(mockEntity);

  const result = await createEntity(input);

  expect(mockInvoke).toHaveBeenCalledWith('brain_create_entity', { input });
  expect(result.name).toBe('Test Entity');
});
```

### Testing React Hooks
```typescript
it('should load entities on mount', async () => {
  mockBrainService.listEntities.mockResolvedValue(mockEntities);
  mockBrainService.getGraph.mockResolvedValue(mockGraph);

  const { result } = renderHook(() => useBrain({ autoLoad: true }));

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.entities).toHaveLength(1);
});
```

### Testing Event Dispatching
```typescript
it('should dispatch event on mutation', async () => {
  mockInvoke.mockResolvedValueOnce(mockEntity);

  const eventSpy = vi.fn();
  window.addEventListener(BRAIN_UPDATED_EVENT, eventSpy);

  await createEntity(input);

  expect(eventSpy).toHaveBeenCalled();

  window.removeEventListener(BRAIN_UPDATED_EVENT, eventSpy);
});
```

## Debugging Tests

### Run Single Test
```bash
npm test -- brain.test.ts -t "should create entity"
```

### UI Mode (Visual Debugging)
```bash
npm run test:ui
```

### Verbose Output
```bash
npm test -- brain --reporter=verbose
```

### Coverage Report
```bash
npm run test:coverage -- brain
# Open coverage/index.html in browser
```

## Maintenance

- **Update tests when adding features**: New Brain features require new tests
- **Update mocks when changing Tauri commands**: Keep mock interface in sync
- **Run tests before committing**: Ensure no regressions
- **Review test output**: Check for console warnings/errors

## References

- **Vitest Docs**: https://vitest.dev/
- **Testing Library**: https://testing-library.com/docs/react-testing-library/intro/
- **Brain Types**: `src/types/brain.ts`
- **Brain Service**: `src/services/brainService.ts`
- **Brain Hooks**: `src/hooks/useBrain.ts`

---

**Last Updated**: 2025-01-05
**Test Count**: 106 tests
**Status**: All passing ✅
