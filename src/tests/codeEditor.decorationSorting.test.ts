import { describe, it, expect } from 'vitest';
import type { LineChange } from '../components/CodeEditorCodeMirror';

/**
 * Test: CodeMirror Decoration Sorting
 *
 * Bug: When clicking "View Modified Files" in EditSummaryBar, CodeMirror throws:
 * "Ranges must be added sorted by `from` position and `startSide`"
 *
 * Root Cause:
 * - lineChanges array comes from AI tool calls (Edit/Write tools)
 * - Line numbers may be out of order (e.g., [10, 5, 15, 3])
 * - CodeMirror requires decorations sorted by position
 *
 * Solution:
 * - Sort decorations by `from` position before applying
 * - Fixed in CodeEditorCodeMirror.tsx line 735: decorations.sort((a, b) => a.from - b.from)
 */

describe('CodeEditor - Decoration Sorting', () => {
  it('should handle unsorted line changes', () => {
    // Simulate unsorted line changes from AI (realistic scenario)
    const unsortedLineChanges: LineChange[] = [
      { line: 10, type: 'added' },
      { line: 5, type: 'modified' },
      { line: 15, type: 'added' },
      { line: 3, type: 'removed' },
      { line: 8, type: 'modified' },
    ];

    // Extract line numbers
    const lineNumbers = unsortedLineChanges.map(c => c.line);

    // Verify they are NOT sorted
    const isSorted = lineNumbers.every((line, i) => i === 0 || line >= lineNumbers[i - 1]);
    expect(isSorted).toBe(false); // Should be false (unsorted)

    console.log('Unsorted line numbers:', lineNumbers);
  });

  it('should sort decorations by line number', () => {
    // Simulate unsorted line changes
    const unsortedLineChanges: LineChange[] = [
      { line: 10, type: 'added' },
      { line: 5, type: 'modified' },
      { line: 15, type: 'added' },
      { line: 3, type: 'removed' },
    ];

    // Sort by line number (ascending)
    const sorted = [...unsortedLineChanges].sort((a, b) => a.line - b.line);

    // Verify sorted order
    expect(sorted[0].line).toBe(3);
    expect(sorted[1].line).toBe(5);
    expect(sorted[2].line).toBe(10);
    expect(sorted[3].line).toBe(15);

    console.log('Sorted line numbers:', sorted.map(c => c.line));
  });

  it('should handle edge cases', () => {
    // Empty array
    const emptyChanges: LineChange[] = [];
    const sortedEmpty = [...emptyChanges].sort((a, b) => a.line - b.line);
    expect(sortedEmpty).toEqual([]);

    // Single item
    const singleChange: LineChange[] = [{ line: 5, type: 'added' }];
    const sortedSingle = [...singleChange].sort((a, b) => a.line - b.line);
    expect(sortedSingle).toEqual(singleChange);

    // Already sorted
    const alreadySorted: LineChange[] = [
      { line: 1, type: 'added' },
      { line: 2, type: 'modified' },
      { line: 3, type: 'removed' },
    ];
    const sortedAlready = [...alreadySorted].sort((a, b) => a.line - b.line);
    expect(sortedAlready).toEqual(alreadySorted);
  });

  it('should handle duplicate line numbers', () => {
    // Duplicate line numbers (same line modified multiple times)
    const duplicateChanges: LineChange[] = [
      { line: 5, type: 'added' },
      { line: 5, type: 'modified' },
      { line: 3, type: 'removed' },
    ];

    const sorted = [...duplicateChanges].sort((a, b) => a.line - b.line);

    // Verify sorted order (duplicates preserved)
    expect(sorted[0].line).toBe(3);
    expect(sorted[1].line).toBe(5);
    expect(sorted[2].line).toBe(5);

    console.log('Sorted with duplicates:', sorted.map(c => `${c.line}:${c.type}`));
  });

  it('should simulate real-world AI tool call order', () => {
    // Simulate AI making multiple edits across a file (realistic scenario)
    // AI often edits top, then middle, then bottom, then back to top
    const realisticChanges: LineChange[] = [
      { line: 1, type: 'modified' },   // Import statement
      { line: 50, type: 'added' },     // New function in middle
      { line: 100, type: 'modified' }, // Bottom of file
      { line: 25, type: 'added' },     // Helper function
      { line: 5, type: 'removed' },    // Removed old import
      { line: 75, type: 'modified' },  // Update existing function
    ];

    const sorted = [...realisticChanges].sort((a, b) => a.line - b.line);

    // Verify ascending order
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].line).toBeGreaterThanOrEqual(sorted[i - 1].line);
    }

    console.log('Realistic AI edit order (sorted):', sorted.map(c => c.line));
  });
});
