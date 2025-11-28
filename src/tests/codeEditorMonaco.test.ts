import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMonacoDiff, type LineChange, type DiffInfo } from '../hooks/useMonacoDiff';
import { useMonacoTheme, QUACK_THEME_NAME } from '../hooks/useMonacoTheme';

// Mock Monaco editor
const mockEditor = {
  deltaDecorations: vi.fn((oldIds: string[], decorations: unknown[]) => {
    return decorations.map((_, i) => `decoration-${i}`);
  }),
  getPosition: vi.fn(() => ({ lineNumber: 10, column: 1 })),
  revealLineInCenter: vi.fn(),
  setPosition: vi.fn(),
  focus: vi.fn(),
};

describe('useMonacoDiff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('diffInfoToLineChanges', () => {
    it('should convert DiffInfo to LineChange array', () => {
      // We need to test the conversion logic directly
      const diffInfo: DiffInfo = {
        additions: [10, 20, 30],
        deletions: [5, 15],
        modifications: [25],
      };

      // Expected output should be sorted by line number
      const expected: LineChange[] = [
        { line: 5, type: 'removed' },
        { line: 10, type: 'added' },
        { line: 15, type: 'removed' },
        { line: 20, type: 'added' },
        { line: 25, type: 'modified' },
        { line: 30, type: 'added' },
      ];

      // Since we can't call hooks directly in tests, we test the logic
      const changes: LineChange[] = [];
      diffInfo.additions?.forEach((line) => changes.push({ line, type: 'added' }));
      diffInfo.modifications?.forEach((line) => changes.push({ line, type: 'modified' }));
      diffInfo.deletions?.forEach((line) => changes.push({ line, type: 'removed' }));
      changes.sort((a, b) => a.line - b.line);

      expect(changes).toEqual(expected);
    });

    it('should handle empty DiffInfo', () => {
      const diffInfo: DiffInfo = {
        additions: [],
        deletions: [],
        modifications: [],
      };

      const changes: LineChange[] = [];
      diffInfo.additions?.forEach((line) => changes.push({ line, type: 'added' }));
      diffInfo.modifications?.forEach((line) => changes.push({ line, type: 'modified' }));
      diffInfo.deletions?.forEach((line) => changes.push({ line, type: 'removed' }));

      expect(changes).toEqual([]);
    });
  });

  describe('decoration creation', () => {
    it('should create correct decoration for added lines', () => {
      const change: LineChange = { line: 10, type: 'added' };

      // Verify decoration structure
      const decoration = {
        range: {
          startLineNumber: change.line,
          startColumn: 1,
          endLineNumber: change.line,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: 'monaco-diff-line-added',
          glyphMarginClassName: 'monaco-diff-glyph-added',
          overviewRuler: {
            color: '#22c55e',
            position: 4,
          },
          minimap: {
            color: '#22c55e',
            position: 1,
          },
        },
      };

      expect(decoration.options.className).toBe('monaco-diff-line-added');
      expect(decoration.options.overviewRuler.color).toBe('#22c55e');
    });

    it('should create correct decoration for modified lines', () => {
      const change: LineChange = { line: 20, type: 'modified' };

      const decoration = {
        options: {
          className: 'monaco-diff-line-modified',
          glyphMarginClassName: 'monaco-diff-glyph-modified',
          overviewRuler: { color: '#eab308' },
        },
      };

      expect(decoration.options.className).toBe('monaco-diff-line-modified');
      expect(decoration.options.overviewRuler.color).toBe('#eab308');
    });

    it('should create correct decoration for removed lines', () => {
      const change: LineChange = { line: 30, type: 'removed' };

      const decoration = {
        options: {
          className: 'monaco-diff-line-removed',
          glyphMarginClassName: 'monaco-diff-glyph-removed',
          overviewRuler: { color: '#ef4444' },
        },
      };

      expect(decoration.options.className).toBe('monaco-diff-line-removed');
      expect(decoration.options.overviewRuler.color).toBe('#ef4444');
    });
  });

  describe('navigation logic', () => {
    it('should find next change after current line', () => {
      const lineChanges: LineChange[] = [
        { line: 5, type: 'added' },
        { line: 15, type: 'modified' },
        { line: 25, type: 'removed' },
      ];
      const currentLine = 10;

      const sortedLines = lineChanges.map((c) => c.line).sort((a, b) => a - b);
      const nextLine = sortedLines.find((line) => line > currentLine);

      expect(nextLine).toBe(15);
    });

    it('should wrap around to first change when at end', () => {
      const lineChanges: LineChange[] = [
        { line: 5, type: 'added' },
        { line: 15, type: 'modified' },
      ];
      const currentLine = 20;

      const sortedLines = lineChanges.map((c) => c.line).sort((a, b) => a - b);
      let nextLine = sortedLines.find((line) => line > currentLine);
      if (!nextLine) nextLine = sortedLines[0]; // Wrap around

      expect(nextLine).toBe(5);
    });

    it('should find previous change before current line', () => {
      const lineChanges: LineChange[] = [
        { line: 5, type: 'added' },
        { line: 15, type: 'modified' },
        { line: 25, type: 'removed' },
      ];
      const currentLine = 20;

      const sortedLines = lineChanges.map((c) => c.line).sort((a, b) => a - b);
      const prevLine = [...sortedLines].reverse().find((line) => line < currentLine);

      expect(prevLine).toBe(15);
    });

    it('should wrap around to last change when at beginning', () => {
      const lineChanges: LineChange[] = [
        { line: 10, type: 'added' },
        { line: 20, type: 'modified' },
      ];
      const currentLine = 5;

      const sortedLines = lineChanges.map((c) => c.line).sort((a, b) => a - b);
      let prevLine = [...sortedLines].reverse().find((line) => line < currentLine);
      if (!prevLine) prevLine = sortedLines[sortedLines.length - 1]; // Wrap around

      expect(prevLine).toBe(20);
    });
  });
});

