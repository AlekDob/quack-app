/**
 * Feature Map — Main container
 * Composes: useFeatureMapData + FeatureMapCanvas + popover detail
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useFeatureMapData } from '../../hooks/useFeatureMapData';
import FeatureMapCanvas from './FeatureMapCanvas';
import type { NodeClickInfo } from './FeatureMapCanvas';
import FeatureMapPopover from './FeatureMapPopover';
import './FeatureMapView.css';

interface FeatureMapViewProps {
  projectPath?: string;
  onOpenFileInEditor?: (filePath: string) => void;
}

export default function FeatureMapView({
  projectPath,
  onOpenFileInEditor,
}: FeatureMapViewProps) {
  const { graph, loading, error, refresh } = useFeatureMapData(projectPath);
  const [clickInfo, setClickInfo] = useState<NodeClickInfo | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedNodeId = clickInfo?.nodeId ?? null;

  const handleNodeSelect = useCallback((info: NodeClickInfo | null) => {
    setClickInfo(info);
  }, []);

  const handleFileClick = useCallback((relativePath: string) => {
    // Feature docs store relative paths — Code Editor needs absolute
    const absPath = projectPath
      ? `${projectPath}/${relativePath}`
      : relativePath;
    onOpenFileInEditor?.(absPath);
  }, [onOpenFileInEditor, projectPath]);

  const handleNodeNavigate = useCallback((nodeId: string) => {
    // Navigate to another node — we'd need its screen position
    // For now just center it logically
    setClickInfo(prev => prev ? { ...prev, nodeId } : null);
  }, []);

  const selectedNode = graph?.nodes.find(n => n.id === selectedNodeId) ?? null;

  // Close popover on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setClickInfo(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading) {
    return (
      <div className="fm-container">
        <div className="fm-loading">
          <div className="fm-spinner" />
          <span>Caricamento feature map...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fm-container">
        <div className="fm-error">
          <span>Errore: {error}</span>
          <button className="fm-retry-btn" onClick={refresh}>Riprova</button>
        </div>
      </div>
    );
  }

  if (!graph) return null;

  if (graph.nodes.length === 0) {
    return (
      <div className="fm-container">
        <div className="fm-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" opacity={0.4}>
            <circle cx="12" cy="12" r="3" /><circle cx="5" cy="6" r="2" />
            <circle cx="19" cy="6" r="2" /><circle cx="5" cy="18" r="2" />
            <circle cx="19" cy="18" r="2" />
            <line x1="9.5" y1="10.5" x2="6.5" y2="7.5" />
            <line x1="14.5" y1="10.5" x2="17.5" y2="7.5" />
            <line x1="9.5" y1="13.5" x2="6.5" y2="16.5" />
            <line x1="14.5" y1="13.5" x2="17.5" y2="16.5" />
          </svg>
          <h3>Nessuna feature documentata</h3>
          <p>Aggiungi file .md in <code>documentation/features/</code></p>
        </div>
      </div>
    );
  }

  return (
    <div className="fm-container" ref={containerRef}>
      {/* Header */}
      <div className="fm-header">
        <h2 className="fm-title">Feature Map</h2>
        <div className="fm-stats">
          {graph.nodes.length} feature &middot; {graph.links.length} connessioni
        </div>
        <button className="fm-refresh-btn" onClick={refresh} title="Aggiorna">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-3.21-6.88" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </div>

      {/* Canvas (full area) */}
      <div className="fm-body">
        <div className="fm-canvas-area">
          <FeatureMapCanvas
            graph={graph}
            onNodeSelect={handleNodeSelect}
            selectedNodeId={selectedNodeId}
          />
        </div>
      </div>

      {/* Popover over node */}
      {selectedNode && clickInfo && (
        <FeatureMapPopover
          node={selectedNode}
          links={graph.links}
          allNodes={graph.nodes}
          screenX={clickInfo.screenX}
          screenY={clickInfo.screenY}
          onClose={() => setClickInfo(null)}
          onFileClick={handleFileClick}
          onNodeNavigate={handleNodeNavigate}
        />
      )}
    </div>
  );
}
