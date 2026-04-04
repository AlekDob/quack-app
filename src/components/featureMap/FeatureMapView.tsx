/**
 * Feature Map — Main container
 * Composes: data hook + canvas + popover + annotations + toolbar
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useFeatureMapData } from '../../hooks/useFeatureMapData';
import { useWhiteboardFile } from '../../hooks/useWhiteboardFile';
import { IMAGE_DEFAULT_W, IMAGE_DEFAULT_H } from './annotationTypes';
import FeatureMapCanvas from './FeatureMapCanvas';
import type { NodeClickInfo } from './FeatureMapCanvas';
import FeatureMapPopover from './FeatureMapPopover';
import AnnotationToolbar from './AnnotationToolbar';
import type { AnnotationMode } from './annotationTypes';
import { normalizeToForwardSlash } from '../../utils/platform';
import './FeatureMapView.css';

interface Props {
  projectPath?: string;
  onOpenFileInEditor?: (filePath: string) => void;
}

export default function FeatureMapView({ projectPath, onOpenFileInEditor }: Props) {
  const { graph, loading, error, refresh } = useFeatureMapData(projectPath);
  const wb = useWhiteboardFile(projectPath);
  const [clickInfo, setClickInfo] = useState<NodeClickInfo | null>(null);
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>('select');
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImagePos = useRef<{ x: number; y: number } | null>(null);

  /** Save an image file to documentation/features/images/ and return relative path */
  const saveImageFile = useCallback(async (file: File): Promise<string> => {
    if (!projectPath) throw new Error('No project path');
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const name = `${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const normProject = normalizeToForwardSlash(projectPath);
    const dir = `${normProject}/documentation/features/images`;
    // Ensure directory exists
    try { await invoke('create_directory', { path: dir }); } catch { /* exists */ }
    const bytes = new Uint8Array(await file.arrayBuffer());
    await invoke('write_binary_file', { path: `${dir}/${name}`, data: Array.from(bytes) });
    return `images/${name}`;
  }, [projectPath]);

  const handleImageFilePick = useCallback((x: number, y: number) => {
    pendingImagePos.current = { x, y };
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingImagePos.current) {
      // User cancelled file picker — reset to select
      setAnnotationMode('select');
      return;
    }
    const pos = pendingImagePos.current;
    pendingImagePos.current = null;
    try {
      const src = await saveImageFile(file);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        const w = IMAGE_DEFAULT_W;
        const h = w / ratio;
        wb.addImage(src, pos.x, pos.y, w, h);
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        wb.addImage(src, pos.x, pos.y);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch { /* silent */ }
    // Reset input + mode after use
    e.target.value = '';
    setAnnotationMode('select');
  }, [saveImageFile, wb]);

  const handleImageDrop = useCallback(async (file: File, x: number, y: number) => {
    try {
      const src = await saveImageFile(file);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        const w = IMAGE_DEFAULT_W;
        const h = w / ratio;
        wb.addImage(src, x, y, w, h);
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        wb.addImage(src, x, y);
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } catch { /* silent */ }
    setAnnotationMode('select');
  }, [saveImageFile, wb]);

  const selectedNodeId = clickInfo?.nodeId ?? null;
  const hasCustom = wb.hasCustomPositions;

  const handleResetMode = useCallback(() => setAnnotationMode('select'), []);
  const handleNodeSelect = useCallback((info: NodeClickInfo | null) => setClickInfo(info), []);
  const handleNodeDrag = useCallback((nodeId: string, x: number, y: number) => {
    wb.setNodePosition(nodeId, x, y);
  }, [wb]);

  const handleResetLayout = useCallback(() => {
    wb.clearAll();
  }, [wb]);

  const handleFileClick = useCallback((rel: string) => {
    const base = projectPath ? normalizeToForwardSlash(projectPath) : '';
    onOpenFileInEditor?.(base ? `${base}/${rel}` : rel);
  }, [onOpenFileInEditor, projectPath]);

  const handleNodeNavigate = useCallback((nodeId: string) => {
    setClickInfo(prev => prev ? { ...prev, nodeId } : null);
  }, []);

  const selectedNode = useMemo(
    () => graph?.nodes.find(n => n.id === selectedNodeId) ?? null,
    [graph?.nodes, selectedNodeId],
  );

  const MODES: AnnotationMode[] = ['select', 'postit', 'group', 'image'];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setClickInfo(null); setAnnotationMode('select'); }
      if (e.key === 'Control') {
        e.preventDefault();
        setAnnotationMode(prev => {
          const idx = MODES.indexOf(prev);
          return MODES[(idx + 1) % MODES.length];
        });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (loading) return (
    <div className="fm-container"><div className="fm-loading">
      <div className="fm-spinner" /><span>Loading feature map...</span>
    </div></div>
  );
  if (error) return (
    <div className="fm-container"><div className="fm-error">
      <span>Error: {error}</span>
      <button className="fm-retry-btn" onClick={refresh}>Retry</button>
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
      <h3>No documented features</h3>
      <p>Add .md files in <code>documentation/features/</code></p>
    </div></div>
  );

  return (
    <div className="fm-container">
      <div className="fm-header">
        <h2 className="fm-title">Feature Map</h2>
        <div className="fm-stats">
          {graph.nodes.length} features &middot; {graph.links.length} connections
        </div>
        {(hasCustom || wb.hasAnnotations) && (
          <button className="fm-reset-btn" onClick={handleResetLayout} title="Reset all">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" />
              <path d="M21 3v5h-5" /><path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            Reset
          </button>
        )}
        <button className="fm-refresh-btn" onClick={refresh} title="Refresh">
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
            customPositions={wb.customPositions}
            onNodeDrag={handleNodeDrag}
            annotations={wb.annotations}
            annotationMode={annotationMode}
            selectedAnnotationId={selectedAnnId}
            onAnnotationSelect={setSelectedAnnId}
            onPostItAdd={wb.addPostIt}
            onPostItUpdate={wb.updatePostIt}
            onPostItRemove={wb.removePostIt}
            onGroupAdd={wb.addGroup}
            onGroupUpdate={wb.updateGroup}
            onGroupRemove={wb.removeGroup}
            onImageAdd={wb.addImage}
            onImageUpdate={wb.updateImage}
            onImageRemove={wb.removeImage}
            onImageFilePick={handleImageFilePick}
            onImageDrop={handleImageDrop}
            projectPath={projectPath ?? ''}
            onResetMode={handleResetMode}
          />
          <AnnotationToolbar mode={annotationMode} onModeChange={setAnnotationMode} />
        </div>
      </div>

      {/* Hidden file input for image picker */}
      <input ref={fileInputRef} type="file" accept="image/*"
        style={{ display: 'none' }} onChange={handleFileInputChange} />

      {selectedNode && clickInfo && (
        <FeatureMapPopover
          node={selectedNode} links={graph.links} allNodes={graph.nodes}
          screenX={clickInfo.screenX} screenY={clickInfo.screenY}
          onClose={() => setClickInfo(null)}
          onFileClick={handleFileClick} onNodeNavigate={handleNodeNavigate}
          onOpenDoc={onOpenFileInEditor} projectPath={projectPath}
        />
      )}
    </div>
  );
}
