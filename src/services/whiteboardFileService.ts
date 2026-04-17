/**
 * Whiteboard file I/O — reads/writes .whiteboard.json via Tauri commands
 * Bridges React canvas state with filesystem for agent interaction
 */

import { invoke } from '@tauri-apps/api/core';
import type { WhiteboardFile, CanvasAnnotations } from '../components/featureMap/annotationTypes';
import { normalizeToForwardSlash } from '../utils/platform';

const FILE_NAME = '.whiteboard.json';
const LS_ANN_KEY = 'quack:featureMap:annotations:';
const LS_POS_KEY = 'quack:featureMap:positions:';

function filePath(projectPath: string): string {
  const norm = normalizeToForwardSlash(projectPath);
  return `${norm}/documentation/features/${FILE_NAME}`;
}

function emptyFile(): WhiteboardFile {
  return { version: 1, annotations: { postIts: [], groups: [], images: [], mdCards: [] }, positions: {}, nodeAssignments: {} };
}

export async function readWhiteboardFile(projectPath: string): Promise<WhiteboardFile | null> {
  try {
    const raw = await invoke<string>('read_file_content', { path: filePath(projectPath) });
    const parsed = JSON.parse(raw) as WhiteboardFile;
    // Migration: ensure all fields exist
    if (!parsed.annotations) parsed.annotations = { postIts: [], groups: [], images: [], mdCards: [] };
    if (!parsed.annotations.images) parsed.annotations.images = [];
    if (!parsed.annotations.mdCards) parsed.annotations.mdCards = [];
    if (!parsed.positions) parsed.positions = {};
    if (!parsed.nodeAssignments) parsed.nodeAssignments = {};
    return parsed;
  } catch {
    return null;
  }
}

export async function writeWhiteboardFile(projectPath: string, data: WhiteboardFile): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await invoke('write_file_content', { path: filePath(projectPath), content });
}

/** Migrate legacy localStorage data into a WhiteboardFile (returns null if nothing to migrate) */
export function migrateFromLocalStorage(projectPath: string): WhiteboardFile | null {
  const key = normalizeToForwardSlash(projectPath);
  const annRaw = localStorage.getItem(LS_ANN_KEY + key);
  const posRaw = localStorage.getItem(LS_POS_KEY + key);

  if (!annRaw && !posRaw) return null;

  const file = emptyFile();

  if (annRaw) {
    try {
      const ann = JSON.parse(annRaw) as CanvasAnnotations;
      file.annotations = { ...file.annotations, ...ann };
      if (!file.annotations.images) file.annotations.images = [];
      if (!file.annotations.mdCards) file.annotations.mdCards = [];
    } catch { /* skip corrupt data */ }
  }

  if (posRaw) {
    try {
      file.positions = JSON.parse(posRaw) as Record<string, { x: number; y: number }>;
    } catch { /* skip corrupt data */ }
  }

  // Clean up localStorage after successful migration
  localStorage.removeItem(LS_ANN_KEY + key);
  localStorage.removeItem(LS_POS_KEY + key);

  return file;
}

export { emptyFile, FILE_NAME };
