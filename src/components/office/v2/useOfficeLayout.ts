import { useEffect, useRef, useState, useCallback } from 'react';
import { readOfficeLayout, writeOfficeLayout } from './officeStorage';
import { bootstrapLayoutFromTerminals, reconcileLayoutWithTerminals } from './officeMigration';
import { WRITE_DEBOUNCE_MS } from './officeConstants';
import type { OfficeLayout, OfficeCustomGroup, OfficePostIt, OfficeSticker } from './officeTypes';
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
  ready: boolean;
}

export function useOfficeLayout(terminals: TerminalInfo[]): UseOfficeLayoutResult {
  const [layout, setLayout] = useState<OfficeLayout | null>(null);
  const [ready, setReady] = useState(false);
  const writeTimerRef = useRef<number | null>(null);

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

  const setRoomPosition = useCallback((projectPath: string, x: number, y: number) => {
    setLayout(prev => prev ? {
      ...prev,
      rooms: prev.rooms.map(r =>
        r.projectPath === projectPath ? { ...r, x, y } : r
      ),
    } : prev);
  }, []);

  const toggleTag = useCallback((tagId: string) => {
    setLayout(prev => {
      if (!prev) return prev;
      const active = new Set(prev.activeTagIds);
      if (active.has(tagId)) active.delete(tagId); else active.add(tagId);
      return { ...prev, activeTagIds: [...active] };
    });
  }, []);

  const resetLayout = useCallback(() => {
    const fresh = bootstrapLayoutFromTerminals(terminals);
    setLayout(fresh);
  }, [terminals]);

  const addPostIt = useCallback((postIt: OfficePostIt) => {
    setLayout(prev => prev ? { ...prev, postIts: [...prev.postIts, postIt] } : prev);
  }, []);

  const updatePostIt = useCallback((id: string, patch: Partial<Omit<OfficePostIt, 'id'>>) => {
    setLayout(prev => prev ? {
      ...prev,
      postIts: prev.postIts.map(p => p.id === id ? { ...p, ...patch } : p),
    } : prev);
  }, []);

  const deletePostIt = useCallback((id: string) => {
    setLayout(prev => prev ? { ...prev, postIts: prev.postIts.filter(p => p.id !== id) } : prev);
  }, []);

  const addCustomGroup = useCallback((group: OfficeCustomGroup) => {
    setLayout(prev => prev ? { ...prev, customGroups: [...prev.customGroups, group] } : prev);
  }, []);

  const updateCustomGroup = useCallback((id: string, patch: Partial<Omit<OfficeCustomGroup, 'id'>>) => {
    setLayout(prev => prev ? {
      ...prev,
      customGroups: prev.customGroups.map(g => g.id === id ? { ...g, ...patch } : g),
    } : prev);
  }, []);

  const deleteCustomGroup = useCallback((id: string) => {
    setLayout(prev => prev ? { ...prev, customGroups: prev.customGroups.filter(g => g.id !== id) } : prev);
  }, []);

  const addSticker = useCallback((sticker: OfficeSticker) => {
    setLayout(prev => prev ? { ...prev, stickers: [...prev.stickers, sticker] } : prev);
  }, []);

  const updateSticker = useCallback((id: string, patch: Partial<Omit<OfficeSticker, 'id'>>) => {
    setLayout(prev => prev ? {
      ...prev,
      stickers: prev.stickers.map(s => s.id === id ? { ...s, ...patch } : s),
    } : prev);
  }, []);

  const deleteSticker = useCallback((id: string) => {
    setLayout(prev => prev ? { ...prev, stickers: prev.stickers.filter(s => s.id !== id) } : prev);
  }, []);

  return {
    layout,
    setRoomPosition,
    toggleTag,
    resetLayout,
    addPostIt,
    updatePostIt,
    deletePostIt,
    addCustomGroup,
    updateCustomGroup,
    deleteCustomGroup,
    addSticker,
    updateSticker,
    deleteSticker,
    ready,
  };
}
