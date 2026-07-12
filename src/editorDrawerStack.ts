// Portal target for work/feature drawers when a surface lives in EditorTabDrawer.

let stackEl: HTMLElement | null = null;
let stackWsId: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function registerEditorDrawerStack(
  wsId: string,
  el: HTMLElement | null,
): void {
  stackEl = el;
  stackWsId = el ? wsId : null;
  notify();
}

export function drawerPortalTarget(wsId: string): HTMLElement {
  if (stackEl && stackWsId === wsId) return stackEl;
  return document.body;
}

export function isNestedDrawerPortal(target: HTMLElement): boolean {
  return target !== document.body;
}

export function subscribeDrawerPortal(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
