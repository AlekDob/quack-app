// Shared "reveal this file in the explorer tree" used by the command
// palette action and the editor-tab context menu (the logic was
// duplicated in actions.ts and PaneNode.tsx and had drifted).
//
// Expands every ancestor directory of the file, switches the sidebar
// to the Files view, then fires a DOM event the FileTree listens for
// to scroll the row into view — only the tree knows which DOM node
// the row is, and lazily-loaded levels need a few frames to fetch.

import { useStore } from "./store";
import { openPathSmart } from "./smartFileOpen";

export const REVEAL_IN_TREE_EVENT = "lcp:reveal-in-tree";

export interface RevealInTreeDetail {
  wsId: string;
  path: string;
}

// True when `filePath` lives inside the workspace root (so it has a row
// in the file tree worth revealing). Global ~/.claude assets don't.
function isInWorkspace(wsId: string, filePath: string): boolean {
  const ws = useStore.getState().loaded[wsId];
  if (!ws) return false;
  const root = ws.meta.root.replace(/\\/g, "/").replace(/\/+$/, "");
  const norm = filePath.replace(/\\/g, "/");
  return norm.toLowerCase().startsWith(root.toLowerCase() + "/");
}

/** Reveal a workspace file in the sidebar tree (no-op for out-of-root paths). */
export function autoRevealInTree(wsId: string, filePath: string): void {
  if (!isInWorkspace(wsId, filePath)) return;
  revealInTree(wsId, filePath);
}

/**
 * Open a file in an editor tab and reveal it in the tree. `openFile` already
 * auto-reveals; this helper remains for call sites that want the intent spelled
 * out (whiteboard organigramma, Usage → Context view).
 */
export async function openFileAndReveal(wsId: string, filePath: string) {
  await openPathSmart(filePath, { wsId });
}

export function revealInTree(wsId: string, filePath: string) {
  const st = useStore.getState();
  const ws = st.loaded[wsId];
  if (!ws) return;
  // Forward-slash everything; the tree compares paths with the
  // normalize-aware pathsEqual so the separator style doesn't matter.
  const root = ws.meta.root.replace(/\\/g, "/").replace(/\/+$/, "");
  const norm = filePath.replace(/\\/g, "/");
  const rel = norm.toLowerCase().startsWith(root.toLowerCase() + "/")
    ? norm.slice(root.length + 1)
    : norm;
  const segs = rel.split("/").slice(0, -1);
  const expanded = new Set(ws.layout.expandedDirs);
  let cur = root;
  for (const seg of segs) {
    cur = `${cur}/${seg}`;
    expanded.add(cur);
  }
  st.setSidebarVisible(wsId, true);
  st.setSidebarView(wsId, "files");
  useStore.setState((s) => {
    const w = s.loaded[wsId];
    if (!w) return s;
    return {
      loaded: {
        ...s.loaded,
        [wsId]: {
          ...w,
          layout: { ...w.layout, expandedDirs: Array.from(expanded) },
        },
      },
    };
  });
  window.dispatchEvent(
    new CustomEvent<RevealInTreeDetail>(REVEAL_IN_TREE_EVENT, {
      detail: { wsId, path: filePath },
    }),
  );
}
