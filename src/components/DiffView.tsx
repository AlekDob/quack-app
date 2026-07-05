import { DiffEditor } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { ensureEditorColorThemes, registerMonacoForThemes } from "../editorColorThemes";
import { readEditorMonoFont } from "../editorMonoFont";
import { useResolvedEditorColorTheme } from "../useResolvedEditorColorTheme";
import { useEditorSettings } from "../editorSettings";
import { langOf } from "../langDetect";

interface Props {
  originalContent: string;
  modifiedContent: string;
  path: string;
  sideBySide?: boolean;
  onDiffMount?: (editor: editor.IStandaloneDiffEditor) => void;
}

export function DiffView({
  originalContent,
  modifiedContent,
  path,
  sideBySide = false,
  onDiffMount,
}: Props) {
  const theme = useResolvedEditorColorTheme();
  const settings = useEditorSettings();
  return (
    <div className="diff-view">
      <DiffEditor
        key={sideBySide ? "diff-split" : "diff-inline"}
        height="100%"
        original={originalContent}
        modified={modifiedContent}
        language={langOf(path)}
        theme={theme}
        beforeMount={ensureEditorColorThemes}
        onMount={(ed, monaco) => {
          registerMonacoForThemes(monaco);
          onDiffMount?.(ed);
        }}
        options={{
          readOnly: true,
          colorDecorators: true,
          fontFamily: readEditorMonoFont(),
          renderSideBySide: sideBySide,
          // Monaco 0.44+ falls back to inline when width is "limited" unless
          // this is explicitly disabled — without it Split looks like Inline.
          useInlineViewWhenSpaceIsLimited: false,
          originalEditable: false,
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: settings.fontSize,
        }}
      />
    </div>
  );
}
