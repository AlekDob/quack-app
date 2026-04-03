/**
 * Feature Map — Main container
 * Composes: data hook + canvas + popover + annotations + toolbar
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useFeatureMapData } from '../../hooks/useFeatureMapData';
import { useAnnotations } from '../../hooks/useAnnotations';
import FeatureMapCanvas from './FeatureMapCanvas';
import type { NodeClickInfo } from './FeatureMapCanvas';
import FeatureMapPopover from './FeatureMapPopover';
import AnnotationToolbar from './AnnotationToolbar';
import type { NodePosition } from './featureMapTypes';
import type { AnnotationMode } from './annotationTypes';
import './FeatureMapView.css';

const POS_KEY = 'quack:featureMap:positions:';

function loadPositions(path: string): Map<string, NodePosition> {
  try {
    const raw = localStorage.getItem(POS_KEY + path);
    if (!raw) return new Map();
    return new Map(Object.entries(JSON.parse(raw) as Record<string, NodePosition>));
  } catch { return new Map(); }
}

function savePositions(path: string, m: Map<string, NodePosition>) {
  const obj: Record<string, NodePosition> = {};
  m.forEach((v, k) => { obj[k] = v; });
  localStorage.setItem(POS_KEY + path, JSON.stringify(obj));
}

interface Props {
  projectPath?: string;
  onOpenFileInEditor?: (filePath: string) => void;
}

export default function FeatureMapView({ projectPath, onOpenFileInEditor }: Props) {
  const { graph, loading, error, refresh } = useFeatureMapData(projectPath);
  const ann = useAnnotations(projectPath);
  const [clickInfo, setClickInfo] = useState<NodeClickInfo | null>(null);
  const [customPositions, setCustomPositions] = useState<Map<string, NodePosition>>(new Map());
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>('select');
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);

  useEffect(() => {
    if (projectPath) setCustomPositions(loadPositions(projectPath));
  }, [projectPath]);

  const selectedNodeId = clickInfo?.nodeId ?? null;
  const hasCustom = customPositions.size > 0;

  const handleNodeSelect = useCallback((info: NodeClickInfo | null) => setClickInfo(info), []);
  const handleNodeDrag = useCallback((nodeId: string, x: number, y: number) => {
    setCustomPositions(prev => {
      const next = new Map(prev); next.set(nodeId, { x, y });
      if (projectPath) savePositions(projectPath, next);
      return next;
    });
  }, [projectPath]);

  const handleResetLayout = useCallback(() => {
    setCustomPositions(new Map());
    if (projectPath) localStorage.removeItem(POS_KEY + projectPath);
    ann.clearAll();
  }, [projectPath, ann]);

  const handleFileClick = useCallback((rel: string) => {
    onOpenFileInEditor?.(projectPath ? `${projectPath}/${rel}` : rel);
  }, [onOpenFileInEditor, projectPath]);

  const handleNodeNavigate = useCallback((nodeId: string) => {
    setClickInfo(prev => prev ? { ...prev, nodeId } : null);
  }, []);

  const selectedNode = useMemo(
    () => graph?.nodes.find(n => n.id === selectedNodeId) ?? null,
    [graph?.nodes, selectedNodeId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setClickInfo(null); setAnnotationMode('select'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading) return (
    <div className="fm-container"><div className="fm-loading">
      <div className="fm-spinner" /><span>Caricamento feature map...</span>
    </div></div>
  );
  if (error) return (
    <div className="fm-container"><div className="fm-error">
      <span>Errore: {error}</span>
      <button className="fm-retry-btn" onClick={refresh}>Riprova</button>
    </div></div>
  );
  if (!graph || graph.nodes.length === 0) return (
    <div className="fm-container"><div className="fm-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={0.4}>
        <circle cx="12" cy="12" r="3" /><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" />
        <circle cx="5" cy="18" r="2" /><circle cx="19" cy="18" r="2" />
        <line x1="9.5" y1="10.5" x2="6.5" y2="7.5" /><line x1="14.5" y1="10.5" x2="17.5" y2="7.5" />
        <line x1="9.5" y1="13.5" x2="6.5" y2="16.5" /><line x1="14.5" y1="13.5" x2="17.5" y2="16.5" />
      </svg>
      <h3>Nessuna feature documentata</h3>
      <p>Aggiungi file .md in <code>documentation/features/</code></p>
    </div></div>
  );

  return (
    <div className="fm-container">
      <div className="fm-header">
        <h2 className="fm-title">Feature Map</h2>
        <div className="fm-stats">
          {graph.nodes.length} feature &middot; {graph.links.length} connessioni
        </div>
        {(hasCustom || ann.hasAnnotations) && (
          <button className="fm-reset-btn" onClick={handleResetLayout} title="Ripristina tutto">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" />
              <path d="M21 3v5h-5" /><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            Reset
          </button>
        )}
        <button className="fm-refresh-btn" onClick={refresh} title="Aggiorna dati">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-3.21-6.88" /><path d="M21 3v6h-6" />
          </svg>
        </button>
      </div>

      <div className="fm-body">
        <div className="fm-canvas-area">
          <FeatureMapCanvas
            graph={graph}
            onNodeSelect={handleNodeSelect}
            selectedNodeId={selectedNodeId}
            customPositions={customPositions}
            onNodeDrag={handleNodeDrag}
            annotations={ann.annotations}
            annotationMode={annotationMode}
            selectedAnnotationId={selectedAnnId}
            onAnnotationSelect={setSelectedAnnId}
            onPostItAdd={ann.addPostIt}
            onPostItUpdate={ann.updatePostIt}
            onPostItRemove={ann.removePostIt}
            onGroupAdd={ann.addGroup}
            onGroupUpdate={ann.updateGroup}
            onGroupRemove={ann.removeGroup}
          />
          <AnnotationToolbar mode={annotationMode} onModeChange={setAnnotationMode} />
        </div>
      </div>

      {selectedNode && clickInfo && (
        <FeatureMapPopover
          node={selectedNode} links={graph.links} allNodes={graph.nodes}
          screenX={clickInfo.screenX} screenY={clickInfo.screenY}
          onClose={() => setClickInfo(null)}
          onFileClick={handleFileClick} onNodeNavigate={handleNodeNavigate}
        />
      )}
    </div>
  );
}
