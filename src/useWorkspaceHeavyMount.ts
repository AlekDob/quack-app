import { useEffect, useState } from "react";

export interface WorkspaceHeavyMount {
  /** Sidebar, file editors, and tab portals — foreground workspace only. */
  showHeavy: boolean;
  /** Defer Monaco one frame after showHeavy so the tab bar paints first. */
  editorsReady: boolean;
}

const UNMOUNT_DELAY_MS = 300;

/**
 * Gate Monaco / sidebar / editor portals on workspace focus. Background
 * projects tear down after a short delay so the incoming shell paints
 * first; editors mount on the next frame when switching back.
 */
export function useWorkspaceHeavyMount(isActive: boolean): WorkspaceHeavyMount {
  const [showHeavy, setShowHeavy] = useState(isActive);
  const [editorsReady, setEditorsReady] = useState(false);

  useEffect(() => {
    if (isActive) {
      setShowHeavy(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setEditorsReady(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
        setEditorsReady(false);
      };
    }
    setEditorsReady(false);
    const t = window.setTimeout(() => setShowHeavy(false), UNMOUNT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [isActive]);

  return { showHeavy, editorsReady: isActive && editorsReady };
}
