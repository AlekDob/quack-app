import { isEditorDrawerDropZone } from "./editorDrawer";
import type { DropEdge, PaneId } from "./store";

export interface TabDropTarget {
  overPaneId: PaneId | null;
  edge: DropEdge | null;
  tabInsertIndex: number | null;
  drawerDrop: boolean;
}

export function computeEdgeForPoint(
  el: HTMLElement,
  clientX: number,
  clientY: number,
): DropEdge {
  const rect = el.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (x > 0.25 && x < 0.75 && y > 0.25 && y < 0.75) return "center";
  const dLeft = x;
  const dRight = 1 - x;
  const dTop = y;
  const dBottom = 1 - y;
  const min = Math.min(dLeft, dRight, dTop, dBottom);
  if (min === dLeft) return "left";
  if (min === dRight) return "right";
  if (min === dTop) return "top";
  return "bottom";
}

/** Hit-test the editor surface for tab/pane/drawer drops (shared by tab + tree drags). */
export function resolveTabDropTarget(
  clientX: number,
  clientY: number,
  wsId: string,
): TabDropTarget {
  if (isEditorDrawerDropZone(clientX, wsId)) {
    return {
      overPaneId: null,
      edge: null,
      tabInsertIndex: null,
      drawerDrop: true,
    };
  }

  const el = document.elementFromPoint(
    clientX,
    clientY,
  ) as HTMLElement | null;

  const tabBarEl = el?.closest("[data-pane-tab-bar]") as HTMLElement | null;
  if (tabBarEl) {
    const overPaneId = tabBarEl.dataset.paneTabBar ?? null;
    const tabEls = Array.from(
      tabBarEl.querySelectorAll("[data-tab-index]"),
    ) as HTMLElement[];
    let insertIndex = tabEls.length;
    for (let i = 0; i < tabEls.length; i++) {
      const r = tabEls[i].getBoundingClientRect();
      if (clientX < r.left + r.width / 2) {
        insertIndex = i;
        break;
      }
    }
    return {
      overPaneId,
      edge: null,
      tabInsertIndex: insertIndex,
      drawerDrop: false,
    };
  }

  const paneEl = el?.closest("[data-pane-id]") as HTMLElement | null;
  const overPaneId = paneEl?.dataset.paneId ?? null;
  const edge = paneEl
    ? computeEdgeForPoint(paneEl, clientX, clientY)
    : null;
  return { overPaneId, edge, tabInsertIndex: null, drawerDrop: false };
}
