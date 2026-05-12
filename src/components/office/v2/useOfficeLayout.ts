import { useEffect, useRef, useState, useCallback } from 'react';
import { readOfficeLayout, writeOfficeLayout } from './officeStorage';
import { bootstrapLayoutFromTerminals, reconcileLayoutWithTerminals } from './officeMigration';
import { WRITE_DEBOUNCE_MS, UNDO_STACK_MAX } from './officeConstants';
import type { OfficeLayout, OfficeCustomGroup, OfficePostIt, OfficeSticker, OfficeTag, OfficeText } from './officeTypes';
import type { TerminalInfo } from '../../../types';

interface UseOfficeLayoutResult {
  layout: OfficeLayout | null;
  setRoomPosition: (projectPath: string, x: number, y: number) => void;
  toggleTag: (tagId: string) => void;
  resetLayout: () => void;

  addPostIt: (postIt: OfficePostIt) => void;
  updatePostIt: (id: string, patch: Partial<Omit<OfficePostIt, 'id'>>) => void;
  deletePostIt: (id: string) => void;

  addCustomGroup: (group: OfficeCustomGroup) => void;
  updateCustomGroup: (id: string, patch: Partial<Omit<OfficeCustomGroup, 'id'>>) => void;
  deleteCustomGroup: (id: string) => void;

  addSticker: (sticker: OfficeSticker) => void;
  updateSticker: (id: string, patch: Partial<Omit<OfficeSticker, 'id'>>) => void;
  deleteSticker: (id: string) => void;

  addText: (text: OfficeText) => void;
  updateText: (id: string, patch: Partial<Omit<OfficeText, 'id'>>) => void;
  deleteText: (id: string) => void;

  /** Clone post-its/custom-groups/stickers/texts (NOT rooms) with x/y offset.
   *  ids use the selection-key format `${kind}:${id}` (kind = postit|group|sticker|text).
   *  Returns the new ids in the same selection-key format. */
  duplicateItems: (selectionKeys: string[], offsetX?: number, offsetY?: number) => string[];

  addTag: (tag: OfficeTag) => void;
  deleteTag: (tagId: string) => void;
  toggleRoomTag: (projectPath: string, tagId: string) => void;

  beginDrag: () => void;
  endDrag: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  ready: boolean;
}

