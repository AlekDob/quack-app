import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Edit3, Eye, Save, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import mermaid from 'mermaid';
import { readBrainEntry } from '../../services/brainFileService';
import type { BrainEntry } from '../../services/brainFileService';

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'dark',
  themeVariables: {
    primaryColor: '#FF6B35',
    primaryTextColor: '#e4e4e7',
    primaryBorderColor: '#3a3a40',
    lineColor: '#71717a',
    secondaryColor: '#2a2a30',
    tertiaryColor: '#1a1a1e',
    background: '#1a1a1e',
    mainBkg: '#2a2a30',
    nodeBorder: '#3a3a40',
    clusterBkg: '#25252a',
    titleColor: '#e4e4e7',
    edgeLabelBackground: '#2a2a30',
  },
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
});

interface BrainEditorProps {
  filePath: string;
  onClose: () => void;
}

const isMermaidFile = (path: string) => path.endsWith('.mmd');

export default function BrainEditor({ filePath, onClose }: BrainEditorProps) {
  const [entry, setEntry] = useState<BrainEntry | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const mermaidRef = useRef<HTMLDivElement>(null);
  const mermaidContainerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const minZoom = useRef(0.5);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    loadEntry();
  }, [filePath]);

  const loadEntry = async () => {
    const data = await readBrainEntry(filePath);
    if (data) {
      setEntry(data);
      setEditContent(data.content);
    } else {
      // Fallback: read raw file (e.g. CLAUDE.md without frontmatter)
      try {
        const raw = await invoke<string>('read_file_content', { path: filePath });
        const fileName = filePath.split('/').pop() || 'File';
        setEntry({
          type: 'file',
          created: '',
          tags: [],
          title: fileName,
          content: raw,
          filePath,
        });
        setEditContent(raw);
      } catch {
        // File not found
      }
    }
  };

  const renderMermaid = useCallback(async () => {
    if (!mermaidRef.current || !entry || !isMermaidFile(filePath)) return;
    try {
      const id = `mermaid-${Date.now()}`;
      const { svg } = await mermaid.render(id, entry.content);
      if (mermaidRef.current) mermaidRef.current.innerHTML = svg;
      // Clean up mermaid's hidden render container from the DOM
      document.querySelectorAll('[id^="dmermaid-"]').forEach(el => el.remove());
      // Calculate fit-to-container zoom as minimum
      requestAnimationFrame(() => {
        const svgEl = mermaidRef.current?.querySelector('svg');
        const container = mermaidContainerRef.current;
        if (svgEl && container) {
          const svgW = svgEl.getBoundingClientRect().width;
          const svgH = svgEl.getBoundingClientRect().height;
          const cW = container.clientWidth;
          const cH = container.clientHeight;
          if (svgW > 0 && svgH > 0) {
            minZoom.current = Math.min(cW / svgW, cH / svgH, 1);
          }
        }
      });
    } catch (err) {
      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = `<pre class="brain-mermaid-error">Mermaid render error: ${String(err)}</pre>`;
      }
    }
  }, [entry, filePath]);

  useEffect(() => {
    if (mode === 'view' && isMermaidFile(filePath)) renderMermaid();
  }, [mode, filePath, renderMermaid]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => {
      const factor = Math.pow(1.002, -e.deltaY);
      return Math.min(10, Math.max(minZoom.current, prev * factor));
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleSave = async () => {
    if (!entry) return;

    setSaving(true);
    try {
      let newContent: string;
      if (entry.type === 'file') {
        // Raw file (no frontmatter) — save as-is
        newContent = editContent;
      } else {
        const frontmatter = [
          '---',
          `type: ${entry.type}`,
          entry.project ? `project: ${entry.project}` : null,
          `created: ${entry.created}`,
          entry.tags.length > 0 ? `tags: [${entry.tags.join(', ')}]` : null,
          '---',
        ]
          .filter(Boolean)
          .join('\n');
        newContent = `${frontmatter}\n\n${editContent}`;
      }
      await invoke('write_file_content', { path: filePath, content: newContent });

      setEntry({ ...entry, content: editContent });
      setMode('view');
    } catch (err) {
      console.error('Failed to save entry:', err);
    } finally {
      setSaving(false);
    }
  };

  const simpleMarkdownToHtml = (md: string) => {
    // Extract fenced code blocks first to protect them
    const codeBlocks: string[] = [];
    let processed = md.replace(/```[\s\S]*?```/g, (match) => {
      const content = match.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
      const idx = codeBlocks.length;
      codeBlocks.push(content);
      return `%%CODEBLOCK_${idx}%%`;
    });

    // Extract tables before line-level processing
    const tables: string[] = [];
    processed = processed.replace(
      /(?:^|\n)(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)+)/g,
      (match) => {
        const idx = tables.length;
        tables.push(match.trim());
        return `\n%%TABLE_${idx}%%\n`;
      }
    );

    let html = processed
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/^[-*] (.*$)/gim, '<li>$1</li>')
      .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
      .replace(/\n{2,}/g, '<br/>')
      .replace(/\n/g, ' ');

    // Restore tables as HTML tables
    tables.forEach((table, i) => {
      const rows = table.split('\n').filter(r => r.trim());
      if (rows.length < 2) return;
      const parseRow = (row: string) =>
        row.split('|').slice(1, -1).map(c => c.trim());
      const headers = parseRow(rows[0]);
      const dataRows = rows.slice(2);
      let tableHtml = '<table class="brain-table"><thead><tr>';
      headers.forEach(h => {
        tableHtml += `<th>${h.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';
      dataRows.forEach(row => {
        tableHtml += '<tr>';
        parseRow(row).forEach(cell => {
          const formatted = cell
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
          tableHtml += `<td>${formatted}</td>`;
        });
        tableHtml += '</tr>';
      });
      tableHtml += '</tbody></table>';
      html = html.replace(`%%TABLE_${i}%%`, tableHtml);
    });

    // Restore code blocks as styled pre elements
    codeBlocks.forEach((block, i) => {
      const escaped = block
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      html = html.replace(
        `%%CODEBLOCK_${i}%%`,
        `<pre class="brain-code-block"><code>${escaped}</code></pre>`
      );
    });

    return html;
  };

  if (!entry) {
    return <div className="brain-editor-loading">Loading...</div>;
  }

  return (
    <div className="brain-editor">
      <div className="brain-editor-header">
        <div className="brain-editor-meta">
          <span className={`brain-editor-type ${isMermaidFile(filePath) ? 'brain-editor-type-mermaid' : ''}`}>
            {isMermaidFile(filePath) ? 'diagram' : entry.type}
          </span>
          <span className="brain-editor-date">{entry.created}</span>
          {entry.project && <span className="brain-editor-project">{entry.project}</span>}
        </div>
        <div className="brain-editor-actions">
          <button onClick={() => setMode(mode === 'view' ? 'edit' : 'view')}>
            {mode === 'view' ? <Edit3 size={16} /> : <Eye size={16} />}
            {mode === 'view' ? 'Edit' : 'Preview'}
          </button>
          {mode === 'edit' && (
            <button onClick={handleSave} disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
          <button onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </div>

      {mode === 'view' ? (
        isMermaidFile(filePath) ? (
          <div className="brain-mermaid-container">
            <div className="brain-mermaid-controls">
              <button onClick={() => setZoom(prev => Math.min(10, prev * 1.3))} title="Zoom in">
                <ZoomIn size={14} />
              </button>
              <span className="brain-mermaid-zoom-label">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(prev => Math.max(minZoom.current, prev * 0.7))} title="Zoom out">
                <ZoomOut size={14} />
              </button>
              <button onClick={resetView} title="Reset view">
                <Maximize2 size={14} />
              </button>
            </div>
            <div
              className="brain-mermaid-view"
              ref={mermaidContainerRef}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <div
                ref={mermaidRef}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  cursor: isPanning.current ? 'grabbing' : 'grab',
                }}
              />
            </div>
          </div>
        ) : (
          <div
            className="brain-editor-view"
            dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(entry.content) }}
          />
        )
      ) : (
        <textarea
          className="brain-editor-textarea"
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
        />
      )}
    </div>
  );
}
