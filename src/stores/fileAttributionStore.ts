import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface AttributionEntry {
  sessionId: string;
  agentId: string;
  agentName: string;
  agentAvatar?: string;
  lastTs: number;
  editCount: number;
}

interface SessionSnapshot {
  sessionId: string;
  agentId: string;
  agentName: string;
  agentAvatar?: string;
}

interface EditSnapshot {
  filePath: string;
  editCount: number;
}

interface FileAttributionState {
  byPath: Map<string, Map<string, AttributionEntry>>;
  recordEdits: (session: SessionSnapshot, edits: EditSnapshot[]) => void;
  clearForSession: (sessionId: string) => void;
  getAttributions: (filePath: string) => AttributionEntry[];
}

export const useFileAttributionStore = create<FileAttributionState>()(
  devtools((set, get) => ({
    byPath: new Map(),

    recordEdits: (session, edits) => set((state) => {
      const next = new Map(state.byPath);
      const now = Date.now();
      const wantedPaths = new Set(edits.map(e => e.filePath));

      for (const [absPath, perSession] of next) {
        if (perSession.has(session.sessionId) && !wantedPaths.has(absPath)) {
          const updated = new Map(perSession);
          updated.delete(session.sessionId);
          if (updated.size === 0) next.delete(absPath);
          else next.set(absPath, updated);
        }
      }

      for (const edit of edits) {
        const existing = next.get(edit.filePath) ?? new Map<string, AttributionEntry>();
        const prev = existing.get(session.sessionId);
        const updated = new Map(existing);
        updated.set(session.sessionId, {
          sessionId: session.sessionId,
          agentId: session.agentId,
          agentName: session.agentName,
          agentAvatar: session.agentAvatar,
          lastTs: prev?.editCount === edit.editCount ? (prev.lastTs ?? now) : now,
          editCount: edit.editCount,
        });
        next.set(edit.filePath, updated);
      }

      return { byPath: next };
    }),

    clearForSession: (sessionId) => set((state) => {
      const next = new Map(state.byPath);
      for (const [absPath, perSession] of next) {
        if (perSession.has(sessionId)) {
          const updated = new Map(perSession);
          updated.delete(sessionId);
          if (updated.size === 0) next.delete(absPath);
          else next.set(absPath, updated);
        }
      }
      return { byPath: next };
    }),

    getAttributions: (filePath) => {
      const perSession = get().byPath.get(filePath);
      if (!perSession) return [];
      return Array.from(perSession.values()).sort((a, b) => b.lastTs - a.lastTs);
    },
  }), { name: 'file-attribution-store' })
);
