# Bug Fix: CodeMirror Decoration Sorting

**Date**: 2025-01-18
**Status**: ✅ Fixed
**Severity**: High (Crash on "View Modified Files")
**Component**: `CodeEditorCodeMirror.tsx`

---

## Problem

When clicking **"View Modified Files"** in the `EditSummaryBar` (bottom of chat view), the app crashed with this error:

```
Error: Ranges must be added sorted by `from` position and `startSide`
@tauri://localhost/assets/drawers-modals-I3wk2YUl.js:1:192486
```

**User Flow:**
1. AI assistant makes multiple file edits (using `Edit` or `Write` tools)
2. User sees "Files Modified (N)" bar at bottom of chat
3. User clicks "View Modified Files" or clicks on a specific file
4. **❌ App crashes** with CodeMirror range error

---

## Root Cause

**CodeMirror requires decorations (line highlights) to be sorted by position**, but we were adding them in the order they appeared in the AI's tool calls.

### The Problem Code

In `CodeEditorCodeMirror.tsx` (lines 661-737):

```typescript
// Apply diff decorations when lineChanges or diffInfo changes
useEffect(() => {
  const decorations: Range<Decoration>[] = [];

  // Apply lineChanges if provided
  if (lineChanges && lineChanges.length > 0) {
    lineChanges.forEach((change) => {
      // Line numbers could be: [10, 5, 15, 3, 8] (UNSORTED!)
      decorations.push(decoration.range(line.from));
    });
  }

  // ❌ PROBLEM: decorations are NOT sorted!
  viewRef.current.dispatch({
    effects: setDiffDecorations.of(decorations) // Crash if not sorted!
  });
}, [lineChanges, diffInfo]);
```

### Why It Happened

- **AI makes edits in logical order** (e.g., imports first, functions later, then back to top)
- Line changes arrive like: `[10, 5, 15, 3, 8]` (top → middle → bottom → back to top)
- CodeMirror expects: `[3, 5, 8, 10, 15]` (ascending order)
- **Result:** `RangeSet` throws error when ranges are out of order

---

## Solution

**Sort decorations by `from` position BEFORE passing to CodeMirror.**

### The Fix

In `CodeEditorCodeMirror.tsx` (line 735):

```typescript
// ⚠️ IMPORTANT: CodeMirror requires decorations to be sorted by `from` position
// If decorations are not sorted, it throws: "Ranges must be added sorted by `from` position and `startSide`"
decorations.sort((a, b) => a.from - b.from);

// Apply decorations
viewRef.current.dispatch({
  effects: setDiffDecorations.of(decorations)
});
```

**Key Points:**
- ✅ Sort decorations by `from` position (ascending)
- ✅ Handles edge cases: empty array, single item, duplicates
- ✅ Works with both `lineChanges` and `diffInfo` (legacy)
- ✅ No performance impact (sorting is O(n log n), n is typically < 100)

---

## Test Coverage

Created comprehensive test suite: `src/tests/codeEditor.decorationSorting.test.ts`

**Test Cases:**
1. ✅ Handle unsorted line changes
2. ✅ Sort decorations by line number
3. ✅ Handle edge cases (empty, single, already sorted)
4. ✅ Handle duplicate line numbers
5. ✅ Simulate real-world AI tool call order

**Test Results:**
```
✓ src/tests/codeEditor.decorationSorting.test.ts (5 tests) 4ms
  Test Files  1 passed (1)
  Tests       5 passed (5)
```

---

## Verification Steps

1. **Build the app:**
   ```bash
   npm run dev
   ```

2. **Test the fix:**
   - Open AI chat
   - Ask AI to make multiple file edits (e.g., "Update the header component")
   - Wait for AI to finish editing
   - Click "View Modified Files" in the bottom bar
   - ✅ File should open without crash
   - ✅ Modified lines should be highlighted (green/yellow/red borders)

3. **Test edge cases:**
   - Single file edit
   - Multiple files edited
   - Large files (> 500 lines)
   - Files edited at top, middle, and bottom

---

## Impact

**Before Fix:**
- ❌ "View Modified Files" crashed 100% of the time
- ❌ Users couldn't review AI changes
- ❌ Poor UX for file editing workflow

**After Fix:**
- ✅ "View Modified Files" works reliably
- ✅ Smooth diff highlighting
- ✅ Better AI editing experience

---

## Related Components

- `CodeEditorCodeMirror.tsx` - Main fix location
- `EditSummaryBar.tsx` - Triggers file opening
- `FilePreviewDrawer.tsx` - Displays file with decorations
- `ChatView.tsx` - Computes line changes from AI tool calls

---

## Future Improvements

1. **Better diff algorithm** - Current implementation is basic line-by-line diff
2. **Inline diff** - Show exact character changes within lines (like GitHub)
3. **Diff navigation** - Jump between changes with keyboard shortcuts
4. **Diff collapse** - Collapse unchanged sections for large files

---

## Lessons Learned

1. **Always check library requirements** - CodeMirror docs mention sorting requirement
2. **Test with real AI data** - AI tool calls have unpredictable ordering
3. **Add defensive sorting** - Better to sort unnecessarily than crash
4. **Write tests for edge cases** - Empty, single, duplicates, large datasets

---

## References

- **CodeMirror Docs**: [RangeSet](https://codemirror.net/docs/ref/#state.RangeSet)
- **Error Location**: `@codemirror/view` package, `Decoration.set()` method
- **Fix Commit**: (Will be added after commit)

---

**Status**: ✅ Fixed and Tested
**Verified By**: Alek Dobrohotov
**Date**: 2025-01-18
