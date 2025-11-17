import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, Decoration } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { highlightSelectionMatches } from "@codemirror/search";
import { tags as t } from "@lezer/highlight";
import { javascript } from "@codemirror/lang-javascript";
import { StateField, StateEffect } from "@codemirror/state";
import type { Range } from "@codemirror/state";

// Custom theme inspired by Atom One Dark / Material Palenight with pure black background
const customTheme = EditorView.theme({
  "&": {
    backgroundColor: "#000000 !important", // Pure black background
    color: "#abb2bf", // Soft gray text
  },
  ".cm-content": {
    caretColor: "#528bff", // Blue cursor
  },
  ".cm-gutters": {
    backgroundColor: "#000000 !important",
    borderRight: "1px solid #1a1a1a",
    color: "#636d83", // Muted gray for line numbers
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#0a0a0a !important",
    color: "#abb2bf",
  },
  ".cm-scroller": {
    backgroundColor: "#000000 !important",
  },
  ".cm-line": {
    color: "#abb2bf", // Soft gray for default text
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(153, 187, 255, 0.04) !important", // Subtle highlight
  },
  // Cursor visibility
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#528bff !important",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#528bff !important",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(67, 76, 94, 0.6) !important", // Atom One Dark selection
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "rgba(67, 76, 94, 0.8) !important",
  },
  // Syntax colors - Minimal monochrome theme with purple accents
  ".cm-string": { color: "#ce9178" }, // Muted orange/brown for strings (not bright red)
  ".cm-number": { color: "#b5cea8" }, // Muted sage green for numbers
  ".cm-keyword": { color: "#c586c0" }, // Muted purple/magenta for keywords (export, import, etc.)
  ".cm-operator": { color: "#909090" }, // Gray for operators
  ".cm-variableName": { color: "#9cdcfe" }, // Light blue for variables (not bright blue)
  ".cm-propertyName": { color: "#9cdcfe" }, // Light blue for properties
  ".cm-comment": { color: "#6a9955", fontStyle: "italic" }, // Muted green for comments
  ".cm-atom": { color: "#569cd6" }, // Muted blue for atoms (true/false/null)
  ".cm-meta": { color: "#808080" }, // Gray for meta
  ".cm-bracket": { color: "#808080" }, // Gray for brackets
  ".cm-tag": { color: "#569cd6" }, // Muted blue for HTML tags (not red)
  ".cm-attributeName": { color: "#9cdcfe" }, // Light blue for attributes
  ".cm-attributeValue": { color: "#ce9178" }, // Muted orange for attribute values
  ".cm-typeName": { color: "#4ec9b0" }, // Teal for types
  ".cm-definition": { color: "#dcdcaa" }, // Yellow-gray for definitions (function names)
  ".cm-matchingBracket": {
    backgroundColor: "rgba(97, 175, 239, 0.2) !important",
    outline: "1px solid rgba(97, 175, 239, 0.5)",
  },
  ".cm-nonmatchingBracket": {
    color: "#e06c75 !important",
  },
  // Search panel styling
  ".cm-searchMatch": {
    backgroundColor: "rgba(255, 215, 0, 0.3) !important",
    border: "1px solid rgba(255, 215, 0, 0.5)",
  },
  ".cm-searchMatch-selected": {
    backgroundColor: "rgba(255, 165, 0, 0.5) !important",
    border: "1px solid rgba(255, 165, 0, 0.8)",
  },
  ".cm-panels": {
    backgroundColor: "#1a1a1a !important",
    color: "#ffffff !important",
    borderBottom: "1px solid #2a2a2a !important",
    position: "sticky !important",
    top: "0 !important",
    zIndex: "100 !important",
  },
  ".cm-panels-top": {
    borderBottom: "1px solid #2a2a2a !important",
  },
  ".cm-panel": {
    padding: "8px 12px !important",
  },
  ".cm-panel input": {
    backgroundColor: "#0a0a0a !important",
    color: "#ffffff !important",
    border: "1px solid #3a3a3a !important",
    padding: "6px 10px !important",
    borderRadius: "4px !important",
    fontSize: "13px !important",
  },
  ".cm-panel input:focus": {
    outline: "none !important",
    border: "1px solid #528bff !important",
  },
  ".cm-panel button": {
    backgroundColor: "#2a2a2a !important",
    color: "#ffffff !important",
    border: "1px solid #3a3a3a !important",
    padding: "6px 12px !important",
    borderRadius: "4px !important",
    cursor: "pointer !important",
    fontSize: "12px !important",
    fontWeight: "500 !important",
    transition: "all 0.15s ease !important",
  },
  ".cm-panel button:hover": {
    backgroundColor: "#3a3a3a !important",
    borderColor: "#4a4a4a !important",
  },
  ".cm-panel button:active": {
    backgroundColor: "#4a4a4a !important",
  },
  ".cm-panel label": {
    color: "#ffffff !important",
    fontSize: "12px !important",
  },
  ".cm-panel input[type=checkbox]": {
    cursor: "pointer !important",
  },
  // Force panel to top with higher specificity
  "&.cm-editor .cm-panels-bottom": {
    order: "-1 !important",
    borderTop: "none !important",
    borderBottom: "1px solid #2a2a2a !important",
  },
  // Make buttons more visible
  "&.cm-editor .cm-button": {
    backgroundColor: "#2a2a2a !important",
    color: "#ffffff !important",
    border: "1px solid #3a3a3a !important",
    padding: "6px 12px !important",
    borderRadius: "4px !important",
  },
  "&.cm-editor .cm-button:hover": {
    backgroundColor: "#3a3a3a !important",
  },
  // Textfield styling
  "&.cm-editor .cm-textfield": {
    backgroundColor: "#0a0a0a !important",
    color: "#ffffff !important",
    border: "1px solid #3a3a3a !important",
    borderRadius: "4px !important",
  },
  // Custom search match highlighting
  ".cm-search-match": {
    backgroundColor: "rgba(255, 215, 0, 0.25) !important",
    border: "1px solid rgba(255, 215, 0, 0.4)",
    borderRadius: "2px",
  },
  ".cm-search-match-current": {
    backgroundColor: "rgba(242, 140, 82, 0.4) !important",
    border: "1px solid rgba(242, 140, 82, 0.6)",
    borderRadius: "2px",
    outline: "2px solid rgba(242, 140, 82, 0.3)",
  },
});

