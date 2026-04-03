/**
 * Feature Map — Annotation CRUD hook with localStorage persistence
 */

import { useState, useEffect, useCallback } from 'react';
import type { CanvasAnnotations, PostIt, GroupRect } from '../components/featureMap/annotationTypes';
import { POST_IT_COLORS, GROUP_COLORS } from '../components/featureMap/annotationTypes';

const STORAGE_KEY = 'quack:featureMap:annotations:';

function load(projectPath: string): CanvasAnnotations {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + projectPath);
    if (!raw) return { postIts: [], groups: [] };
    return JSON.parse(raw) as CanvasAnnotations;
  } catch { return { postIts: [], groups: [] }; }
}

function save(projectPath: string, data: CanvasAnnotations) {
  localStorage.setItem(STORAGE_KEY + projectPath, JSON.stringify(data));
}

function uid(): string {
  return crypto.randomUUID();
}

export function useAnnotations(projectPath?: string) {
  const [data, setData] = useState<CanvasAnnotations>({ postIts: [], groups: [] });

  useEffect(() => {
    if (projectPath) setData(load(projectPath));
  }, [projectPath]);

  const persist = useCallback((next: CanvasAnnotations) => {
    setData(next);
    if (projectPath) save(projectPath, next);
  }, [projectPath]);

  const addPostIt = useCallback((x: number, y: number) => {
    const p: PostIt = { id: uid(), text: '', x, y, color: POST_IT_COLORS[0] };
    persist({ ...data, postIts: [...data.postIts, p] });
    return p.id;
  }, [data, persist]);

  const updatePostIt = useCallback((id: string, partial: Partial<PostIt>) => {
    persist({
      ...data,
      postIts: data.postIts.map(p => p.id === id ? { ...p, ...partial } : p),
    });
  }, [data, persist]);

  const removePostIt = useCallback((id: string) => {
    persist({ ...data, postIts: data.postIts.filter(p => p.id !== id) });
  }, [data, persist]);

  const addGroup = useCallback((x: number, y: number, w: number, h: number) => {
    const g: GroupRect = { id: uid(), label: 'Gruppo', x, y, w, h, color: GROUP_COLORS[0] };
    persist({ ...data, groups: [...data.groups, g] });
    return g.id;
  }, [data, persist]);

  const updateGroup = useCallback((id: string, partial: Partial<GroupRect>) => {
    persist({
      ...data,
      groups: data.groups.map(g => g.id === id ? { ...g, ...partial } : g),
    });
  }, [data, persist]);

  const removeGroup = useCallback((id: string) => {
    persist({ ...data, groups: data.groups.filter(g => g.id !== id) });
  }, [data, persist]);

  const clearAll = useCallback(() => {
    persist({ postIts: [], groups: [] });
  }, [persist]);

  return {
    annotations: data,
    addPostIt, updatePostIt, removePostIt,
    addGroup, updateGroup, removeGroup,
    clearAll, hasAnnotations: data.postIts.length > 0 || data.groups.length > 0,
  };
}
