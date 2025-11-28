# Project Terminal Rename Functionality - Test Documentation

## Overview

Comprehensive test suite for the terminal rename functionality in `ProjectTerminalItem.tsx`. Tests verify the complete rename workflow including context menu behavior, edit mode, input validation, and store integration.

**Test File**: `/src/tests/projectTerminalItem.test.ts`

**Test Results**: 27 tests, all passing

**Test Duration**: ~5ms

## Test Coverage Summary

### 1. Rename Logic (10 tests)

Tests for the core rename logic including validation and processing:

- **Whitespace Trimming**: Verifies that leading/trailing whitespace is removed
- **Empty Name Rejection**: Ensures empty strings are rejected
- **Whitespace-Only Rejection**: Ensures strings with only spaces are rejected
- **Unchanged Name Rejection**: Prevents saving when name hasn't changed
- **Valid Name Acceptance**: Allows valid new names
- **Trimmed Name Acceptance**: Accepts names that differ after trimming
- **Special Characters**: Handles names with `-`, `_`, `!`, etc.
- **Unicode Support**: Correctly processes international characters and emojis
- **Long Names**: Handles names with 1000+ characters
- **Control Characters**: Properly handles tabs and newlines

### 2. Context Menu State (4 tests)

Tests for context menu visibility and positioning:

- **Initial State**: Menu starts hidden at (0, 0)
- **Position Tracking**: Correctly stores x/y coordinates
- **Negative Coordinates**: Handles off-screen positions
- **Large Coordinates**: Handles positions beyond viewport

### 3. Store Integration (5 tests)

Tests for Zustand store interactions:

- **Update Call**: Verifies `updateProjectTerminal` is called with correct parameters
- **Empty Name Prevention**: Store is not called for empty names
- **Unchanged Name Prevention**: Store is not called when name is unchanged
- **Whitespace Prevention**: Store is not called for whitespace-only names
- **Non-Unique Names**: Allows multiple terminals with the same name

### 4. Edit Mode Workflow (4 tests)

Integration tests simulating complete user workflows:

- **Complete Rename**: Full workflow from context menu to save
- **ESC Cancellation**: Pressing ESC restores original name
- **Click Outside Save**: Clicking outside input saves changes
- **Click Outside with Empty**: Empty input restores original name

### 5. Edge Cases (4 tests)

Tests for unusual scenarios and boundary conditions:

- **Null/Undefined**: Runtime behavior with invalid input types
- **Full Terminal Object**: Handles all optional properties (status, etc.)
- **Minimal Terminal**: Handles terminals without optional fields
- **Rapid Renames**: Multiple consecutive renames work correctly

## Test Architecture

### Helper Functions

The test suite extracts and tests the core logic functions separately from React components:

```typescript
// Name processing
function processEditedName(editName: string): string

// Validation logic
function shouldSaveName(editName: string, originalName: string): boolean

// State management
function createContextMenuState(visible, x, y): ContextMenuState
```

### Mock Strategy

Uses Vitest's `vi.fn()` to mock the Zustand store action:

```typescript
const mockUpdateProjectTerminal = vi.fn();
```

This allows verification of store calls without requiring the full store implementation.

## Component Behavior

### Rename Workflow

1. **Trigger**: Right-click terminal item
2. **Context Menu**: Shows "Rename" option
3. **Edit Mode**: Input appears with current name selected
4. **User Input**: Types new name
5. **Save**: Press ENTER or click outside
6. **Validation**: Name is trimmed and validated
7. **Store Update**: If valid, `updateProjectTerminal` is called
8. **Exit**: Edit mode closes

### Cancel Workflow

1. **Trigger**: Right-click and select "Rename"
2. **Edit Mode**: Input appears
3. **Cancel**: Press ESC key
4. **Restore**: Original name is restored
5. **Exit**: Edit mode closes without saving

### Validation Rules

- **Empty names**: Rejected (original name restored)
- **Whitespace-only**: Rejected (original name restored)
- **Unchanged names**: Not saved (no store update)
- **Valid names**: Trimmed and saved to store