export function useOfficeLayout(terminals: TerminalInfo[]): UseOfficeLayoutResult {
  const [layout, setLayout] = useState<OfficeLayout | null>(null);
  const [ready, setReady] = useState(false);
  const writeTimerRef = useRef<number | null>(null);

  const pastRef = useRef<OfficeLayout[]>([]);
  const futureRef = useRef<OfficeLayout[]>([]);
  const draggingRef = useRef(false);
  const [historyVersion, setHistoryVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const persisted = await readOfficeLayout();
      if (cancelled) return;
      const base = persisted ?? bootstrapLayoutFromTerminals(terminals);
      const reconciled = reconcileLayoutWithTerminals(base, terminals);
      setLayout(reconciled);
      setReady(true);
      if (!persisted) {
        await writeOfficeLayout(reconciled);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !layout) return;
    const reconciled = reconcileLayoutWithTerminals(layout, terminals);
    if (reconciled.rooms.length !== layout.rooms.length) {
      setLayout(reconciled);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminals, ready]);

  useEffect(() => {
    if (!ready || !layout) return;
    if (writeTimerRef.current) window.clearTimeout(writeTimerRef.current);
    writeTimerRef.current = window.setTimeout(() => {
      writeOfficeLayout(layout).catch(err => console.error('[office-v2] write failed', err));
    }, WRITE_DEBOUNCE_MS);
    return () => {
      if (writeTimerRef.current) window.clearTimeout(writeTimerRef.current);
    };
  }, [layout, ready]);

  const pushHistory = useCallback((prevLayout: OfficeLayout) => {
    pastRef.current = [...pastRef.current, prevLayout].slice(-UNDO_STACK_MAX);
    futureRef.current = [];
    setHistoryVersion(v => v + 1);
  }, []);

  const setWithHistory = useCallback((updater: (prev: OfficeLayout) => OfficeLayout) => {
    setLayout(prev => {
      if (!prev) return prev;
      const next = updater(prev);
      if (next === prev) return prev;
      if (!draggingRef.current) pushHistory(prev);
      return next;
    });
  }, [pushHistory]);

  const beginDrag = useCallback(() => {
    if (draggingRef.current) return;
    setLayout(prev => {
      if (prev) pushHistory(prev);
      return prev;
    });
    draggingRef.current = true;
  }, [pushHistory]);

  const endDrag = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const undo = useCallback(() => {
    setLayout(prev => {
      if (!prev || pastRef.current.length === 0) return prev;
      const last = pastRef.current[pastRef.current.length - 1];
      pastRef.current = pastRef.current.slice(0, -1);
      futureRef.current = [prev, ...futureRef.current].slice(0, UNDO_STACK_MAX);
      setHistoryVersion(v => v + 1);
      return last;
    });
  }, []);

  const redo = useCallback(() => {
    setLayout(prev => {
      if (!prev || futureRef.current.length === 0) return prev;
      const first = futureRef.current[0];
      futureRef.current = futureRef.current.slice(1);
      pastRef.current = [...pastRef.current, prev].slice(-UNDO_STACK_MAX);
      setHistoryVersion(v => v + 1);
      return first;
    });
  }, []);

  const setRoomPosition = useCallback((projectPath: string, x: number, y: number) => {
    setWithHistory(prev => ({
      ...prev,
      rooms: prev.rooms.map(r => r.projectPath === projectPath ? { ...r, x, y } : r),
    }));
  }, [setWithHistory]);

  const toggleTag = useCallback((tagId: string) => {
    setWithHistory(prev => {
      const active = new Set(prev.activeTagIds);
      if (active.has(tagId)) active.delete(tagId); else active.add(tagId);
      return { ...prev, activeTagIds: [...active] };
    });
  }, [setWithHistory]);

  const resetLayout = useCallback(() => {
    const fresh = bootstrapLayoutFromTerminals(terminals);
    setWithHistory(() => fresh);
  }, [terminals, setWithHistory]);

  const addPostIt = useCallback((postIt: OfficePostIt) => {
    setWithHistory(prev => ({ ...prev, postIts: [...prev.postIts, postIt] }));
  }, [setWithHistory]);

  const updatePostIt = useCallback((id: string, patch: Partial<Omit<OfficePostIt, 'id'>>) => {
    setWithHistory(prev => ({
      ...prev,
      postIts: prev.postIts.map(p => p.id === id ? { ...p, ...patch } : p),
    }));
  }, [setWithHistory]);

  const deletePostIt = useCallback((id: string) => {
    setWithHistory(prev => ({ ...prev, postIts: prev.postIts.filter(p => p.id !== id) }));
  }, [setWithHistory]);

  const addCustomGroup = useCallback((group: OfficeCustomGroup) => {
    setWithHistory(prev => ({ ...prev, customGroups: [...prev.customGroups, group] }));
  }, [setWithHistory]);

  const updateCustomGroup = useCallback((id: string, patch: Partial<Omit<OfficeCustomGroup, 'id'>>) => {
    setWithHistory(prev => ({
      ...prev,
      customGroups: prev.customGroups.map(g => g.id === id ? { ...g, ...patch } : g),
    }));
  }, [setWithHistory]);

  const deleteCustomGroup = useCallback((id: string) => {
    setWithHistory(prev => ({ ...prev, customGroups: prev.customGroups.filter(g => g.id !== id) }));
  }, [setWithHistory]);

  const addSticker = useCallback((sticker: OfficeSticker) => {
    setWithHistory(prev => ({ ...prev, stickers: [...prev.stickers, sticker] }));
  }, [setWithHistory]);

  const updateSticker = useCallback((id: string, patch: Partial<Omit<OfficeSticker, 'id'>>) => {
    setWithHistory(prev => ({
      ...prev,
      stickers: prev.stickers.map(s => s.id === id ? { ...s, ...patch } : s),
    }));
  }, [setWithHistory]);

  const deleteSticker = useCallback((id: string) => {
    setWithHistory(prev => ({ ...prev, stickers: prev.stickers.filter(s => s.id !== id) }));
  }, [setWithHistory]);

  const addText = useCallback((text: OfficeText) => {
    setWithHistory(prev => ({ ...prev, texts: [...(prev.texts ?? []), text] }));
  }, [setWithHistory]);

  const updateText = useCallback((id: string, patch: Partial<Omit<OfficeText, 'id'>>) => {
    setWithHistory(prev => ({
      ...prev,
      texts: (prev.texts ?? []).map(t => t.id === id ? { ...t, ...patch } : t),
    }));
  }, [setWithHistory]);

  const deleteText = useCallback((id: string) => {
    setWithHistory(prev => ({ ...prev, texts: (prev.texts ?? []).filter(t => t.id !== id) }));
  }, [setWithHistory]);

  const duplicateItems = useCallback((selectionKeys: string[], offsetX = 24, offsetY = 24): string[] => {
    if (selectionKeys.length === 0) return [];
    const newKeys: string[] = [];
    const nid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
    setWithHistory(prev => {
      const newPostIts: OfficePostIt[] = [...prev.postIts];
      const newGroups: OfficeCustomGroup[] = [...prev.customGroups];
      const newStickers: OfficeSticker[] = [...prev.stickers];
      const newTexts: OfficeText[] = [...(prev.texts ?? [])];

      for (const key of selectionKeys) {
        const colonIdx = key.indexOf(':');
        if (colonIdx === -1) continue;
        const kind = key.slice(0, colonIdx);
        const id = key.slice(colonIdx + 1);

        if (kind === 'postit') {
          const src = prev.postIts.find(p => p.id === id);
          if (!src) continue;
          const clone: OfficePostIt = { ...src, id: nid('p'), x: src.x + offsetX, y: src.y + offsetY };
          newPostIts.push(clone);
          newKeys.push(`postit:${clone.id}`);
        } else if (kind === 'group') {
          const src = prev.customGroups.find(g => g.id === id);
          if (!src) continue;
          const clone: OfficeCustomGroup = { ...src, id: nid('g'), x: src.x + offsetX, y: src.y + offsetY };
          newGroups.push(clone);
          newKeys.push(`group:${clone.id}`);
        } else if (kind === 'sticker') {
          const src = prev.stickers.find(s => s.id === id);
          if (!src) continue;
          const clone: OfficeSticker = { ...src, id: nid('s'), x: src.x + offsetX, y: src.y + offsetY };
          newStickers.push(clone);
          newKeys.push(`sticker:${clone.id}`);
        } else if (kind === 'text') {
          const src = (prev.texts ?? []).find(t => t.id === id);
          if (!src) continue;
          const clone: OfficeText = { ...src, id: nid('t'), x: src.x + offsetX, y: src.y + offsetY };
          newTexts.push(clone);
          newKeys.push(`text:${clone.id}`);
        }
        // 'room' keys are intentionally skipped — rooms are auto-managed.
      }

      return {
        ...prev,
        postIts: newPostIts,
        customGroups: newGroups,
        stickers: newStickers,
        texts: newTexts,
      };
    });
    return newKeys;
  }, [setWithHistory]);

  const addTag = useCallback((tag: OfficeTag) => {
    setWithHistory(prev => {
      if (prev.tags.some(t => t.id === tag.id)) return prev;
      return { ...prev, tags: [...prev.tags, tag] };
    });
  }, [setWithHistory]);

  const deleteTag = useCallback((tagId: string) => {
    setWithHistory(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t.id !== tagId),
      activeTagIds: prev.activeTagIds.filter(id => id !== tagId),
      rooms: prev.rooms.map(r => ({ ...r, tagIds: r.tagIds.filter(id => id !== tagId) })),
    }));
  }, [setWithHistory]);

  const toggleRoomTag = useCallback((projectPath: string, tagId: string) => {
    setWithHistory(prev => ({
      ...prev,
      rooms: prev.rooms.map(r => {
        if (r.projectPath !== projectPath) return r;
        const has = r.tagIds.includes(tagId);
        return {
          ...r,
          tagIds: has ? r.tagIds.filter(id => id !== tagId) : [...r.tagIds, tagId],
        };
      }),
    }));
  }, [setWithHistory]);

  // Reference historyVersion so useCallback consumers re-render on stack change
  void historyVersion;

  return {
    layout,
    setRoomPosition,
    toggleTag,
    resetLayout,
    addPostIt, updatePostIt, deletePostIt,
    addCustomGroup, updateCustomGroup, deleteCustomGroup,
    addSticker, updateSticker, deleteSticker,
    addText, updateText, deleteText,
    duplicateItems,
    addTag, deleteTag, toggleRoomTag,
    beginDrag, endDrag,
    undo, redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    ready,
  };
}
