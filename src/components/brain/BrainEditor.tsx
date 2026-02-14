import React, { useState, useEffect } from 'react';
import { X, Edit3, Eye, Save } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { readBrainEntry } from '../../services/brainFileService';
import type { BrainEntry } from '../../services/brainFileService';

interface BrainEditorProps {
  filePath: string;
  onClose: () => void;
}

export default function BrainEditor({ filePath, onClose }: BrainEditorProps) {
  const [entry, setEntry] = useState<BrainEntry | null>(null);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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
          <span className="brain-editor-type">{entry.type}</span>
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
        <div
          className="brain-editor-view"
          dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(entry.content) }}
        />
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
