/**
 * CodeEditorEngine
 *
 * Slim CodeMirror 6 editor component. Imports theme, search, and diff
 * from extracted submodules. Provides imperative ref for search/replace.
 *
 * @module CodeEditorEngine
 */

// Brain: pattern-code-editor-tab
import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { getLanguageFromFilename } from '../../utils/languageDetection';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, foldGutter, indentOnInput } from '@codemirror/language';
import { highlightSelectionMatches } from '@codemirror/search';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';

import { customTheme, highlightExtension } from './editorTheme';
import { setSearchMatches, searchMatchesField, findAllMatches, buildSearchDecorations } from './editorSearch';
import { diffDecorationsField, applyDiffDecorations } from './editorDiff';
import type { CodeEditorRef, CodeEditorProps, SearchOptions } from './editorTypes';
import type { SearchMatch } from './editorSearch';

/** Map language string to CodeMirror language extension */
function getLanguageExtension(language: string) {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return javascript({ typescript: language === 'typescript', jsx: true });
    case 'html': return html();
    case 'css': return css();
    case 'json': return json();
    case 'markdown': return markdown();
    case 'python': return python();
    case 'rust': return rust();
    default: return [];
  }
}

const CodeEditorEngine = forwardRef<CodeEditorRef, CodeEditorProps>(({
  content,
  filename,
  language,
  readOnly = false,
  onChange,
  onSave,
  diffInfo,
  lineChanges,
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isInternalChangeRef = useRef(false);
  const searchMatchesRef = useRef<SearchMatch[]>([]);
  const currentMatchIndexRef = useRef(0);

  const detectedLanguage = language || getLanguageFromFilename(filename);

  const handleChange = useCallback((value: string) => {
    isInternalChangeRef.current = true;
    onChange?.(value);
  }, [onChange]);

  // --- Search imperative methods ---

  const performSearch = useCallback((query: string, options: SearchOptions) => {
    if (!viewRef.current || !query) {
      searchMatchesRef.current = [];
      currentMatchIndexRef.current = 0;
      viewRef.current?.dispatch({ effects: setSearchMatches.of([]) });
      return { total: 0, current: 0 };
    }
    const text = viewRef.current.state.doc.toString();
    const matches = findAllMatches(text, query, options);
    searchMatchesRef.current = matches;
    currentMatchIndexRef.current = matches.length > 0 ? 0 : -1;

    const decorations = buildSearchDecorations(matches, 0);
    viewRef.current.dispatch({ effects: setSearchMatches.of(decorations) });

    if (matches.length > 0) {
      viewRef.current.dispatch({
        selection: { anchor: matches[0].from },
        scrollIntoView: true,
      });
    }
    return { total: matches.length, current: matches.length > 0 ? 1 : 0 };
  }, []);

  const navigateMatch = useCallback((direction: 'next' | 'prev') => {
    if (!viewRef.current || searchMatchesRef.current.length === 0) return;
    const matches = searchMatchesRef.current;
    if (direction === 'next') {
      currentMatchIndexRef.current = (currentMatchIndexRef.current + 1) % matches.length;
    } else {
      currentMatchIndexRef.current = currentMatchIndexRef.current === 0
        ? matches.length - 1
        : currentMatchIndexRef.current - 1;
    }
    const cur = matches[currentMatchIndexRef.current];
    const decorations = buildSearchDecorations(matches, currentMatchIndexRef.current);
    viewRef.current.dispatch({
      effects: setSearchMatches.of(decorations),
      selection: { anchor: cur.from },
      scrollIntoView: true,
    });
  }, []);

  const clearSearch = useCallback(() => {
    searchMatchesRef.current = [];
    currentMatchIndexRef.current = 0;
    viewRef.current?.dispatch({ effects: setSearchMatches.of([]) });
  }, []);

  const replace = useCallback((replaceText: string) => {
    if (!viewRef.current || searchMatchesRef.current.length === 0) return;
    const idx = currentMatchIndexRef.current;
    const matches = searchMatchesRef.current;
    if (idx < 0 || idx >= matches.length) return;
    const cur = matches[idx];
    viewRef.current.dispatch({ changes: { from: cur.from, to: cur.to, insert: replaceText } });
    const remaining = matches.filter((_, i) => i !== idx);
    searchMatchesRef.current = remaining;
    if (remaining.length === 0) {
      currentMatchIndexRef.current = -1;
      viewRef.current.dispatch({ effects: setSearchMatches.of([]) });
    } else {
      currentMatchIndexRef.current = Math.min(idx, remaining.length - 1);
      const decos = buildSearchDecorations(remaining, currentMatchIndexRef.current);
      viewRef.current.dispatch({ effects: setSearchMatches.of(decos) });
    }
  }, []);

  const replaceAll = useCallback((replaceText: string) => {
    if (!viewRef.current || searchMatchesRef.current.length === 0) return;
    const changes = [...searchMatchesRef.current].reverse().map(m => ({
      from: m.from, to: m.to, insert: replaceText,
    }));
    viewRef.current.dispatch({ changes, effects: setSearchMatches.of([]) });
    searchMatchesRef.current = [];
    currentMatchIndexRef.current = -1;
  }, []);

  useImperativeHandle(ref, () => ({
    search: performSearch,
    nextMatch: () => navigateMatch('next'),
    previousMatch: () => navigateMatch('prev'),
    clearSearch,
    replace,
    replaceAll,
  }), [performSearch, navigateMatch, clearSearch, replace, replaceAll]);

  // --- EditorView lifecycle ---

  useEffect(() => {
    if (!editorRef.current) return;
    const languageExtension = getLanguageExtension(detectedLanguage);
    const saveKeyBinding = keymap.of([{
      key: 'Mod-s',
      run: () => {
        if (onSave && viewRef.current) onSave(viewRef.current.state.doc.toString());
        return true;
      },
    }]);

    const startState = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        history(),
        foldGutter(),
        indentOnInput(),
        bracketMatching(),
        highlightExtension,
        customTheme,
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(readOnly),
        highlightSelectionMatches(),
        searchMatchesField,
        diffDecorationsField,
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        saveKeyBinding,
        EditorView.updateListener.of(update => {
          if (update.docChanged) handleChange(update.state.doc.toString());
        }),
        ...(Array.isArray(languageExtension) ? languageExtension : [languageExtension]),
      ],
    });

    const view = new EditorView({ state: startState, parent: editorRef.current });
    viewRef.current = view;
    return () => { view.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename, readOnly]);

  // Sync content from external changes
  useEffect(() => {
    if (viewRef.current && !isInternalChangeRef.current) {
      const cur = viewRef.current.state.doc.toString();
      if (cur !== content) {
        viewRef.current.dispatch({
          changes: { from: 0, to: cur.length, insert: content },
        });
      }
    }
    isInternalChangeRef.current = false;
  }, [content]);

  // Apply diff decorations
  useEffect(() => {
    if (!viewRef.current) return;
    applyDiffDecorations(viewRef.current, lineChanges, diffInfo);
  }, [lineChanges, diffInfo]);

  return (
    <div
      ref={editorRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        fontFamily: 'JetBrains Mono, SF Mono, Monaco, Inconsolata, "Courier New", monospace',
        fontSize: '14px',
      }}
    />
  );
});

CodeEditorEngine.displayName = 'CodeEditorEngine';

export default CodeEditorEngine;
