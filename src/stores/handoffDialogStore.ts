/**
 * Handoff Dialog Store
 *
 * Singleton state for the global HandoffDialog modal. Lets any component
 * (chat popover, slash interceptor, sidebar context menu) trigger the dialog
 * without re-mounting it or threading callbacks through the tree.
 *
 * Brain: handoff-agent-fork
 */

import { create } from 'zustand';

interface HandoffDialogState {
  isOpen: boolean;
  sessionId: string | null;
  initialTargetAgentId?: string;
  open: (sessionId: string, initialTargetAgentId?: string) => void;
  close: () => void;
}

export const useHandoffDialogStore = create<HandoffDialogState>((set) => ({
  isOpen: false,
  sessionId: null,
  initialTargetAgentId: undefined,
  open: (sessionId, initialTargetAgentId) =>
    set({ isOpen: true, sessionId, initialTargetAgentId }),
  close: () =>
    set({ isOpen: false, sessionId: null, initialTargetAgentId: undefined }),
}));
