/**
 * EditorOutlinePanel
 *
 * Collapsible sidebar showing AST outline (symbols) for the current file.
 * Uses code-intel Tauri commands via codeIntelService.
 *
 * @module EditorOutlinePanel
 */

// Brain: pattern-code-editor-tab
import { useState, useEffect, useCallback } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { getOutline } from '../../services/codeIntelService';
import type { OutlineSymbol } from '../../services/codeIntelService';

/** Icon map for symbol kinds */
const KIND_ICONS: Record<string, string> = {
  function: 'f',
  method: 'm',
  class: 'C',
  interface: 'I',
  type: 'T',
  enum: 'E',
  variable: 'v',
  property: 'p',
  constructor: 'c',
  constant: 'K',
};

const KIND_COLORS: Record<string, string> = {
  function: '#dcdcaa',
  method: '#dcdcaa',
  class: '#4ec9b0',
  interface: '#4ec9b0',
  type: '#4ec9b0',
  enum: '#4ec9b0',
  variable: '#9cdcfe',
  property: '#9cdcfe',
  constructor: '#dcdcaa',
  constant: '#4fc1ff',
};

interface SymbolRowProps {
  symbol: OutlineSymbol;
  depth: number;
  onNavigate: (line: number) => void;
}

function SymbolRow({ symbol, depth, onNavigate }: SymbolRowProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = symbol.children.length > 0;
  const icon = KIND_ICONS[symbol.kind] || '?';
  const color = KIND_COLORS[symbol.kind] || '#abb2bf';

  return (
    <>
      <button
        className="outline-symbol-row"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onNavigate(symbol.line)}
        title={`${symbol.kind} ${symbol.name} (L${symbol.line})`}
      >
        {hasChildren && (
          <span
            className="outline-expand-toggle"
            onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? '\u25BC' : '\u25B6'}
          </span>
        )}
        <span className="outline-kind-badge" style={{ color }}>
          {icon}
        </span>
        <span className="outline-symbol-name">{symbol.name}</span>
        {symbol.exported && (
          <span className="outline-exported-badge">exp</span>
        )}
        <span className="outline-line-number">:{symbol.line}</span>
      </button>
      {hasChildren && expanded && symbol.children.map(child => (
        <SymbolRow
          key={`${child.name}-${child.line}`}
          symbol={child}
          depth={depth + 1}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
}

interface EditorOutlinePanelProps {
  onNavigateToLine: (line: number) => void;
}

function EditorOutlinePanel({ onNavigateToLine }: EditorOutlinePanelProps) {
  const filePath = useEditorStore(s => s.filePath);
  const [symbols, setSymbols] = useState<OutlineSymbol[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOutline = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getOutline(path);
      setSymbols(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSymbols([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (filePath) fetchOutline(filePath);
    else setSymbols([]);
  }, [filePath, fetchOutline]);

  if (!filePath) return null;

  return (
    <div className="editor-outline-panel">
      <div className="outline-header">
        <span className="outline-header-title">Outline</span>
        <span className="outline-header-count">
          {symbols.length}
        </span>
      </div>
      <div className="outline-list">
        {loading && (
          <div className="outline-status">Loading...</div>
        )}
        {error && (
          <div className="outline-status outline-error">{error}</div>
        )}
        {!loading && !error && symbols.length === 0 && (
          <div className="outline-status">No symbols</div>
        )}
        {symbols.map(sym => (
          <SymbolRow
            key={`${sym.name}-${sym.line}`}
            symbol={sym}
            depth={0}
            onNavigate={onNavigateToLine}
          />
        ))}
      </div>
    </div>
  );
}

export default EditorOutlinePanel;