// Custom syntax highlighting - VS Code Dark+ inspired with muted colors
const customHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#c586c0" }, // Muted purple for keywords
  { tag: t.name, color: "#9cdcfe" }, // Light blue for names
  { tag: t.deleted, color: "#ce9178" },
  { tag: t.inserted, color: "#b5cea8" },
  { tag: t.changed, color: "#569cd6" },
  { tag: t.invalid, color: "#f44747" },
  { tag: t.comment, color: "#6a9955", fontStyle: "italic" }, // Green for comments
  { tag: t.variableName, color: "#9cdcfe" }, // Light blue for variables
  { tag: [t.string, t.special(t.brace)], color: "#ce9178" }, // Muted orange for strings
  { tag: t.number, color: "#b5cea8" }, // Muted green for numbers
  { tag: t.bool, color: "#569cd6" }, // Muted blue for booleans
  { tag: t.null, color: "#569cd6" }, // Muted blue for null
  { tag: t.operator, color: "#d4d4d4" }, // Light gray for operators
  { tag: t.punctuation, color: "#d4d4d4" }, // Light gray for punctuation
  { tag: t.bracket, color: "#ffd700" }, // Gold for brackets
  { tag: t.angleBracket, color: "#808080" }, // Gray for angle brackets
  { tag: t.tagName, color: "#569cd6" }, // Muted blue for tags (not red)
  { tag: t.attributeName, color: "#9cdcfe" }, // Light blue for attributes
  { tag: t.className, color: "#4ec9b0" }, // Teal for class names
  { tag: t.propertyName, color: "#9cdcfe" }, // Light blue for properties
  { tag: t.function(t.variableName), color: "#dcdcaa" }, // Yellow-gray for function names
  { tag: t.definition(t.variableName), color: "#dcdcaa" }, // Yellow-gray for definitions
  { tag: t.typeName, color: "#4ec9b0" }, // Teal for types
  { tag: t.self, color: "#569cd6" }, // Muted blue for self/this
  { tag: t.constant(t.variableName), color: "#4fc1ff" }, // Light blue for constants
]);

import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";

export interface DiffInfo {
  additions: number[];
  deletions: number[];
  modifications: number[];
}

export type { DiffInfo as DiffInfoType };

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
}

interface CodeEditorProps {
  content: string;
  filename: string | null;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  diffInfo?: DiffInfo | null;
}

const getLanguageFromFilename = (filename: string | null): string => {
  if (!filename) return "plaintext";

  const extension = filename.split(".").pop()?.toLowerCase() || "";

  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    mjs: "javascript",
    cjs: "javascript",
    html: "html",
    htm: "html",
    css: "css",
    scss: "css",
    sass: "css",
    less: "css",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    mdx: "markdown",
    markdown: "markdown",
    py: "python",
    rs: "rust",
    sh: "shell",
    bash: "shell",
  };

  return languageMap[extension] || "plaintext";
};

