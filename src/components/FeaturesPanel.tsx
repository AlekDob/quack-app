/**
 * Features Panel — Sidebar accordion section
 * Lists all documented features with drag-to-mention support.
 * Dragging a feature into ChatInput inserts @feature:doc-path mention.
 */

import { useCallback, useMemo, useState } from 'react';
import { useFeatureMapData } from '../hooks/useFeatureMapData';
import { classifyNode, LAYERS } from './featureMap/featureMapLayout';
import type { FeatureNode } from './featureMap/featureMapTypes';
import './FeaturesPanel.css';

// Layer badge colors (compact)
const LAYER_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  ui:    { bg: 'rgba(0,217,255,0.12)', color: '#00d9ff', label: 'UI' },
  logic: { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', label: 'Logic' },
  infra: { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8', label: 'Infra' },
};

interface Props {
  projectPath: string | null;
  onOpenInEditor?: (filePath: string) => void;
}

export default function FeaturesPanel({ projectPath, onOpenInEditor }: Props) {
  const { graph, loading, error, refresh } = useFeatureMapData(projectPath ?? undefined);
  const [searchQuery, setSearchQuery] = useState('');

  const handleDragStart = useCallback((e: React.DragEvent, node: FeatureNode) => {
    const data = JSON.stringify({
      type: 'feature',
      id: node.id,
      title: node.title,
      docPath: node.docPath,
    });
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/quack-feature', data);
    e.dataTransfer.setData('text/plain', node.docPath);
  }, []);

  // Filter by search query — MUST be before early returns (Rules of Hooks)
  const q = searchQuery.toLowerCase();
  const filteredNodes = useMemo(() => {
    if (!graph || !q) return graph?.nodes ?? [];
    return graph.nodes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.purpose.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q))
    );
  }, [graph, q]);

  if (loading) {
    return (
      <div className="fp-loading">
        <div className="fm-spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fp-error">
        <span>{error}</span>
        <button className="fp-retry" onClick={refresh}>Retry</button>
      </div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="fp-empty">
        <span>No features in <code>documentation/features/</code></span>
      </div>
    );
  }

  // Group by layer
  const grouped = new Map<string, FeatureNode[]>();
  for (const layer of LAYERS) grouped.set(layer.id, []);
  for (const node of filteredNodes) {
    const layerId = classifyNode(node);
    const list = grouped.get(layerId) ?? [];
    list.push(node);
    grouped.set(layerId, list);
  }

  return (
    <div className="fp-container">
      <div className="fp-header">
        <span className="fp-count">
          {searchQuery
            ? `${filteredNodes.length} / ${graph.nodes.length} feature`
            : `${graph.nodes.length} feature`}
        </span>
        <button className="fp-refresh" onClick={refresh} title="Refresh">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-3.21-6.88" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </div>

      {graph.nodes.length > 0 && (
        <div className="fp-search-wrap">
          <svg className="fp-search-icon" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            className="fp-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search features..."
          />
        </div>
      )}

      {searchQuery && filteredNodes.length === 0 && (
        <div className="fp-no-results">Nessun risultato per "{searchQuery}"</div>
      )}

      {LAYERS.map(layer => {
        const nodes = grouped.get(layer.id) ?? [];
        if (nodes.length === 0) return null;
        const badge = LAYER_BADGE[layer.id] ?? LAYER_BADGE.infra;

        return (
          <div key={layer.id} className="fp-group">
            <div className="fp-group-label">
              <span
                className="fp-layer-dot"
                style={{ background: badge.color }}
              />
              {layer.emoji} {layer.label}
              <span className="fp-group-count">{nodes.length}</span>
            </div>
            {nodes.map(node => (
              <div
                key={node.id}
                className="fp-item"
                draggable
                onDragStart={(e) => handleDragStart(e, node)}
                onClick={() => onOpenInEditor?.(node.docPath)}
                title={`Click to open • Drag to chat to mention`}
                style={{ cursor: onOpenInEditor ? 'pointer' : undefined }}
              >
                <span className="fp-item-title">{node.title}</span>
                <span
                  className="fp-item-badge"
                  style={{ background: badge.bg, color: badge.color }}
                >
                  {badge.label}
                </span>
                {node.files.length > 0 && (
                  <span className="fp-item-files">{node.files.length}</span>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
