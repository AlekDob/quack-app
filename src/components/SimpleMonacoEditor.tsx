import Editor, { type Monaco } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import type { editor } from "monaco-editor";
import { registerMonacoForThemes } from "../editorColorThemes";
import { readEditorMonoFont } from "../editorMonoFont";
import { useResolvedEditorColorTheme } from "../useResolvedEditorColorTheme";
import { useEditorSettings } from "../editorSettings";
import { langOf } from "../langDetect";

interface Props {
  path: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

export function SimpleMonacoEditor({
  path,
  value,
  onChange,
  readOnly = false,
}: Props) {
  const theme = useResolvedEditorColorTheme();
  const settings = useEditorSettings();
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.updateOptions({
      fontSize: settings.fontSize,
      wordWrap: settings.wordWrap,
      minimap: { enabled: settings.minimap },
    });
  }, [settings.fontSize, settings.wordWrap, settings.minimap]);

  return (
    <Editor
      height="100%"
      path={path}
      keepCurrentModel
      language={langOf(path)}
      value={value}
      theme={theme}
      options={{
        readOnly,
        colorDecorators: true,
        fontFamily: readEditorMonoFont(),
        fontSize: settings.fontSize,
        minimap: { enabled: settings.minimap },
        scrollBeyondLastLine: false,
        tabSize: settings.tabSize,
        automaticLayout: true,
        wordWrap: settings.wordWrap,
        smoothScrolling: true,
        padding: { top: 8 },
      }}
      onMount={(ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
        registerMonacoForThemes(monaco);
        editorRef.current = ed;
      }}
      onChange={(v) => onChange(v ?? "")}
    />
  );
}
