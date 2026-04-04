/**
 * Unified whiteboard hook — file-based persistence for annotations + node positions.
 * Replaces useAnnotations (localStorage) with JSON file via Tauri commands.
 * Polls for external changes (agent writes) every 2 seconds.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type {
  CanvasAnnotations, PostIt, GroupRect, CanvasImage, WhiteboardFile,
} from '../components/featureMap/annotationTypes';
import {
  POST_IT_COLORS, GROUP_COLORS, IMAGE_DEFAULT_W, IMAGE_DEFAULT_H,
} from '../components/featureMap/annotationTypes';
import type { NodePosition } from '../components/featureMap/featureMapTypes';
import {
  readWhiteboardFile, writeWhiteboardFile, migrateFromLocalStorage, emptyFile,
} from '../services/whiteboardFileService';

const POLL_MS = 2000;
const WRITE_LOCK_MS = 500;
const ONBOARDING_KEY = 'quack:featureMap:onboardingSeen:';
const MAX_UNDO = 50;
const MAX_NESTING = 5;
const COMPONENT_PADDING = 20;

function uid(): string { return crypto.randomUUID(); }

/** Default onboarding post-its for first-time users */
function createOnboardingPostIts(): PostIt[] {
  const y = -80;
  const gap = 174;
  const startX = 560;
  return [
    { id: uid(), x: startX, y, color: '#60a5fa',
      text: 'Click a feature card to see details, files, and connections' },
    { id: uid(), x: startX + gap, y, color: '#4ade80',
      text: 'Drag cards to rearrange. Use this right area for notes and sketches' },
    { id: uid(), x: startX + gap * 2, y, color: '#c084fc',
      text: 'Drop images from Finder onto the canvas to annotate your map' },
    { id: uid(), x: startX + gap * 3, y, color: '#fbbf24',
      text: 'Press Ctrl to cycle tools: Select, Post-it, Group, Image' },
  ];
}

function normKey(p: string): string { return p.replace(/\\/g, '/'); }

/** Clear invalid parentComponentId refs (orphan detection) */
function fixOrphans(a: CanvasAnnotations): CanvasAnnotations {
  const componentIds = new Set(a.groups.filter(g => g.isComponent).map(g => g.id));
  const fix = <T extends { parentComponentId?: string }>(items: T[]): T[] =>
    items.map(item => item.parentComponentId && !componentIds.has(item.parentComponentId)
      ? { ...item, parentComponentId: undefined } : item);
  return { postIts: fix(a.postIts), groups: fix(a.groups), images: fix(a.images) };
}

/** Filter annotations visible at a given navigation level */
function filterByParent(a: CanvasAnnotations, componentId: string | null): CanvasAnnotations {
  const match = <T extends { parentComponentId?: string }>(items: T[]): T[] =>
    items.filter(item => (item.parentComponentId ?? null) === componentId);
  return { postIts: match(a.postIts), groups: match(a.groups), images: match(a.images) };
}

/** Calculate nesting depth of a component by walking parentComponentId chain */
function getNestingDepth(componentId: string, groups: GroupRect[]): number {
  let depth = 0;
  let current: string | undefined = componentId;
  while (current) {
    const parent = groups.find(g => g.id === current);
    current = parent?.parentComponentId;
    depth++;
    if (depth > MAX_NESTING + 1) break; // safety
  }
  return depth;
}

/** Compute bounding box of annotation IDs */
function computeBoundingBox(ids: Set<string>, a: CanvasAnnotations): { x: number; y: number; w: number; h: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of a.postIts) {
    if (!ids.has(p.id)) continue;
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x + 160); maxY = Math.max(maxY, p.y + 100);
  }
  for (const g of a.groups) {
    if (!ids.has(g.id)) continue;
    minX = Math.min(minX, g.x); minY = Math.min(minY, g.y);
    maxX = Math.max(maxX, g.x + g.w); maxY = Math.max(maxY, g.y + g.h);
  }
  for (const img of a.images) {
    if (!ids.has(img.id)) continue;
    minX = Math.min(minX, img.x); minY = Math.min(minY, img.y);
    maxX = Math.max(maxX, img.x + img.w); maxY = Math.max(maxY, img.y + img.h);
  }
  return { x: minX - COMPONENT_PADDING, y: minY - COMPONENT_PADDING - 24,
    w: maxX - minX + COMPONENT_PADDING * 2, h: maxY - minY + COMPONENT_PADDING * 2 + 24 };
}

