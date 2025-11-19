import { useRef, useCallback, useMemo, useEffect } from "react";
// DEPRECATED: Monaco Editor removed in favor of CodeMirror (see docs/08-optimizations/01-completed/remove-monaco-editor.md)
// Use CodeEditorCodeMirror.tsx instead
// import Editor from "@monaco-editor/react";
// import type * as monaco from "monaco-editor";

export interface DiffInfo {
  additions: number[]; // Array di numeri di linea aggiunte
  deletions: number[]; // Array di numeri di linea rimosse
  modifications: number[]; // Array di numeri di linea modificate
}

// Export type separately for lazy loading compatibility
export type { DiffInfo as DiffInfoType };

interface CodeEditorProps {
  content: string;
  filename: string | null;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  diffInfo?: DiffInfo | null; // Informazioni sulle modifiche per evidenziare le linee
}

const getLanguageFromFilename = (filename: string | null): string => {
  if (!filename) return "plaintext";

  const extension = filename.split(".").pop()?.toLowerCase() || "";

  const languageMap: Record<string, string> = {
    // JavaScript/TypeScript
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    mjs: "javascript",
    cjs: "javascript",

    // Web
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    sass: "scss",
    less: "less",

    // Data
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    toml: "toml",

    // Documents
    md: "markdown",
    mdx: "markdown",
    markdown: "markdown",

    // Programming Languages
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    php: "php",
    rb: "ruby",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    ps1: "powershell",

    // Config files
    dockerfile: "dockerfile",
    gitignore: "ignore",
    env: "plaintext",
    ini: "ini",
    cfg: "ini",
    conf: "plaintext",

    // Others
    sql: "sql",
    graphql: "graphql",
    vue: "vue",
    svelte: "svelte",
  };

  return languageMap[extension] || "plaintext";
};

export default function CodeEditor({
  content,
  filename,
  language,
  readOnly = false,
  onChange,
  onSave,
  diffInfo,
}: CodeEditorProps) {
  // DEPRECATED: This component is no longer used - replaced by CodeEditorCodeMirror
  // Return a migration notice instead
  return (
    <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
      <p>⚠️ CodeEditor (Monaco) is deprecated</p>
      <p>Use CodeEditorCodeMirror instead</p>
      <p>See: docs/08-optimizations/01-completed/remove-monaco-editor.md</p>
    </div>
  );

  /* COMMENTED OUT - Monaco Editor code
  const editorRef = useRef<any | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const detectedLanguage = useMemo(() => {
    return language || getLanguageFromFilename(filename);
  }, [language, filename]);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined && onChange) {
        onChange(value);
      }
    },
    [onChange]
  );

  // Applica le decorazioni per evidenziare le modifiche
  const applyDiffDecorations = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !diffInfo) {
      // Rimuovi decorazioni esistenti se non c'è diff
      if (decorationsRef.current.length > 0) {
        decorationsRef.current =
          editor?.deltaDecorations(decorationsRef.current, []) ?? [];
      }
      return;
    }

    const decorations: monaco.editor.IModelDeltaDecoration[] = [];

    // Aggiunte (verde)
    for (const lineNumber of diffInfo.additions) {
      decorations.push({
        range: new (window as any).monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: true,
          className: "diff-line-added",
          glyphMarginClassName: "diff-glyph-added",
          overviewRuler: {
            color: "#4ade8099",
            position: (window as any).monaco.editor.OverviewRulerLane.Left,
          },
          minimap: {
            color: "#4ade8099",
            position: (window as any).monaco.editor.MinimapPosition.Inline,
          },
        },
      });
    }

    // Rimozioni (rosso)
    for (const lineNumber of diffInfo.deletions) {
      decorations.push({
        range: new (window as any).monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: true,
          className: "diff-line-deleted",
          glyphMarginClassName: "diff-glyph-deleted",
          overviewRuler: {
            color: "#f8717199",
            position: (window as any).monaco.editor.OverviewRulerLane.Left,
          },
          minimap: {
            color: "#f8717199",
            position: (window as any).monaco.editor.MinimapPosition.Inline,
          },
        },
      });
    }

    // Modifiche (giallo/arancione)
    for (const lineNumber of diffInfo.modifications) {
      decorations.push({
        range: new (window as any).monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: true,
          className: "diff-line-modified",
          glyphMarginClassName: "diff-glyph-modified",
          overviewRuler: {
            color: "#fbbf2499",
            position: (window as any).monaco.editor.OverviewRulerLane.Left,
          },
          minimap: {
            color: "#fbbf2499",
            position: (window as any).monaco.editor.MinimapPosition.Inline,
          },
        },
      });
    }

    // Applica le decorazioni
    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      decorations
    );
  }, [diffInfo]);

  const handleEditorDidMount = useCallback(
    (
      editor: monaco.editor.IStandaloneCodeEditor,
      monaco: typeof import("monaco-editor")
    ) => {
      editorRef.current = editor;

      // Configure editor
      editor.updateOptions({
        fontSize: 14,
        fontFamily:
          'JetBrains Mono, SF Mono, Monaco, Inconsolata, Fira Code, Consolas, "Courier New", monospace',
        lineNumbers: "on",
        roundedSelection: false,
        scrollBeyondLastLine: false,
        readOnly,
        minimap: { enabled: true },
        folding: true,
        lineDecorationsWidth: 10,
        lineNumbersMinChars: 3,
        glyphMargin: false,
        renderWhitespace: "selection",
        renderControlCharacters: false,
        automaticLayout: true,
      });

      // Add save shortcut (Cmd/Ctrl + S)
      if (!readOnly && onSave) {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          const value = editor.getValue();
          onSave(value);
        });
      }

      // Add format shortcut (Shift + Alt + F)
      editor.addCommand(
        monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
        () => {
          editor.getAction("editor.action.formatDocument")?.run();
        }
      );

      // Applica decorazioni diff dopo il mount
      setTimeout(() => {
        applyDiffDecorations();
      }, 100);
    },
    [readOnly, onSave, applyDiffDecorations]
  );

  // Aggiorna le decorazioni quando cambia diffInfo o content
  useEffect(() => {
    if (editorRef.current) {
      applyDiffDecorations();
    }
  }, [diffInfo, applyDiffDecorations]);

  return (
    <div>Monaco Editor Deprecated</div>
    // <Editor
    //   height="100%"
    //   language={detectedLanguage}
    //   value={content}
    //   theme="vs-dark"
    //   onChange={handleChange}
    //   onMount={handleEditorDidMount}
    //   options={{
    //     readOnly,
    //     contextmenu: true,
    //     selectOnLineNumbers: true,
    //     automaticLayout: true,
    //   }}
    // />
  );
  */
}