const getLanguageExtension = (language: string) => {
  switch (language) {
    case "javascript":
    case "typescript":
      return javascript({ typescript: language === "typescript", jsx: true });
    case "html":
      return html();
    case "css":
      return css();
    case "json":
      return json();
    case "markdown":
      return markdown();
    case "python":
      return python();
    case "rust":
      return rust();
    default:
      return [];
  }
};

// Search state management
const setSearchMatches = StateEffect.define<Range<Decoration>[]>();
const searchMatchesField = StateField.define<Range<Decoration>[]>({
  create() {
    return [];
  },
  update(matches, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSearchMatches)) {
        return effect.value;
      }
    }
    return matches;
  },
  provide: f => EditorView.decorations.from(f, matches => Decoration.set(matches))
});

const searchMatchDecoration = Decoration.mark({
  class: "cm-search-match"
});

const currentSearchMatchDecoration = Decoration.mark({
  class: "cm-search-match-current"
});

const CodeEditorCodeMirror = forwardRef<CodeEditorRef, CodeEditorProps>(({
  content,
  filename,
  language,
  readOnly = false,
  onChange,
  onSave,
  diffInfo,
}, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isInternalChangeRef = useRef(false); // Track if change is from user typing
  const searchMatchesRef = useRef<{ from: number; to: number }[]>([]);
  const currentMatchIndexRef = useRef(0);

  const detectedLanguage = language || getLanguageFromFilename(filename);

  const handleChange = useCallback(
    (value: string) => {
      isInternalChangeRef.current = true;
      if (onChange) {
        onChange(value);
      }
    },
    [onChange]
  );

  // Search functionality
  const performSearch = useCallback((query: string, options: SearchOptions) => {
    if (!viewRef.current || !query) {
      searchMatchesRef.current = [];
      currentMatchIndexRef.current = 0;
      viewRef.current?.dispatch({
        effects: setSearchMatches.of([])
      });
      return { total: 0, current: 0 };
    }

    const view = viewRef.current;
    const text = view.state.doc.toString();
    const matches: { from: number; to: number }[] = [];

    try {
      let searchRegex: RegExp;
      if (options.regex) {
        searchRegex = new RegExp(query, options.caseSensitive ? 'g' : 'gi');
      } else {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = options.wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
        searchRegex = new RegExp(pattern, options.caseSensitive ? 'g' : 'gi');
      }

      let match;
      while ((match = searchRegex.exec(text)) !== null) {
        matches.push({ from: match.index, to: match.index + match[0].length });
      }

      searchMatchesRef.current = matches;
      currentMatchIndexRef.current = matches.length > 0 ? 0 : -1;

      // Create decorations
      const decorations = matches.map((m, i) => {
        const decoration = i === 0 ? currentSearchMatchDecoration : searchMatchDecoration;
        return decoration.range(m.from, m.to);
      });

      view.dispatch({
        effects: setSearchMatches.of(decorations)
      });

      // Scroll to first match
      if (matches.length > 0) {
        view.dispatch({
          selection: { anchor: matches[0].from },
          scrollIntoView: true
        });
      }

      return { total: matches.length, current: matches.length > 0 ? 1 : 0 };
    } catch (error) {
      console.error('Search error:', error);
      return { total: 0, current: 0 };
    }
  }, []);

  const nextMatch = useCallback(() => {
    if (!viewRef.current || searchMatchesRef.current.length === 0) return;

    const matches = searchMatchesRef.current;
    currentMatchIndexRef.current = (currentMatchIndexRef.current + 1) % matches.length;
    const currentMatch = matches[currentMatchIndexRef.current];

    // Update decorations
    const decorations = matches.map((m, i) => {
      const decoration = i === currentMatchIndexRef.current ? currentSearchMatchDecoration : searchMatchDecoration;
      return decoration.range(m.from, m.to);
    });

    viewRef.current.dispatch({
      effects: setSearchMatches.of(decorations),
      selection: { anchor: currentMatch.from },
      scrollIntoView: true
    });
  }, []);

  const previousMatch = useCallback(() => {
    if (!viewRef.current || searchMatchesRef.current.length === 0) return;

    const matches = searchMatchesRef.current;
    currentMatchIndexRef.current = currentMatchIndexRef.current === 0
      ? matches.length - 1
      : currentMatchIndexRef.current - 1;
    const currentMatch = matches[currentMatchIndexRef.current];

    // Update decorations
    const decorations = matches.map((m, i) => {
      const decoration = i === currentMatchIndexRef.current ? currentSearchMatchDecoration : searchMatchDecoration;
      return decoration.range(m.from, m.to);
    });

    viewRef.current.dispatch({
      effects: setSearchMatches.of(decorations),
      selection: { anchor: currentMatch.from },
      scrollIntoView: true
    });
  }, []);

  const clearSearch = useCallback(() => {
    searchMatchesRef.current = [];
    currentMatchIndexRef.current = 0;
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: setSearchMatches.of([])
      });
    }
  }, []);

  const replace = useCallback((replaceText: string) => {
    if (!viewRef.current || searchMatchesRef.current.length === 0) return;

    const matches = searchMatchesRef.current;
    const currentIndex = currentMatchIndexRef.current;
    if (currentIndex < 0 || currentIndex >= matches.length) return;

    const currentMatch = matches[currentIndex];

    // Replace current match
    viewRef.current.dispatch({
      changes: {
        from: currentMatch.from,
        to: currentMatch.to,
        insert: replaceText
      }
    });

    // Update matches list (remove replaced match)
    const newMatches = matches.filter((_, i) => i !== currentIndex);
    searchMatchesRef.current = newMatches;

    // Adjust current index
    if (newMatches.length === 0) {
      currentMatchIndexRef.current = -1;
      viewRef.current.dispatch({
        effects: setSearchMatches.of([])
      });
    } else {
      currentMatchIndexRef.current = Math.min(currentIndex, newMatches.length - 1);
      const decorations = newMatches.map((m, i) => {
        const decoration = i === currentMatchIndexRef.current ? currentSearchMatchDecoration : searchMatchDecoration;
        return decoration.range(m.from, m.to);
      });
      viewRef.current.dispatch({
        effects: setSearchMatches.of(decorations)
      });
    }
  }, []);

  const replaceAll = useCallback((replaceText: string) => {
    if (!viewRef.current || searchMatchesRef.current.length === 0) return;

    const matches = searchMatchesRef.current;

    // Replace all matches in reverse order (to maintain positions)
    const changes = [...matches].reverse().map(match => ({
      from: match.from,
      to: match.to,
      insert: replaceText
    }));

    viewRef.current.dispatch({
      changes,
      effects: setSearchMatches.of([])
    });

    // Clear matches
    searchMatchesRef.current = [];
    currentMatchIndexRef.current = -1;
  }, []);

  // Expose search methods via ref
  useImperativeHandle(ref, () => ({
    search: performSearch,
    nextMatch,
    previousMatch,
    clearSearch,
    replace,
    replaceAll
  }), [performSearch, nextMatch, previousMatch, clearSearch, replace, replaceAll]);

  useEffect(() => {
    if (!editorRef.current) return;

    const languageExtension = getLanguageExtension(detectedLanguage);

    const saveKeyBinding = keymap.of([
      {
        key: "Mod-s",
        run: () => {
          if (onSave && viewRef.current) {
            onSave(viewRef.current.state.doc.toString());
          }
          return true;
        },
      },
    ]);

    const startState = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        history(),
        foldGutter(),
        indentOnInput(),
        bracketMatching(),
        syntaxHighlighting(customHighlightStyle),
        customTheme, // Custom theme with visible cursor for dark background
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(readOnly),
        highlightSelectionMatches(), // Highlight matching selections
        searchMatchesField, // Add search matches field
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        saveKeyBinding,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            handleChange(update.state.doc.toString());
          }
        }),
        ...(Array.isArray(languageExtension) ? languageExtension : [languageExtension]),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filename, readOnly]); // Re-create editor only when file changes

  // Update content when it changes externally (new file loaded)
  useEffect(() => {
    if (viewRef.current && !isInternalChangeRef.current) {
      const currentContent = viewRef.current.state.doc.toString();
      if (currentContent !== content) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: content,
          },
        });
      }
    }
    // Reset the internal change flag after processing
    isInternalChangeRef.current = false;
  }, [content]);

  return (
    <div
      ref={editorRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "auto", // Restored to "auto" to allow scrolling
        fontFamily: 'JetBrains Mono, SF Mono, Monaco, Inconsolata, "Courier New", monospace',
        fontSize: "14px",
      }}
    />
  );
});

CodeEditorCodeMirror.displayName = 'CodeEditorCodeMirror';

export default CodeEditorCodeMirror;
