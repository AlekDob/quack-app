/**
 * CodeMirrorMergeView
 *
 * Wrapper around @codemirror/merge MergeView for side-by-side diff.
 * Uses the same theme as CodeEditorEngine for visual consistency.
 *
 * @module CodeMirrorMergeView
 */

// Brain: pattern-code-editor-tab
import { useEffect, useRef } from 'react';
import { MergeView } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { getLanguageFromFilename } from '../../utils/languageDetection';
import { customTheme, highlightExtension } from './editorTheme';
import { getLanguageExtension } from './editorLanguages';

interface CodeMirrorMergeViewProps {
  original: string;
  modified: string;
  filePath: string;
}

/** Shared extensions for both panes */
function buildExtensions(language: string) {
  const langExt = getLanguageExtension(language);
  return [
    customTheme,
    highlightExtension,
    EditorView.editable.of(false),
    EditorState.readOnly.of(true),
    ...(Array.isArray(langExt) ? langExt : [langExt]),
  ];
}

function CodeMirrorMergeViewComponent({ original, modified, filePath }: CodeMirrorMergeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);

  const language = getLanguageFromFilename(filePath) || 'plaintext';

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous instance
    if (mergeViewRef.current) {
      mergeViewRef.current.destroy();
    }

    const extensions = buildExtensions(language);

    const view = new MergeView({
      a: { doc: original, extensions },
      b: { doc: modified, extensions },
      parent: containerRef.current,
      collapseUnchanged: { margin: 3, minSize: 4 },
    });

    mergeViewRef.current = view;

    return () => {
      view.destroy();
      mergeViewRef.current = null;
    };
  }, [original, modified, language]);

  return (
    <div
      ref={containerRef}
      className="code-mirror-merge-view"
      style={{
        flex: 1,
        overflow: 'auto',
        fontFamily: 'JetBrains Mono, SF Mono, Monaco, Inconsolata, "Courier New", monospace',
        fontSize: '14px',
      }}
    />
  );
}

export default CodeMirrorMergeViewComponent;
