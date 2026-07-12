// Pointer-based drag-to-reorder for the workspace icons.
import { useStore } from "./store";
import { usePointerListReorder } from "./usePointerListReorder";

export type { PointerDragState as IconDragState } from "./usePointerListReorder";

export function useWorkspaceReorder() {
  const reorder = useStore((s) => s.reorderWorkspaces);
  return usePointerListReorder({
    dataAttr: "data-ws-index",
    bodyClass: "ws-dragging",
    onReorder: reorder,
  });
}
