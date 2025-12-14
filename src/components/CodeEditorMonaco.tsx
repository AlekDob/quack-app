import { useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import Editor, { type OnMount, loader } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import { QUACK_THEME_NAME, defineQuackTheme } from '../hooks/useMonacoTheme';
import { useMonacoDiff, type LineChange, type DiffInfo } from '../hooks/useMonacoDiff';
import './CodeEditorMonaco.css';

// Import Monaco setup - this configures workers using Vite's native bundling
// CRITICAL: This import MUST happen before any Editor component renders
// It sets up self.MonacoEnvironment.getWorker for syntax highlighting to work
import '../lib/monacoSetup';

// Configure @monaco-editor/react to use local Monaco instance from node_modules
// instead of loading from CDN. This ensures:
// 1. Workers are bundled by Vite and served from same origin
// 2. No CORS issues in Tauri production builds
// 3. Syntax highlighting works correctly
// See: https://github.com/suren-atoyan/monaco-react#use-monaco-editor-as-an-npm-package
loader.config({ monaco });

// Pre-initialize Monaco and define theme BEFORE any editor renders
// This prevents the "black editor" issue in production builds
let monacoInitialized = false;
let monacoInitPromise: Promise<typeof import('monaco-editor')> | null = null;

async function initializeMonaco(): Promise<typeof import('monaco-editor')> {
  if (monacoInitPromise) return monacoInitPromise;

  monacoInitPromise = loader.init().then((monaco) => {
    if (!monacoInitialized) {
      defineQuackTheme(monaco);
      monaco.editor.setTheme(QUACK_THEME_NAME);
      monacoInitialized = true;
      console.log('[Monaco] Theme initialized successfully');
    }
    return monaco;
  });

  return monacoInitPromise;
}

// Start initialization immediately when module loads
initializeMonaco().catch(err => {
  console.error('[Monaco] Failed to initialize:', err);
});

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface CodeEditorRef {
  search: (query: string, options: SearchOptions) => { total: number; current: number };
  nextMatch: () => void;
  previousMatch: () => void;
  clearSearch: () => void;
  replace: (replaceText: string) => void;
  replaceAll: (replaceText: string) => void;
  nextChange: () => void;
  previousChange: () => void;
}

interface CodeEditorMonacoProps {
  content: string;
  filename: string | null;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  diffInfo?: DiffInfo | null;
  lineChanges?: LineChange[];
  showMinimap?: boolean;
}

const getLanguageFromFilename = (filename: string | null): string => {
  if (!filename) return 'plaintext';

  const extension = filename.split('.').pop()?.toLowerCase() || '';

  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescriptreact',
    mjs: 'javascript',
    cjs: 'javascript',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    mdx: 'markdown',
    markdown: 'markdown',
    py: 'python',
    rs: 'rust',
    sh: 'shell',
    bash: 'shell',
    go: 'go',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    swift: 'swift',
    kt: 'kotlin',
    rb: 'ruby',
    php: 'php',
    sql: 'sql',
    xml: 'xml',
    toml: 'toml',
  };

  return languageMap[extension] || 'plaintext';
};