## Running the Tests

### Run Project Terminal Tests Only

```bash
npm test -- projectTerminalItem.test.ts
```

### Run with Verbose Output

```bash
npm test -- projectTerminalItem.test.ts --reporter=verbose
```

### Run with Coverage

```bash
npm run test:coverage -- projectTerminalItem.test.ts
```

### Watch Mode

```bash
npm run test:watch -- projectTerminalItem.test.ts
```

## Test Output Example

```
✓ src/tests/projectTerminalItem.test.ts (27 tests) 5ms
  ✓ ProjectTerminalItem - Rename Logic (10 tests)
    ✓ should trim whitespace from name before saving
    ✓ should reject empty name
    ✓ should reject whitespace-only name
    ✓ should reject name that has not changed
    ✓ should accept valid new name
    ✓ should accept name with trimmed whitespace if different from original
    ✓ should handle name with special characters
    ✓ should handle unicode characters in name
    ✓ should handle very long names
    ✓ should handle tabs and newlines in name
  ✓ ProjectTerminalItem - Context Menu State (4 tests)
    ✓ should initialize with menu hidden
    ✓ should create visible menu at specific coordinates
    ✓ should handle negative coordinates
    ✓ should handle large coordinates
  ✓ ProjectTerminalItem - Store Integration (5 tests)
    ✓ should call updateProjectTerminal with trimmed name
    ✓ should not call updateProjectTerminal if name is empty
    ✓ should not call updateProjectTerminal if name is unchanged
    ✓ should not call updateProjectTerminal if name is whitespace-only
    ✓ should handle multiple terminals with same name
  ✓ ProjectTerminalItem - Edit Mode Workflow (4 tests)
    ✓ should simulate complete rename workflow
    ✓ should simulate cancel workflow with ESC key
    ✓ should simulate click outside to save
    ✓ should restore original name when clicking outside with empty input
  ✓ ProjectTerminalItem - Edge Cases (4 tests)
    ✓ should handle null or undefined terminal name gracefully
    ✓ should handle terminal with all properties
    ✓ should handle terminal without optional status
    ✓ should handle rapid consecutive renames

Test Files  1 passed (1)
Tests       27 passed (27)
Duration    232ms
```

## Future Enhancements

### Potential Additional Tests

1. **React Component Tests**: Use React Testing Library to test UI interactions
2. **Keyboard Navigation**: Test Tab, Shift+Tab for accessibility
3. **Concurrent Edits**: Multiple users editing different terminals
4. **Performance**: Test with 100+ terminals
5. **Store Persistence**: Verify renames persist after app restart
6. **Undo/Redo**: Test rename history if implemented

### Integration Tests

Consider adding E2E tests with Playwright:

```typescript
test('rename terminal via context menu', async ({ page }) => {
  await page.click('.project-terminal-item', { button: 'right' });
  await page.click('text=Rename');
  await page.fill('input', 'New Name');
  await page.press('input', 'Enter');
  await expect(page.locator('.terminal-item-name')).toHaveText('New Name');
});
```

## Related Files

- **Component**: `/src/components/ProjectTerminalItem.tsx`
- **Store**: `/src/stores/terminalStore.ts`
- **Types**: `/src/types.ts` (ProjectTerminal interface)
- **Tests**: `/src/tests/projectTerminalItem.test.ts`

## Maintenance Notes

- **Update tests** when rename logic changes
- **Add tests** for new validation rules
- **Keep helpers in sync** with component implementation
- **Run tests** before committing changes to ProjectTerminalItem.tsx

## References

- Vitest Documentation: https://vitest.dev/
- Testing Best Practices: `/docs/03-testing/TEST_MODE.md`
- Component Architecture: `/docs/01-architecture.md`

---

**Last Updated**: 2025-11-28

**Test Status**: All 27 tests passing

**Maintainer**: Test Engineer (Claude Agent SDK)
