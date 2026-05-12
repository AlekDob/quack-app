/**
 * Feature Map — Main container
 * Composes: data hook + canvas + popover + annotations + toolbar
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useFeatureMapData } from '../../hooks/useFeatureMapData';
import { useWhiteboardFile } from '../../hooks/useWhiteboardFile';
import { useCanvasSelection } from '../../hooks/useCanvasSelection';
import { calculateLayeredLayout } from './featureMapLayout';
import { IMAGE_DEFAULT_W, IMAGE_DEFAULT_H } from './annotationTypes';
import type { AnnotationMode, ComponentNavigation } from './annotationTypes';
import FeatureMapCanvas from './FeatureMapCanvas';
import type { NodeClickInfo } from './FeatureMapCanvas';
import FeatureMapPopover from './FeatureMapPopover';
import AnnotationToolbar from './AnnotationToolbar';
import WhiteboardBreadcrumb from './WhiteboardBreadcrumb';
import { normalizeToForwardSlash } from '../../utils/platform';
import './FeatureMapView.css';

interface Props {
  projectPath?: string;
  onOpenFileInEditor?: (filePath: string) => void;
}

export default function FeatureMapView({ projectPath, onOpenFileInEditor }: Props) {
  const { graph, loading, error, refresh } = useFeatureMapData(projectPath);
  const wb = useWhiteboardFile(projectPath);
  const selection = useCanvasSelection();
  const [clickInfo, setClickInfo] = useState<NodeClickInfo | null>(null);
  const [annotationMode, setAnnotationMode] = useState<AnnotationMode>('select');
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImagePos = useRef<{ x: number; y: number } | null>(null);

  // --- Component navigation (matryoshka) ---
  const [navigation, setNavigation] = useState<ComponentNavigation>({
    currentComponentId: null, breadcrumb: [],
  });

  const enterComponent = useCallback((id: string, label: string) => {
    setNavigation(prev => ({
      currentComponentId: id,
      breadcrumb: [...prev.breadcrumb, { id, label }],
    }));
    selection.clearSelection();
  }, [selection]);

  const exitToRoot = useCallback(() => {
    setNavigation({ currentComponentId: null, breadcrumb: [] });
    selection.clearSelection();
  }, [selection]);

  const navigateToLevel = useCallback((index: number) => {
    setNavigation(prev => ({
      currentComponentId: prev.breadcrumb[index]?.id ?? null,
      breadcrumb: prev.breadcrumb.slice(0, index + 1),
    }));
    selection.clearSelection();
  }, [selection]);

  const exitUp = useCallback(() => {
    setNavigation(prev => {
      if (prev.breadcrumb.length <= 1) return { currentComponentId: null, breadcrumb: [] };
      const newBc = prev.breadcrumb.slice(0, -1);
      return { currentComponentId: newBc[newBc.length - 1].id, breadcrumb: newBc };
    });
    selection.clearSelection();
  }, [selection]);

  // Empty graph fallback — whiteboard still works for annotations
  const safeGraph = graph ?? { nodes: [], links: [] };

  // Visible annotations filtered by current navigation level
  const visibleAnnotations = useMemo(
    () => wb.getVisibleAnnotations(navigation.currentComponentId),
    [wb, navigation.currentComponentId],
  );

  // Visible nodes filtered by component level
  const visibleNodeIds = useMemo((): Set<string> | null => {
    const na = wb.nodeAssignments;
    const hasAssignments = Object.keys(na).length > 0;
    if (!navigation.currentComponentId) {
      if (!hasAssignments) return null; // no filtering, show all
      // Root: show nodes NOT assigned to any component
      const assignedIds = new Set(Object.keys(na));
      return new Set(safeGraph.nodes.filter(n => !assignedIds.has(n.id)).map(n => n.id));
    }
    // Inside component: show only nodes assigned to this component
    const visible = new Set<string>();
    for (const [nodeId, compId] of Object.entries(na)) {
      if (compId === navigation.currentComponentId) visible.add(nodeId);
    }
    return visible;
  }, [wb.nodeAssignments, navigation.currentComponentId, safeGraph.nodes]);

  const handleCreateComponent = useCallback(() => {
    if (selection.selectionCount < 2) return;
    // Build full node positions map (custom overrides + layout defaults)
    const allNodePositions = new Map<string, { x: number; y: number }>();
    if (safeGraph.nodes.length > 0) {
      const layout = calculateLayeredLayout(safeGraph.nodes, 900);
      for (const node of safeGraph.nodes) {
        const custom = wb.customPositions.get(node.id);
        const layoutPos = layout.positions.get(node.id);
        if (custom) allNodePositions.set(node.id, custom);
        else if (layoutPos) allNodePositions.set(node.id, layoutPos);
      }
    }
    wb.createComponent(selection.selectedIds, 'Component', navigation.currentComponentId, allNodePositions);
    selection.clearSelection();
  }, [wb, selection, navigation.currentComponentId, safeGraph]);

  /** Receive lasso selection results from Canvas */
  const handleLassoSelect = useCallback((ids: Set<string>) => {
    selection.setSelection(ids);
  }, [selection]);

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
    () => safeGraph.nodes.find(n => n.id === selectedNodeId) ?? null,
    [safeGraph.nodes, selectedNodeId],
  );

  const MODES: AnnotationMode[] = ['select', 'lasso', 'postit', 'group', 'image', 'mdcard', 'text'];

  const handleOpenMdCardFile = useCallback((relPath: string) => {
    const base = projectPath ? normalizeToForwardSlash(projectPath) : '';
    onOpenFileInEditor?.(base ? `${base}/${relPath.replace(/^\//, '')}` : relPath);
  }, [onOpenFileInEditor, projectPath]);

  // Clipboard for Cmd+C / Cmd+V (whiteboard-internal — does NOT use the system clipboard).
  // Holds the IDs that were "copied"; paste re-resolves them against the current annotations
  // and clones via `duplicateAnnotations`. Offset grows on consecutive pastes so the user
  // can press Cmd+V multiple times in a row without overlapping.
  const clipboardIdsRef = useRef<string[]>([]);
  const pasteOffsetRef = useRef<number>(0);

  useEffect(() => {
    const isEditableTarget = (t: EventTarget | null): boolean => {
      if (!(t instanceof HTMLElement)) return false;
      if (t.isContentEditable) return true;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (navigation.currentComponentId) { exitUp(); } // inside component: go up
        else { setClickInfo(null); setAnnotationMode('select'); setSearchQuery(''); selection.clearSelection(); }
      }
      if (e.key === 'Backspace' && navigation.currentComponentId) { exitUp(); }
      if (e.key === 'Control') {
        e.preventDefault();
        setAnnotationMode(prev => {
          const idx = MODES.indexOf(prev);
          return MODES[(idx + 1) % MODES.length];
        });
      }
      // Cmd+Z / Ctrl+Z = undo, Cmd+Shift+Z / Ctrl+Shift+Z = redo
      if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) { wb.redo(); } else { wb.undo(); }
      }

      // Copy / Paste / Duplicate — operate on annotations only (feature nodes are auto-generated)
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (isEditableTarget(e.target)) return; // never hijack edits inside textareas

      const key = e.key.toLowerCase();

      if (key === 'c') {
        const ids = Array.from(selection.selectedIds);
        if (ids.length === 0) return;
        e.preventDefault();
        clipboardIdsRef.current = ids;
        pasteOffsetRef.current = 0;
        return;
      }

      if (key === 'v') {
        const ids = clipboardIdsRef.current;
        if (ids.length === 0) return;
        e.preventDefault();
        pasteOffsetRef.current += 24;
        const off = pasteOffsetRef.current;
        const newIds = wb.duplicateAnnotations(ids, off, off);
        if (newIds.length > 0) {
          selection.setSelection(new Set(newIds));
          // Move the "clipboard cursor" forward so the next Cmd+V keeps stacking outward
          clipboardIdsRef.current = newIds;
        }
        return;
      }

      if (key === 'd') {
        const ids = Array.from(selection.selectedIds);
        if (ids.length === 0) return;
        e.preventDefault();
        const newIds = wb.duplicateAnnotations(ids, 24, 24);
        if (newIds.length > 0) selection.setSelection(new Set(newIds));
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [wb, navigation.currentComponentId, exitUp, selection]);

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
  return (
    <div className="fm-container">
      <div className="fm-header">
        <h2 className="fm-title">{projectPath?.split('/').pop() ?? 'Whiteboard'}</h2>
        <div className="fm-stats">
          {safeGraph.nodes.length > 0
            ? `${safeGraph.nodes.length} features \u00B7 ${safeGraph.links.length} connections`
            : (projectPath?.split('/').pop() ?? '')}
        </div>
        <div className="fm-search-wrap">
          <svg className="fm-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className="fm-search-input"
            type="text"
            placeholder="Search features..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setSearchQuery(''); e.currentTarget.blur(); } }}
          />
          {searchQuery && (
            <button className="fm-search-clear" onClick={() => setSearchQuery('')}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
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

      <WhiteboardBreadcrumb navigation={navigation} onNavigate={navigateToLevel} onExitToRoot={exitToRoot} />

      <div className="fm-body">
        <div className="fm-canvas-area">
          <FeatureMapCanvas
            graph={safeGraph}
            onNodeSelect={handleNodeSelect}
            selectedNodeId={selectedNodeId}
            customPositions={wb.customPositions}
            onNodeDrag={handleNodeDrag}
            annotations={visibleAnnotations}
            annotationMode={annotationMode}
            currentComponentId={navigation.currentComponentId}
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
            onMdCardAdd={wb.addMdCard}
            onMdCardUpdate={wb.updateMdCard}
            onMdCardRemove={wb.removeMdCard}
            onOpenMdCardFile={handleOpenMdCardFile}
            onTextAdd={wb.addText}
            onTextUpdate={wb.updateText}
            onTextRemove={wb.removeText}
            onDuplicateAnnotations={wb.duplicateAnnotations}
            projectPath={projectPath ?? ''}
            onResetMode={handleResetMode}
            searchQuery={searchQuery}
            multiSelectedIds={selection.selectedIds}
            lassoRect={selection.lassoRect}
            onLassoStart={selection.startLasso}
            onLassoUpdate={selection.updateLasso}
            onLassoSelect={handleLassoSelect}
            onLassoReset={selection.resetLasso}
            onMultiToggle={selection.toggleSelect}
            onMultiClear={selection.clearSelection}
            onBeginDrag={wb.beginDrag}
            onEndDrag={wb.endDrag}
            onEnterComponent={enterComponent}
            getChildCount={wb.getChildCount}
            getChildAnnotations={wb.getChildAnnotations}
            visibleNodeIds={visibleNodeIds}
            onAssignToComponent={wb.assignToComponent}
            onEjectFromComponent={wb.ejectFromComponent}
          />
          <AnnotationToolbar
            mode={annotationMode}
            onModeChange={setAnnotationMode}
            selectionCount={selection.selectionCount}
            onCreateComponent={handleCreateComponent}
            canCreateComponent={wb.canCreateComponent(navigation.currentComponentId)}
          />
        </div>
      </div>

      {/* Hidden file input for image picker */}
      <input ref={fileInputRef} type="file" accept="image/*"
        style={{ display: 'none' }} onChange={handleFileInputChange} />

      {selectedNode && clickInfo && (
        <FeatureMapPopover
          node={selectedNode} links={safeGraph.links} allNodes={safeGraph.nodes}
          screenX={clickInfo.screenX} screenY={clickInfo.screenY}
          onClose={() => setClickInfo(null)}
          onFileClick={handleFileClick} onNodeNavigate={handleNodeNavigate}
          onOpenDoc={onOpenFileInEditor} projectPath={projectPath}
        />
      )}
    </div>
  );
}
