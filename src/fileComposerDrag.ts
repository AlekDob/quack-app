// Pointer-based drag from the file tree into the chat composer.
// Tauri 2 swallows in-app HTML5 drags, so we mirror the whiteboard
// skill-chip flow: mousedown on a tree row → document mousemove/mouseup
// → elementFromPoint hit-test on the composer drop target.

export const COMPOSER_FILE_DROP_ATTR = "data-composer-file-drop";
export const FILE_TREE_DRAG_THRESHOLD_PX = 4;

interface ComposerFileDropZone {
  onFile: (absPath: string) => void;
}

let dropZone: ComposerFileDropZone | null = null;
const hoverListeners = new Set<(over: boolean) => void>();

export function registerComposerFileDrop(zone: ComposerFileDropZone): () => void {
  dropZone = zone;
  return () => {
    if (dropZone === zone) dropZone = null;
  };
}

export function subscribeComposerFileDropHover(
  cb: (over: boolean) => void,
): () => void {
  hoverListeners.add(cb);
  return () => {
    hoverListeners.delete(cb);
  };
}

function notifyHover(over: boolean): void {
  for (const cb of hoverListeners) cb(over);
}

function isOverDropTarget(clientX: number, clientY: number): boolean {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return false;
  return !!el.closest(`[${COMPOSER_FILE_DROP_ATTR}]`);
}

function placeGhost(ghost: HTMLElement, x: number, y: number): void {
  ghost.style.left = `${x}px`;
  ghost.style.top = `${y}px`;
}

/** Begin a file-tree → composer drag. Returns cleanup for mouseup. */
export function startFileTreeDrag(
  absPath: string,
  label: string,
  startX: number,
  startY: number,
  sourceEl: HTMLElement,
): (endX: number, endY: number) => void {
  let active = true;
  sourceEl.classList.add("tree-row--dragging");

  const ghost = document.createElement("div");
  ghost.className = "file-composer-drag-ghost";
  ghost.textContent = label;
  placeGhost(ghost, startX, startY);
  document.body.appendChild(ghost);

  const onMove = (e: MouseEvent) => {
    if (!active) return;
    placeGhost(ghost, e.clientX, e.clientY);
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.hypot(dx, dy) < FILE_TREE_DRAG_THRESHOLD_PX) return;
    notifyHover(isOverDropTarget(e.clientX, e.clientY));
  };

  window.addEventListener("mousemove", onMove);

  return (endX: number, endY: number) => {
    if (!active) return;
    active = false;
    window.removeEventListener("mousemove", onMove);
    notifyHover(false);
    sourceEl.classList.remove("tree-row--dragging");
    placeGhost(ghost, endX, endY);
    ghost.classList.add("file-composer-drag-ghost--fading");
    window.setTimeout(() => {
      ghost.remove();
    }, 120);
    if (isOverDropTarget(endX, endY) && dropZone) {
      dropZone.onFile(absPath);
    }
  };
}
