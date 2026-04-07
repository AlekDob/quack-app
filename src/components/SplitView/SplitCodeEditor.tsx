/**
 * SplitCodeEditor
 *
 * Standalone code editor for the split pane.
 * Reads file independently via Tauri invoke — does NOT use the singleton editorStore.
 * This prevents the two panes from fighting over the same store state.
 */
import { memo, useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { invoke } from '@tauri-apps/api/core';
import CodeEditorSkeleton from '../skeletons/CodeEditorSkeleton';
import EditorIDEDropdown from '../editor/EditorIDEDropdown';
import '../editor/CodeEditorView.css';

const CodeEditorEngine = lazy(() => import('../editor/CodeEditorEngine'));

interface SplitCodeEditorProps {
  filePath: string;
}

function SplitCodeEditor({ filePath }: SplitCodeEditorProps) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const savedContentRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsDirty(false);
    invoke<string>('read_file_content', { path: filePath })
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          savedContentRef.current = text;
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [filePath]);

  const handleChange = useCallback((value: string) => {
    setContent(value);
    setIsDirty(value !== savedContentRef.current);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      await invoke('write_file_content', {
        path: filePath,
        content,
      });
      savedContentRef.current = content;
      setIsDirty(false);
    } catch (error) {
      console.error('[SplitCodeEditor] Save failed:', error);
    }
  }, [filePath, content]);

  if (isLoading) {
    return <CodeEditorSkeleton />;
  }

  const breadcrumb = filePath.split('/').slice(-3).join(' / ');

  return (
    <div className="code-editor-view">
      <div className="editor-header">
        <div className="editor-header-left">
          <div className="editor-breadcrumb">
            {breadcrumb}
          </div>
          {isDirty && <span className="editor-dirty-dot" title="Non salvato" />}
          <span className="editor-mode-badge">Modifica</span>
        </div>
        <div className="editor-header-right">
          <button
            type="button"
            className="editor-btn editor-btn-save"
            onClick={handleSave}
            disabled={!isDirty}
          >
            Salva
          </button>
          <EditorIDEDropdown filePath={filePath} />
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Suspense fallback={<CodeEditorSkeleton />}>
          <CodeEditorEngine
            content={content}
            filename={filePath.split('/').pop() || 'file'}
            language={getLanguageFromPath(filePath)}
            onChange={handleChange}
          />
        </Suspense>
      </div>
    </div>
  );
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go',
    html: 'html', css: 'css', scss: 'css',
    json: 'json', md: 'markdown',
    yaml: 'yaml', yml: 'yaml',
    toml: 'toml', sh: 'shell', bash: 'shell',
    sql: 'sql', xml: 'xml', svg: 'xml',
    java: 'java', kt: 'kotlin', swift: 'swift',
    rb: 'ruby', php: 'php', cpp: 'cpp',
    c: 'cpp', h: 'cpp', vue: 'vue',
  };
  return map[ext] || 'text';
}

export default memo(SplitCodeEditor);
