import { useCallback, useRef } from 'react';
import type { editor } from 'monaco-editor';

export interface LineChange {
  line: number;
  type: 'added' | 'modified' | 'removed';
}

export interface DiffInfo {
  additions: number[];
  deletions: number[];
  modifications: number[];
}

interface DiffDecoration {
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  options: editor.IModelDecorationOptions;
}

/**
 * Hook to manage diff decorations in Monaco Editor
 * Provides gutter indicators and line highlighting for changes
 */
export function useMonacoDiff() {
  const decorationsRef = useRef<string[]>([]);

  /**
   * Convert LineChange[] to decoration descriptors
   */
  const createDecorations = useCallback((lineChanges: LineChange[]): DiffDecoration[] => {
    return lineChanges.map((change) => {
      let glyphMarginClassName: string;
      let className: string;
      let overviewRulerColor: string;

      switch (change.type) {
        case 'added':
          glyphMarginClassName = 'monaco-diff-glyph-added';
          className = 'monaco-diff-line-added';
          overviewRulerColor = '#22c55e';
          break;
        case 'modified':
          glyphMarginClassName = 'monaco-diff-glyph-modified';
          className = 'monaco-diff-line-modified';
          overviewRulerColor = '#eab308';
          break;
        case 'removed':
          glyphMarginClassName = 'monaco-diff-glyph-removed';
          className = 'monaco-diff-line-removed';
          overviewRulerColor = '#ef4444';
          break;
      }

      return {
        range: {
          startLineNumber: change.line,
          startColumn: 1,
          endLineNumber: change.line,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className,
          glyphMarginClassName,
          overviewRuler: {
            color: overviewRulerColor,
            position: 4, // Full width in overview ruler
          },
          minimap: {
            color: overviewRulerColor,
            position: 1, // Inline in minimap
          },
        },
      };
    });
  }, []);

  /**
   * Convert DiffInfo to LineChange[] format
   */
  const diffInfoToLineChanges = useCallback((diffInfo: DiffInfo): LineChange[] => {
    const changes: LineChange[] = [];

    diffInfo.additions?.forEach((line) => {
      changes.push({ line, type: 'added' });
    });

    diffInfo.modifications?.forEach((line) => {
      changes.push({ line, type: 'modified' });
    });

    diffInfo.deletions?.forEach((line) => {
      changes.push({ line, type: 'removed' });
    });

    // Sort by line number
    return changes.sort((a, b) => a.line - b.line);
  }, []);

  /**
   * Apply diff decorations to editor
   */
  const applyDecorations = useCallback((
    editorInstance: editor.IStandaloneCodeEditor,
    lineChanges?: LineChange[],
    diffInfo?: DiffInfo | null
  ) => {
    if (!editorInstance) return;

    // Convert diffInfo to lineChanges if needed
    let changes = lineChanges || [];
    if (!changes.length && diffInfo) {
      changes = diffInfoToLineChanges(diffInfo);
    }

    const decorations = createDecorations(changes);

    // Apply decorations and save IDs for cleanup
    decorationsRef.current = editorInstance.deltaDecorations(
      decorationsRef.current,
      decorations
    );
  }, [createDecorations, diffInfoToLineChanges]);

  /**
   * Clear all diff decorations
   */
  const clearDecorations = useCallback((editorInstance: editor.IStandaloneCodeEditor) => {
    if (!editorInstance) return;

    decorationsRef.current = editorInstance.deltaDecorations(
      decorationsRef.current,
      []
    );
  }, []);

  /**
   * Navigate to next/previous change
   */
  const navigateToChange = useCallback((
    editorInstance: editor.IStandaloneCodeEditor,
    lineChanges: LineChange[],
    direction: 'next' | 'previous'
  ) => {
    if (!editorInstance || !lineChanges.length) return;

    const currentLine = editorInstance.getPosition()?.lineNumber || 1;
    const sortedLines = lineChanges.map((c) => c.line).sort((a, b) => a - b);

    let targetLine: number | undefined;

    if (direction === 'next') {
      targetLine = sortedLines.find((line) => line > currentLine);
      if (!targetLine) targetLine = sortedLines[0]; // Wrap around
    } else {
      targetLine = [...sortedLines].reverse().find((line) => line < currentLine);
      if (!targetLine) targetLine = sortedLines[sortedLines.length - 1]; // Wrap around
    }

    if (targetLine) {
      editorInstance.revealLineInCenter(targetLine);
      editorInstance.setPosition({ lineNumber: targetLine, column: 1 });
      editorInstance.focus();
    }
  }, []);

  return {
    applyDecorations,
    clearDecorations,
    navigateToChange,
    diffInfoToLineChanges,
  };
}

export default useMonacoDiff;