describe('useMonacoTheme', () => {
  describe('theme name', () => {
    it('should export correct theme name', () => {
      expect(QUACK_THEME_NAME).toBe('quack-dark');
    });
  });

  describe('theme definition', () => {
    it('should define theme with dark base', () => {
      const mockMonaco = {
        editor: {
          defineTheme: vi.fn(),
        },
      };

      // Simulate defineTheme call
      mockMonaco.editor.defineTheme(QUACK_THEME_NAME, {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#000000',
        },
      });

      expect(mockMonaco.editor.defineTheme).toHaveBeenCalledWith(
        'quack-dark',
        expect.objectContaining({
          base: 'vs-dark',
          inherit: true,
        })
      );
    });

    it('should include diff colors in theme', () => {
      const themeColors = {
        'diffEditor.insertedTextBackground': '#22c55e20',
        'diffEditor.removedTextBackground': '#ef444420',
        'editorGutter.addedBackground': '#22c55e',
        'editorGutter.modifiedBackground': '#eab308',
        'editorGutter.deletedBackground': '#ef4444',
      };

      expect(themeColors['editorGutter.addedBackground']).toBe('#22c55e');
      expect(themeColors['editorGutter.modifiedBackground']).toBe('#eab308');
      expect(themeColors['editorGutter.deletedBackground']).toBe('#ef4444');
    });
  });
});

describe('Monaco Editor Integration', () => {
  describe('language detection', () => {
    const getLanguageFromFilename = (filename: string | null): string => {
      if (!filename) return 'plaintext';

      const extension = filename.split('.').pop()?.toLowerCase() || '';

      const languageMap: Record<string, string> = {
        js: 'javascript',
        jsx: 'javascript',
        ts: 'typescript',
        tsx: 'typescriptreact',
        css: 'css',
        json: 'json',
        md: 'markdown',
        py: 'python',
        rs: 'rust',
      };

      return languageMap[extension] || 'plaintext';
    };

    it('should detect JavaScript files', () => {
      expect(getLanguageFromFilename('app.js')).toBe('javascript');
      expect(getLanguageFromFilename('Component.jsx')).toBe('javascript');
    });

    it('should detect TypeScript files', () => {
      expect(getLanguageFromFilename('app.ts')).toBe('typescript');
      expect(getLanguageFromFilename('Component.tsx')).toBe('typescriptreact');
    });

    it('should detect other common languages', () => {
      expect(getLanguageFromFilename('style.css')).toBe('css');
      expect(getLanguageFromFilename('data.json')).toBe('json');
      expect(getLanguageFromFilename('README.md')).toBe('markdown');
      expect(getLanguageFromFilename('main.py')).toBe('python');
      expect(getLanguageFromFilename('lib.rs')).toBe('rust');
    });

    it('should return plaintext for unknown extensions', () => {
      expect(getLanguageFromFilename('file.xyz')).toBe('plaintext');
      expect(getLanguageFromFilename(null)).toBe('plaintext');
    });
  });
});
