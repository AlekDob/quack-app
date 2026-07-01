import { DiffEditor } from "@monaco-editor/react";
import { useResolvedTheme } from "../theme";
import { langOf } from "../langDetect";
import { useEditorSettings } from "../editorSettings";

interface Props {
  originalContent: string;
  modifiedContent: string;
  path: string;
  sideBySide?: boolean;
}

export function DiffView({
  originalContent,
  modifiedContent,
  path,
  sideBySide = false,
}: Props) {
  const theme = useResolvedTheme();
  const settings = useEditorSettings();
  return (
    <div className="diff-view">
      <DiffEditor
        key={sideBySide ? "diff-split" : "diff-inline"}
        height="100%"
        original={originalContent}
        modified={modifiedContent}
        language={langOf(path)}
        theme={theme === "dark" ? "vs-dark" : "vs"}
        options={{
          readOnly: true,
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
