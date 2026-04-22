// src/components/office/v2/useOfficeLayout.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { readOfficeLayout, writeOfficeLayout } from './officeStorage';
import { bootstrapLayoutFromTerminals, reconcileLayoutWithTerminals } from './officeMigration';
import { WRITE_DEBOUNCE_MS } from './officeConstants';
import type { OfficeLayout } from './officeTypes';
import type { TerminalInfo } from '../../../types';

interface UseOfficeLayoutResult {
  layout: OfficeLayout | null;
  setRoomPosition: (projectPath: string, x: number, y: number, zoneId?: string) => void;
  setZonePosition: (zoneId: string, x: number, y: number) => void;
  setZoneSize: (zoneId: string, w: number, h: number) => void;
  toggleTag: (tagId: string) => void;
  setBreakRoomPosition: (x: number, y: number) => void;
  ready: boolean;
}

export function useOfficeLayout(terminals: TerminalInfo[]): UseOfficeLayoutResult {
  const [layout, setLayout] = useState<OfficeLayout | null>(null);
  const [ready, setReady] = useState(false);
  const writeTimerRef = useRef<number | null>(null);

  // Initial load — once only.
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
        // first-run: persist the bootstrap
        await writeOfficeLayout(reconciled);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally once

  // Reconcile when terminals change (after first load)
  useEffect(() => {
    if (!ready || !layout) return;
    const reconciled = reconcileLayoutWithTerminals(layout, terminals);
    if (reconciled.rooms.length !== layout.rooms.length) {
      setLayout(reconciled);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminals, ready]);

  // Debounced write
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

  const setRoomPosition = useCallback((projectPath: string, x: number, y: number, zoneId?: string) => {
    setLayout(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rooms: prev.rooms.map(r =>
          r.projectPath === projectPath ? { ...r, x, y, zoneId } : r
        ),
      };
    });
  }, []);

  const setZonePosition = useCallback((zoneId: string, x: number, y: number) => {
    setLayout(prev => {
      if (!prev) return prev;
      const zone = prev.zones.find(z => z.id === zoneId);
      if (!zone) return prev;
      const dx = x - zone.x;
      const dy = y - zone.y;
      return {
        ...prev,
        zones: prev.zones.map(z => z.id === zoneId ? { ...z, x, y } : z),
        rooms: prev.rooms.map(r => r.zoneId === zoneId ? { ...r, x: r.x + dx, y: r.y + dy } : r),
      };
    });
  }, []);

  const setZoneSize = useCallback((zoneId: string, w: number, h: number) => {
    setLayout(prev => prev ? {
      ...prev,
      zones: prev.zones.map(z => z.id === zoneId ? { ...z, w, h } : z),
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

  const setBreakRoomPosition = useCallback((x: number, y: number) => {
    setLayout(prev => prev ? { ...prev, breakRoom: { x, y } } : prev);
  }, []);

  return { layout, setRoomPosition, setZonePosition, setZoneSize, toggleTag, setBreakRoomPosition, ready };
}
