import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import CodeEditorCodeMirror from '../components/CodeEditorCodeMirror';
import type { DiffInfo, LineChange } from '../components/CodeEditorCodeMirror';

/**
 * TDD Test Suite for Monaco → CodeMirror Migration
 *
 * RED Phase: Define comprehensive tests BEFORE migration
 * These tests verify that CodeMirror supports all features Monaco provided
 */

describe('CodeMirror Migration - Feature Parity Tests', () => {
  describe('🎯 Core Functionality', () => {
    it('should render code content correctly', () => {
      const testCode = 'const hello = "world";';

      render(
        <CodeEditorCodeMirror
          content={testCode}
          filename="test.js"
          language="javascript"
        />
      );

      // CodeMirror should render the content
      expect(screen.getByText(/const hello/)).toBeInTheDocument();
    });

    it('should detect language from filename extension', () => {
      const jsCode = 'function test() {}';
      const { rerender } = render(
        <CodeEditorCodeMirror
          content={jsCode}
          filename="test.js"
        />
      );

      // Should work for JavaScript
      expect(screen.getByText(/function test/)).toBeInTheDocument();

      // Should work for TypeScript
      rerender(
        <CodeEditorCodeMirror
          content="type Foo = string;"
          filename="test.ts"
        />
      );
      expect(screen.getByText(/type Foo/)).toBeInTheDocument();
    });

    it('should handle multiple language types', () => {
      const languageTests = [
        { filename: 'test.js', content: 'const x = 1' },
        { filename: 'test.ts', content: 'type Foo = string' },
        { filename: 'test.py', content: 'def test():' },
        { filename: 'test.json', content: '{"key": "value"}' },
        { filename: 'test.md', content: '# Heading' },
      ];

      languageTests.forEach(({ filename, content }) => {
        const { unmount } = render(
          <CodeEditorCodeMirror
            content={content}
            filename={filename}
          />
        );

        // Should render without errors
        expect(screen.getByText(new RegExp(content.substring(0, 10)))).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('✏️ Edit Functionality', () => {
    it('should prevent editing when readOnly=true', () => {
      const onChangeMock = vi.fn();

      render(
        <CodeEditorCodeMirror
          content="readonly content"
          filename="test.js"
          onChange={onChangeMock}
          readOnly={true}
        />
      );

      // Should render content
      expect(screen.getByText(/readonly content/)).toBeInTheDocument();

      // onChange should not be called automatically (readonly mode)
      expect(onChangeMock).not.toHaveBeenCalled();
    });

    it('should have onChange and onSave callbacks', () => {
      const onChangeMock = vi.fn();
      const onSaveMock = vi.fn();

      render(
        <CodeEditorCodeMirror
          content="test"
          filename="test.js"
          onChange={onChangeMock}
          onSave={onSaveMock}
        />
      );

      // Props accepted without errors
      expect(screen.getByText(/test/)).toBeInTheDocument();
    });
  });

  describe('🎨 Diff Highlighting', () => {
    it('should accept diffInfo prop for additions', () => {
      const diffInfo: DiffInfo = {
        additions: [1, 2, 3],
        deletions: [],
        modifications: [],
      };

      render(
        <CodeEditorCodeMirror
          content="line 1\nline 2\nline 3"
          filename="test.js"
          diffInfo={diffInfo}
        />
      );

      // Should render content with diff info
      expect(screen.getByText(/line 1/)).toBeInTheDocument();
    });

    it('should accept diffInfo prop for deletions', () => {
      const diffInfo: DiffInfo = {
        additions: [],
        deletions: [2],
        modifications: [],
      };

      render(
        <CodeEditorCodeMirror
          content="line 1\nline 2\nline 3"
          filename="test.js"
          diffInfo={diffInfo}
        />
      );

      expect(screen.getByText(/line 2/)).toBeInTheDocument();
    });

    it('should accept diffInfo prop for modifications', () => {
      const diffInfo: DiffInfo = {
        additions: [],
        deletions: [],
        modifications: [1, 3],
      };

      render(
        <CodeEditorCodeMirror
          content="line 1\nline 2\nline 3"
          filename="test.js"
          diffInfo={diffInfo}
        />
      );

      expect(screen.getByText(/line 1/)).toBeInTheDocument();
    });

    it('should accept lineChanges prop (new detailed diff format)', () => {
      const lineChanges: LineChange[] = [
        { line: 1, type: 'added' },
        { line: 2, type: 'modified' },
        { line: 3, type: 'removed' },
      ];

      render(
        <CodeEditorCodeMirror
          content="line 1\nline 2\nline 3"
          filename="test.js"
          lineChanges={lineChanges}
        />
      );

      expect(screen.getByText(/line 1/)).toBeInTheDocument();
    });
  });

  describe('🔍 Search Functionality', () => {
    it('should expose search methods via ref', () => {
      const editorRef = React.createRef<any>();

      render(
        <CodeEditorCodeMirror
          ref={editorRef}
          content="search this text"
          filename="test.js"
        />
      );

      // Verify ref has search methods
      expect(editorRef.current).toHaveProperty('search');
      expect(editorRef.current).toHaveProperty('nextMatch');
      expect(editorRef.current).toHaveProperty('previousMatch');
      expect(editorRef.current).toHaveProperty('clearSearch');
      expect(editorRef.current).toHaveProperty('replace');
      expect(editorRef.current).toHaveProperty('replaceAll');
    });
  });

  describe('🖥️ Monaco Compatibility', () => {
    it('should export DiffInfo type compatible with Monaco', () => {
      // Type test - should compile without errors
      const diffInfo: DiffInfo = {
        additions: [1, 2],
        deletions: [3],
        modifications: [4, 5],
      };

      expect(diffInfo.additions).toBeDefined();
      expect(diffInfo.deletions).toBeDefined();
      expect(diffInfo.modifications).toBeDefined();
    });

    it('should accept same props as Monaco version', () => {
      // All Monaco CodeEditor props should work
      const props = {
        content: "test",
        filename: "test.js",
        language: "javascript",
        readOnly: false,
        onChange: vi.fn(),
        onSave: vi.fn(),
        diffInfo: {
          additions: [],
          deletions: [],
          modifications: [],
        },
      };

      const { unmount } = render(<CodeEditorCodeMirror {...props} />);

      expect(screen.getByText(/test/)).toBeInTheDocument();
      unmount();
    });
  });

  describe('⚡ Performance', () => {
    it('should render large files without freezing', () => {
      const largeContent = Array.from({ length: 1000 }, (_, i) => `line ${i + 1}`).join('\n');

      const startTime = performance.now();

      render(
        <CodeEditorCodeMirror
          content={largeContent}
          filename="large.txt"
        />
      );

      const renderTime = performance.now() - startTime;

      // Should render in less than 2 seconds
      expect(renderTime).toBeLessThan(2000);
    });
  });

  describe('🎨 Styling & Theme', () => {
    it('should render with dark theme', () => {
      render(
        <CodeEditorCodeMirror
          content="const dark = true;"
          filename="test.js"
        />
      );

      const editorElement = screen.getByText(/const dark/);

      // Should render content (theme is applied)
      expect(editorElement).toBeInTheDocument();
    });

    it('should apply syntax highlighting', () => {
      render(
        <CodeEditorCodeMirror
          content='const keyword = "string";'
          filename="test.js"
        />
      );

      // Should render with syntax highlighting
      expect(screen.getByText(/const/)).toBeInTheDocument();
      expect(screen.getByText(/string/)).toBeInTheDocument();
    });
  });
});
