// Reload work items when agents edit .codetta/works/items/*.md on disk.

import { fsBus } from "./fsBus";
import { joinPath } from "./pathUtils";
import { WORKS_ITEMS_DIR } from "./workItemMd";
import { refreshWorksFromDisk } from "./worksCache";
import { useStore } from "./store";

let started = false;

function rootForWs(wsId: string): string | null {
  return useStore.getState().loaded[wsId]?.meta.root ?? null;
}

function isWorksItemsDir(dir: string): boolean {
  const norm = dir.replace(/\\/g, "/").toLowerCase();
  return norm.includes("/.codetta/works/items");
}

export function startWorksWatchOnce(): void {
  if (started) return;
  started = true;
  fsBus.addEventListener("dir", (ev) => {
    const { wsId, dir } = (ev as CustomEvent<{ wsId: string; dir: string }>).detail;
    if (!isWorksItemsDir(dir)) return;
    const root = rootForWs(wsId);
    if (!root) return;
    void refreshWorksFromDisk(root);
  });
}

export function worksItemsDir(root: string): string {
  return joinPath(root, WORKS_ITEMS_DIR);
}
