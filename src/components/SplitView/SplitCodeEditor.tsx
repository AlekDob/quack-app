/**
 * SplitCodeEditor
 *
 * Standalone code editor for the split pane.
 * Reads file independently via Tauri invoke — does NOT use the singleton editorStore.
 * This prevents the two panes from fighting over the same store state.
 */
import { memo, useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useShortcutsStore } from '../../stores/shortcutsStore';
import CodeEditorSkeleton from '../skeletons/CodeEditorSkeleton';
import EditorIDEDropdown from '../editor/EditorIDEDropdown';
import MarkdownText from '../MarkdownText';
import MermaidDiagram from '../MermaidDiagram';
import KeyboardShortcutTooltip from '../KeyboardShortcutTooltip';
import '../editor/CodeEditorView.css';

/** Build key string from KeyboardEvent matching shortcutsStore format */
function buildKeyString(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey) parts.push('Meta');
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  const key = e.key;
  if (!['Meta', 'Control', 'Alt', 'Shift', 'Dead'].includes(key)) {
    parts.push(key.length === 1 ? key.toUpperCase() : key);
  }
  return parts.join('+');
}

const CodeEditorEngine = lazy(() => import('../editor/CodeEditorEngine'));

interface SplitCodeEditorProps {
  filePath: string;
}

function SplitCodeEditor({ filePath }: SplitCodeEditorProps) {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const savedContentRef = useRef('');
  const isMarkdown = filePath.endsWith('.md') || filePath.endsWith('.mdx');
  const isMermaid = filePath.endsWith('.mmd');
  const hasPreview = isMarkdown || isMermaid;
  const shortcuts = useShortcutsStore(s => s.shortcuts);

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

  // Keyboard shortcuts: toggle preview + save in preview mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const previewKeys = shortcuts.toggleEditorPreview?.currentKeys || '';
      const saveKeys = shortcuts.editorSave?.currentKeys || '';
      const pressed = buildKeyString(e);

      if (pressed === previewKeys && hasPreview) {
        e.preventDefault();
        setPreviewOpen(p => !p);
        return;
      }

      if (pressed === saveKeys && previewOpen && isDirty) {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, hasPreview, previewOpen, isDirty, handleSave]);

  if (isLoading) {
    return <CodeEditorSkeleton />;
  }

  const formatShortcut = useShortcutsStore(s => s.formatShortcut);
  const previewShortcut = formatShortcut(shortcuts.toggleEditorPreview?.currentKeys || '');
  const saveShortcut = formatShortcut(shortcuts.editorSave?.currentKeys || '');
  const breadcrumb = filePath.split('/').slice(-3).join(' / ');

  return (
    <div className="code-editor-view">
      <div className="editor-header">
        <div className="editor-header-left">
          <div className="editor-breadcrumb">
            {breadcrumb}
          </div>
          {isDirty && <span className="editor-dirty-dot" title="Non salvato" />}
          <span className={`editor-mode-badge ${previewOpen ? 'preview' : ''}`}>
            {previewOpen ? 'Anteprima' : 'Modifica'}
          </span>
        </div>
        <div className="editor-header-right">
          {hasPreview && (
            <KeyboardShortcutTooltip
              label={previewOpen ? 'Code editor' : 'Preview'}
              shortcut={previewShortcut}
              position="bottom"
            >
              <button
                type="button"
                className={`editor-btn editor-btn-preview${previewOpen ? ' active' : ''}`}
                onClick={() => setPreviewOpen(p => !p)}
              >
                {previewOpen ? 'Editor' : 'Preview'}
              </button>
            </KeyboardShortcutTooltip>
          )}
          <KeyboardShortcutTooltip label="Salva" shortcut={saveShortcut} position="bottom">
            <button
              type="button"
              className="editor-btn editor-btn-save"
              onClick={handleSave}
              disabled={!isDirty}
            >
              Salva
            </button>
          </KeyboardShortcutTooltip>
          <EditorIDEDropdown filePath={filePath} />
        </div>
      </div>
      {previewOpen ? (
        <div className="editor-markdown-preview">
          {isMermaid ? <MermaidDiagram>{content}</MermaidDiagram> : <MarkdownText>{content}</MarkdownText>}
        </div>
      ) : (
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
      )}
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
    json: 'json', md: 'markdown', mmd: 'markdown',
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
