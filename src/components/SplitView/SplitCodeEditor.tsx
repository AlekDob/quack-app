/**
 * SplitCodeEditor
 *
 * Standalone code editor for the split pane.
 * Reads file independently via Tauri invoke — does NOT use the singleton editorStore.
 * This prevents the two panes from fighting over the same store state.
 */
import { memo, useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { invoke } from '@tauri-apps/api/core';
import CodeEditorSkeleton from '../skeletons/CodeEditorSkeleton';

const CodeEditorEngine = lazy(() => import('../editor/CodeEditorEngine'));

interface SplitCodeEditorProps {
  filePath: string;
}

function SplitCodeEditor({ filePath }: SplitCodeEditorProps) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    invoke<string>('read_file_content', { path: filePath })
      .then((text) => {
        if (!cancelled) {
          setContent(text);
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
  }, []);

  if (isLoading) {
    return <CodeEditorSkeleton />;
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        padding: '4px 12px',
        fontSize: 11,
        color: 'rgba(255,255,255,0.45)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {filePath.split('/').slice(-3).join(' / ')}
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