export function useWhiteboardFile(projectPath?: string) {
  const [file, setFile] = useState<WhiteboardFile>(emptyFile());
  const lastWriteTs = useRef(0);
  const lastJson = useRef('');
  const mounted = useRef(true);
  // Undo/redo stacks (snapshots of WhiteboardFile as JSON strings)
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);

  // Persist to file (fire-and-forget), no undo tracking
  const persistRaw = useCallback((next: WhiteboardFile) => {
    setFile(next);
    if (!projectPath) return;
    lastWriteTs.current = Date.now();
    const json = JSON.stringify(next);
    lastJson.current = json;
    writeWhiteboardFile(projectPath, next).catch(() => { /* silent */ });
  }, [projectPath]);

  // Track whether we're in a drag operation (suppress per-move undo snapshots)
  const dragging = useRef(false);

  // Persist with undo snapshot — pushes current state to undo stack before applying
  const persist = useCallback((next: WhiteboardFile, prev: WhiteboardFile) => {
    if (!dragging.current) {
      undoStack.current.push(JSON.stringify(prev));
      if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
      redoStack.current = [];
    }
    persistRaw(next);
  }, [persistRaw]);

  /** Call before starting a drag — saves one undo snapshot for the entire drag */
  const beginDrag = useCallback(() => {
    setFile(prev => {
      undoStack.current.push(JSON.stringify(prev));
      if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
      redoStack.current = [];
      dragging.current = true;
      return prev;
    });
  }, []);

  /** Call when drag ends — re-enables per-action undo snapshots */
  const endDrag = useCallback(() => {
    dragging.current = false;
  }, []);

  // Initial load + migration
  useEffect(() => {
    mounted.current = true;
    if (!projectPath) return;

    (async () => {
      let data = await readWhiteboardFile(projectPath);

      if (!data) {
        // Try localStorage migration
        const migrated = migrateFromLocalStorage(projectPath);
        if (migrated) {
          data = migrated;
          await writeWhiteboardFile(projectPath, data).catch(() => {});
        }
      }

      if (!data) {
        // First time — onboarding
        const key = normKey(projectPath);
        if (!localStorage.getItem(ONBOARDING_KEY + key)) {
          localStorage.setItem(ONBOARDING_KEY + key, '1');
          data = { ...emptyFile(), annotations: { postIts: createOnboardingPostIts(), groups: [], images: [] } };
          await writeWhiteboardFile(projectPath, data).catch(() => {});
        } else {
          data = emptyFile();
        }
      }

      if (mounted.current) {
        // Fix orphaned parentComponentId refs on load
        data = { ...data, annotations: fixOrphans(data.annotations) };
        setFile(data);
        lastJson.current = JSON.stringify(data);
      }
    })();

    return () => { mounted.current = false; };
  }, [projectPath]);

  // Poll for external changes (agent writes)
  useEffect(() => {
    if (!projectPath) return;

    const timer = setInterval(async () => {
      // Skip if we wrote recently (avoid overwriting our own changes)
      if (Date.now() - lastWriteTs.current < WRITE_LOCK_MS) return;

      const data = await readWhiteboardFile(projectPath);
      if (!data || !mounted.current) return;

      const json = JSON.stringify(data);
      if (json !== lastJson.current) {
        lastJson.current = json;
        setFile(data);
      }
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [projectPath]);

  // --- Annotation CRUD ---
  const updateAnnotations = useCallback((updater: (a: CanvasAnnotations) => CanvasAnnotations) => {
    setFile(prev => {
      const next = { ...prev, annotations: updater(prev.annotations) };
      persist(next, prev);
      return next;
    });
  }, [persist]);

  const addPostIt = useCallback((x: number, y: number) => {
    const p: PostIt = { id: uid(), text: '', x, y, color: POST_IT_COLORS[0] };
    updateAnnotations(a => ({ ...a, postIts: [...a.postIts, p] }));
    return p.id;
  }, [updateAnnotations]);

  const updatePostIt = useCallback((id: string, partial: Partial<PostIt>) => {
    updateAnnotations(a => ({
      ...a, postIts: a.postIts.map(p => p.id === id ? { ...p, ...partial } : p),
    }));
  }, [updateAnnotations]);

  const removePostIt = useCallback((id: string) => {
    updateAnnotations(a => ({ ...a, postIts: a.postIts.filter(p => p.id !== id) }));
  }, [updateAnnotations]);

  const addGroup = useCallback((x: number, y: number, w: number, h: number) => {
    const g: GroupRect = { id: uid(), label: 'Gruppo', x, y, w, h, color: GROUP_COLORS[0] };
    updateAnnotations(a => ({ ...a, groups: [...a.groups, g] }));
    return g.id;
  }, [updateAnnotations]);

  const updateGroup = useCallback((id: string, partial: Partial<GroupRect>) => {
    updateAnnotations(a => ({
      ...a, groups: a.groups.map(g => g.id === id ? { ...g, ...partial } : g),
    }));
  }, [updateAnnotations]);

  const removeGroup = useCallback((id: string) => {
    updateAnnotations(a => ({ ...a, groups: a.groups.filter(g => g.id !== id) }));
  }, [updateAnnotations]);

  const addImage = useCallback((src: string, x: number, y: number, w?: number, h?: number) => {
    const img: CanvasImage = { id: uid(), src, x, y, w: w ?? IMAGE_DEFAULT_W, h: h ?? IMAGE_DEFAULT_H };
    updateAnnotations(a => ({ ...a, images: [...a.images, img] }));
    return img.id;
  }, [updateAnnotations]);

  const updateImage = useCallback((id: string, partial: Partial<CanvasImage>) => {
    updateAnnotations(a => ({
      ...a, images: a.images.map(i => i.id === id ? { ...i, ...partial } : i),
    }));
  }, [updateAnnotations]);

  const removeImage = useCallback((id: string) => {
    updateAnnotations(a => ({ ...a, images: a.images.filter(i => i.id !== id) }));
  }, [updateAnnotations]);

  // --- Node positions ---
  const customPositions = useMemo(
    () => new Map(Object.entries(file.positions)) as Map<string, NodePosition>,
    [file.positions],
  );

  const setNodePosition = useCallback((nodeId: string, x: number, y: number) => {
    setFile(prev => {
      const next = { ...prev, positions: { ...prev.positions, [nodeId]: { x, y } } };
      persist(next, prev);
      return next;
    });
  }, [persist]);

  const clearAll = useCallback(() => {
    setFile(prev => {
      const fresh = emptyFile();
      persist(fresh, prev);
      return fresh;
    });
  }, [persist]);

  // --- Undo / Redo ---
  const undo = useCallback(() => {
    const snapshot = undoStack.current.pop();
    if (!snapshot) return;
    setFile(prev => {
      redoStack.current.push(JSON.stringify(prev));
      const restored: WhiteboardFile = JSON.parse(snapshot);
      persistRaw(restored);
      return restored;
    });
  }, [persistRaw]);

  const redo = useCallback(() => {
    const snapshot = redoStack.current.pop();
    if (!snapshot) return;
    setFile(prev => {
      undoStack.current.push(JSON.stringify(prev));
      const restored: WhiteboardFile = JSON.parse(snapshot);
      persistRaw(restored);
      return restored;
    });
  }, [persistRaw]);

  const canUndo = undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  // --- Component CRUD ---

  /** Create a component from selected annotation IDs */
  const createComponent = useCallback((childIds: Set<string>, label = 'Component', currentParent: string | null = null) => {
    const id = uid();
    updateAnnotations(a => {
      const depth = currentParent ? getNestingDepth(currentParent, a.groups) + 1 : 1;
      if (depth > MAX_NESTING) return a; // block if too deep
      const box = computeBoundingBox(childIds, a);
      const comp: GroupRect = {
        id, label, x: box.x, y: box.y, w: box.w, h: box.h,
        color: GROUP_COLORS[0], isComponent: true,
        parentComponentId: currentParent ?? undefined,
      };
      // Assign children to component
      const assign = <T extends { id: string; parentComponentId?: string }>(items: T[]): T[] =>
        items.map(item => childIds.has(item.id) ? { ...item, parentComponentId: id } : item);
      return {
        postIts: assign(a.postIts),
        groups: [...assign(a.groups), comp],
        images: assign(a.images),
      };
    });
    return id;
  }, [updateAnnotations]);

  /** Dissolve a component — promote children to parent level, remove the component */
  const dissolveComponent = useCallback((componentId: string) => {
    updateAnnotations(a => {
      const comp = a.groups.find(g => g.id === componentId && g.isComponent);
      if (!comp) return a;
      const parentId = comp.parentComponentId;
      // Promote children to parent level
      const promote = <T extends { parentComponentId?: string }>(items: T[]): T[] =>
        items.map(item => item.parentComponentId === componentId
          ? { ...item, parentComponentId: parentId } : item);
      return {
        postIts: promote(a.postIts),
        groups: promote(a.groups).filter(g => g.id !== componentId),
        images: promote(a.images),
      };
    });
  }, [updateAnnotations]);

  /** Assign an annotation to a component */
  const assignToComponent = useCallback((annotationId: string, componentId: string) => {
    updateAnnotations(a => {
      const set = <T extends { id: string; parentComponentId?: string }>(items: T[]): T[] =>
        items.map(item => item.id === annotationId ? { ...item, parentComponentId: componentId } : item);
      return { postIts: set(a.postIts), groups: set(a.groups), images: set(a.images) };
    });
  }, [updateAnnotations]);

  /** Eject an annotation from its component (promote to component's parent) */
  const ejectFromComponent = useCallback((annotationId: string) => {
    updateAnnotations(a => {
      // Find annotation's current parent component
      const findParent = (): string | undefined => {
        const p = a.postIts.find(pi => pi.id === annotationId);
        if (p) return p.parentComponentId;
        const g = a.groups.find(gi => gi.id === annotationId);
        if (g) return g.parentComponentId;
        const img = a.images.find(ii => ii.id === annotationId);
        return img?.parentComponentId;
      };
      const currentParent = findParent();
      if (!currentParent) return a; // already at root
      // Find grandparent
      const parentComp = a.groups.find(g => g.id === currentParent);
      const grandParent = parentComp?.parentComponentId;
      const set = <T extends { id: string; parentComponentId?: string }>(items: T[]): T[] =>
        items.map(item => item.id === annotationId ? { ...item, parentComponentId: grandParent } : item);
      return { postIts: set(a.postIts), groups: set(a.groups), images: set(a.images) };
    });
  }, [updateAnnotations]);

  /** Get visible annotations filtered by navigation level */
  const getVisibleAnnotations = useCallback((componentId: string | null): CanvasAnnotations => {
    return filterByParent(file.annotations, componentId);
  }, [file.annotations]);

  /** Count children of a component */
  const getChildCount = useCallback((componentId: string): number => {
    const a = file.annotations;
    return a.postIts.filter(p => p.parentComponentId === componentId).length
      + a.groups.filter(g => g.parentComponentId === componentId).length
      + a.images.filter(i => i.parentComponentId === componentId).length;
  }, [file.annotations]);

  /** Check if creating a component at current level would exceed max nesting */
  const canCreateComponent = useCallback((currentParentId: string | null): boolean => {
    if (!currentParentId) return true; // root level always OK
    return getNestingDepth(currentParentId, file.annotations.groups) < MAX_NESTING;
  }, [file.annotations.groups]);

  const { postIts, groups, images } = file.annotations;
  const hasAnnotations = postIts.length > 0 || groups.length > 0 || images.length > 0;
  const hasCustomPositions = Object.keys(file.positions).length > 0;

  return {
    annotations: file.annotations,
    customPositions,
    hasAnnotations,
    hasCustomPositions,
    addPostIt, updatePostIt, removePostIt,
    addGroup, updateGroup, removeGroup,
    addImage, updateImage, removeImage,
    setNodePosition,
    clearAll,
    undo, redo, canUndo, canRedo,
    beginDrag, endDrag,
    // Component operations
    createComponent, dissolveComponent,
    assignToComponent, ejectFromComponent,
    getVisibleAnnotations, getChildCount, canCreateComponent,
  };
}
