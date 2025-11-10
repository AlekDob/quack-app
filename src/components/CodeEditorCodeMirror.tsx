import { useEffect, useRef, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";

// Custom theme with black background and high contrast colors
const customTheme = EditorView.theme({
  "&": {
    backgroundColor: "#1E1E1E !important", // Dark gray (VS Code dark)
    color: "#D4D4D4", // Light gray text for dark background
  },
  ".cm-content": {
    caretColor: "#FFFFFF", // White cursor
  },
  ".cm-gutters": {
    backgroundColor: "#1E1E1E !important",
    borderRight: "1px solid #333333",
    color: "#858585",
  },
  ".cm-scroller": {
    backgroundColor: "#1E1E1E !important",
  },
  ".cm-line": {
    color: "#D4D4D4", // Light gray for default text
  },
  // Cursor visibility - white for dark background
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#FFFFFF !important",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#FFFFFF !important",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(255, 255, 255, 0.2) !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "rgba(255, 255, 255, 0.2) !important",
  },
  // Syntax colors optimized for black background - brighter for better contrast
  ".cm-string": { color: "#FF6B6B" }, // Bright red for strings
  ".cm-number": { color: "#B5CEA8" }, // Light green for numbers
  ".cm-keyword": { color: "#C792EA" }, // Bright purple for keywords
  ".cm-operator": { color: "#89DDFF" }, // Bright cyan for operators
  ".cm-variableName": { color: "#82AAFF" }, // Bright blue for variables
  ".cm-propertyName": { color: "#82AAFF" }, // Bright blue for properties
  ".cm-comment": { color: "#6A9955" }, // Green for comments
  ".cm-atom": { color: "#F78C6C" }, // Orange for atoms (true/false/null)
  ".cm-meta": { color: "#C792EA" }, // Purple for meta
  ".cm-bracket": { color: "#FFD700" }, // Gold for brackets
});
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

export default function CodeEditorCodeMirror({
  content,
  filename,
  language,
  readOnly = false,
  onChange,
  onSave,
  diffInfo,
}: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isInternalChangeRef = useRef(false); // Track if change is from user typing

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
        syntaxHighlighting(defaultHighlightStyle),
        customTheme, // Custom theme with visible cursor for dark background
        EditorView.editable.of(!readOnly),
        EditorState.readOnly.of(readOnly),
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
        overflow: "auto",
        fontFamily: 'JetBrains Mono, SF Mono, Monaco, Inconsolata, "Courier New", monospace',
        fontSize: "14px",
      }}
    />
  );
}
