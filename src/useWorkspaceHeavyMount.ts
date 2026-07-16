import { useEffect, useRef, useState } from "react";
import {
  isWorkspaceWarm,
  markWorkspaceActive,
  subscribeWarmSet,
} from "./workspaceWarmSet";

export interface WorkspaceHeavyMount {
  /** Sidebar, file editors, and tab portals — active OR warm workspace. */
  showHeavy: boolean;
  /** Defer Monaco one frame after showHeavy so the tab bar paints first. */
  editorsReady: boolean;
}

const UNMOUNT_DELAY_MS = 300;

/**
 * Gate Monaco / sidebar / editor portals on workspace focus, with a warm-LRU:
 * the active project AND the last few used ones (workspaceWarmSet) keep their
 * heavy UI mounted while hidden, so switching back is instant (no Monaco
 * recreation, no file-tree re-list). A project that falls out of the warm
 * window tears down after a short grace.
 */
export function useWorkspaceHeavyMount(
  wsId: string,
  isActive: boolean,
): WorkspaceHeavyMount {
  // Re-render only when THIS workspace's warm status actually flips (e.g. it
  // gets evicted from the window). The two shells whose isActive changes on a
  // switch already re-render via their prop; without this gate every mounted
  // shell would re-render on every switch, undoing WorkspaceShell's memo.
  const [, forceTick] = useState(0);
  const warmRef = useRef(isWorkspaceWarm(wsId));
  useEffect(
    () =>
      subscribeWarmSet(() => {
        const now = isWorkspaceWarm(wsId);
        if (now !== warmRef.current) {
          warmRef.current = now;
          forceTick((t) => t + 1);
        }
      }),
    [wsId],
  );
  useEffect(() => {
    if (isActive) markWorkspaceActive(wsId);
  }, [isActive, wsId]);

  const warm = isActive || isWorkspaceWarm(wsId);
  const [showHeavy, setShowHeavy] = useState(warm);
  const [editorsReady, setEditorsReady] = useState(warm);

  useEffect(() => {
    if (warm) {
      setShowHeavy(true);
      // Defer editors 2 frames on entry so the tab bar paints first. When the
      // shell was already warm (mounted) this just re-confirms editorsReady.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setEditorsReady(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    // Evicted from the warm window: tear the heavy UI down after a grace so a
    // rapid re-click doesn't pay the remount.
    setEditorsReady(false);
    const t = window.setTimeout(() => setShowHeavy(false), UNMOUNT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [warm]);

  return { showHeavy, editorsReady: warm && editorsReady };
}