const CodeEditorMonaco = forwardRef<CodeEditorRef, CodeEditorMonacoProps>(({
  content,
  filename,
  language,
  readOnly = false,
  onChange,
  onSave,
  diffInfo,
  lineChanges,
  showMinimap = true,
}, ref) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof import('monaco-editor') | null>(null);
  const searchMatchesRef = useRef<editor.FindMatch[]>([]);
  const currentMatchIndexRef = useRef(0);
  const lineChangesRef = useRef<LineChange[]>([]);

  const { applyDecorations, clearDecorations, navigateToChange, diffInfoToLineChanges } = useMonacoDiff();

  const detectedLanguage = language || getLanguageFromFilename(filename);

  // Handle editor mount
  // Note: Theme is pre-initialized via initializeMonaco() at module load
  // This ensures syntax highlighting works in production builds
  const handleEditorDidMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Ensure theme is applied (might be needed if editor loads before init completes)
    defineQuackTheme(monaco);
    monaco.editor.setTheme(QUACK_THEME_NAME);

    // Add save keybinding
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (onSave) {
        onSave(editor.getValue());
      }
    });

    // Apply initial decorations if provided
    if (lineChanges?.length || diffInfo) {
      const changes = lineChanges || (diffInfo ? diffInfoToLineChanges(diffInfo) : []);
      lineChangesRef.current = changes;
      applyDecorations(editor, changes);
    }
  }, [onSave, lineChanges, diffInfo, applyDecorations, diffInfoToLineChanges]);

  // Handle content changes
  const handleChange = useCallback((value: string | undefined) => {
    if (onChange && value !== undefined) {
      onChange(value);
    }
  }, [onChange]);

  // Update decorations when lineChanges or diffInfo changes
  useEffect(() => {
    if (!editorRef.current) return;

    const changes = lineChanges || (diffInfo ? diffInfoToLineChanges(diffInfo) : []);
    lineChangesRef.current = changes;

    if (changes.length > 0) {
      applyDecorations(editorRef.current, changes);
    } else {
      clearDecorations(editorRef.current);
    }
  }, [lineChanges, diffInfo, applyDecorations, clearDecorations, diffInfoToLineChanges]);

  // Search functionality
  const performSearch = useCallback((query: string, options: SearchOptions): { total: number; current: number } => {
    if (!editorRef.current || !monacoRef.current || !query) {
      searchMatchesRef.current = [];
      return { total: 0, current: 0 };
    }

    const model = editorRef.current.getModel();
    if (!model) return { total: 0, current: 0 };

    const matches = model.findMatches(
      query,
      true, // searchOnlyEditableRange
      options.regex,
      options.caseSensitive,
      options.wholeWord ? 'true' : null,
      false // captureMatches
    );

    searchMatchesRef.current = matches;
    currentMatchIndexRef.current = matches.length > 0 ? 0 : -1;

    // Highlight first match
    if (matches.length > 0) {
      editorRef.current.setSelection(matches[0].range);
      editorRef.current.revealRangeInCenter(matches[0].range);
    }

    return { total: matches.length, current: matches.length > 0 ? 1 : 0 };
  }, []);

  const nextMatch = useCallback(() => {
    if (!editorRef.current || searchMatchesRef.current.length === 0) return;

    currentMatchIndexRef.current = (currentMatchIndexRef.current + 1) % searchMatchesRef.current.length;
    const match = searchMatchesRef.current[currentMatchIndexRef.current];

    editorRef.current.setSelection(match.range);
    editorRef.current.revealRangeInCenter(match.range);
  }, []);

  const previousMatch = useCallback(() => {
    if (!editorRef.current || searchMatchesRef.current.length === 0) return;

    currentMatchIndexRef.current = currentMatchIndexRef.current === 0
      ? searchMatchesRef.current.length - 1
      : currentMatchIndexRef.current - 1;
    const match = searchMatchesRef.current[currentMatchIndexRef.current];

    editorRef.current.setSelection(match.range);
    editorRef.current.revealRangeInCenter(match.range);
  }, []);

  const clearSearch = useCallback(() => {
    searchMatchesRef.current = [];
    currentMatchIndexRef.current = -1;
  }, []);

  const replace = useCallback((replaceText: string) => {
    if (!editorRef.current || searchMatchesRef.current.length === 0) return;

    const match = searchMatchesRef.current[currentMatchIndexRef.current];
    if (!match) return;

    editorRef.current.executeEdits('replace', [{
      range: match.range,
      text: replaceText,
    }]);

    // Re-search to update matches
    // Note: This is a simplified implementation
    searchMatchesRef.current.splice(currentMatchIndexRef.current, 1);
    if (searchMatchesRef.current.length > 0) {
      currentMatchIndexRef.current = Math.min(currentMatchIndexRef.current, searchMatchesRef.current.length - 1);
    }
  }, []);

  const replaceAll = useCallback((replaceText: string) => {
    if (!editorRef.current || searchMatchesRef.current.length === 0) return;

    const edits = searchMatchesRef.current.map((match) => ({
      range: match.range,
      text: replaceText,
    }));

    editorRef.current.executeEdits('replaceAll', edits);
    searchMatchesRef.current = [];
    currentMatchIndexRef.current = -1;
  }, []);

  // Navigate to next/previous change
  const nextChange = useCallback(() => {
    if (!editorRef.current || !lineChangesRef.current.length) return;
    navigateToChange(editorRef.current, lineChangesRef.current, 'next');
  }, [navigateToChange]);

  const previousChange = useCallback(() => {
    if (!editorRef.current || !lineChangesRef.current.length) return;
    navigateToChange(editorRef.current, lineChangesRef.current, 'previous');
  }, [navigateToChange]);

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    search: performSearch,
    nextMatch,
    previousMatch,
    clearSearch,
    replace,
    replaceAll,
    nextChange,
    previousChange,
  }), [performSearch, nextMatch, previousMatch, clearSearch, replace, replaceAll, nextChange, previousChange]);

  return (
    <div className="code-editor-monaco-container">
      <Editor
        height="100%"
        width="100%"
        language={detectedLanguage}
        value={content}
        theme={QUACK_THEME_NAME}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        options={{
          readOnly,
          minimap: {
            enabled: showMinimap,
            scale: 1,
            showSlider: 'mouseover',
            renderCharacters: false,
          },
          fontSize: 14,
          fontFamily: 'JetBrains Mono, SF Mono, Monaco, Inconsolata, "Courier New", monospace',
          fontLigatures: true,
          lineNumbers: 'on',
          lineNumbersMinChars: 4,
          glyphMargin: true, // Required for diff indicators
          folding: true,
          foldingStrategy: 'indentation',
          wordWrap: 'off',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          renderWhitespace: 'selection',
          bracketPairColorization: {
            enabled: true,
          },
          cursorStyle: 'line',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          padding: {
            top: 12,
            bottom: 12,
          },
          overviewRulerBorder: false,
          overviewRulerLanes: 3, // For diff decorations
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          // Find widget options
          find: {
            addExtraSpaceOnTop: false,
            autoFindInSelection: 'never',
            seedSearchStringFromSelection: 'selection',
          },
        }}
        loading={
          <div className="code-editor-monaco-loading">
            <span>Loading editor...</span>
          </div>
        }
      />
    </div>
  );
});

CodeEditorMonaco.displayName = 'CodeEditorMonaco';

export default CodeEditorMonaco;
export type { LineChange, DiffInfo };
