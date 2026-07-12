// Reload work items and stories when agents edit works/ on disk.

import { fsBus } from "./fsBus";
import { joinPath } from "./pathUtils";
import { isWorksPath } from "./worksDir";
import { WORKS_STORIES_DIR } from "./storyMd";
import { refreshWorksFromDisk } from "./worksCache";
import { reloadStoryFromPath } from "./worksStoryFiles";
import { reloadWorkItemFromPath } from "./worksItemFiles";
import { getWorksSnapshot, saveWorks } from "./worksCache";
import { useStore } from "./store";

let started = false;

function rootForWs(wsId: string): string | null {
  return useStore.getState().loaded[wsId]?.meta.root ?? null;
}

function isWorksDataDir(dir: string): boolean {
  const norm = dir.replace(/\\/g, "/").toLowerCase();
  return isWorksPath(norm) && (norm.includes("/items") || norm.includes("/stories"));
}

export function startWorksWatchOnce(): void {
  if (started) return;
  started = true;
  fsBus.addEventListener("dir", (ev) => {
    const { wsId, dir } = (ev as CustomEvent<{ wsId: string; dir: string }>).detail;
    if (!isWorksDataDir(dir)) return;
    const root = rootForWs(wsId);
    if (!root) return;
    void refreshWorksFromDisk(root);
  });
  fsBus.addEventListener("file", (ev) => {
    const { wsId, path } = (ev as CustomEvent<{ wsId: string; path: string }>).detail;
    const norm = path.replace(/\\/g, "/").toLowerCase();
    if (!isWorksPath(norm) || !norm.endsWith(".md")) return;
    const root = rootForWs(wsId);
    if (!root) return;
    const snap = getWorksSnapshot(root);
    if (!snap) {
      void refreshWorksFromDisk(root);
      return;
    }
    if (norm.includes("/stories/")) {
      void reloadStoryFromPath(root, snap, path).then((next) => {
        if (next) void saveWorks(root, next);
      });
      return;
    }
    if (norm.includes("/items/")) {
      void reloadWorkItemFromPath(root, snap, path).then((next) => {
        if (next) void saveWorks(root, next);
      });
    }
  });
}

export function worksStoriesDir(root: string): string {
  return joinPath(root, WORKS_STORIES_DIR);
}
