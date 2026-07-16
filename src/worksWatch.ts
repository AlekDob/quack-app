// Reload work items and stories when agents edit works/ on disk.

import { fsBus } from "./fsBus";
import { joinPath } from "./pathUtils";
import { isWorksPath } from "./worksDir";
import { WORKS_STORIES_DIR } from "./storyMd";
import { refreshWorksFromDisk, isWorksSelfWriting } from "./worksCache";
import { reloadStoryFromPath } from "./worksStoryFiles";
import { reloadWorkItemFromPath } from "./worksItemFiles";
import { getWorksSnapshot, saveWorks } from "./worksCache";
import { useStore } from "./store";

let started = false;

// Debounce per root: an agent editing several works files fires a burst of
// `dir` events; without this each one ran a full refreshWorksFromDisk (re-read
// every file). Collapse the burst into one trailing refresh.
const refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
const REFRESH_DEBOUNCE_MS = 250;

function scheduleWorksRefresh(root: string): void {
  const prev = refreshTimers.get(root);
  if (prev) clearTimeout(prev);
  const t = setTimeout(() => {
    refreshTimers.delete(root);
    // Re-check at fire time: a persist() may have started during the window.
    if (isWorksSelfWriting(root)) return;
    void refreshWorksFromDisk(root);
  }, REFRESH_DEBOUNCE_MS);
  refreshTimers.set(root, t);
}

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
    // Skip the echo of our own persist() writes — otherwise a duplicate/
    // mis-named S-NNN/W-NNN file that orphan import keeps resurfacing drives
    // refresh → persist → refresh forever (CPU pegged).
    if (isWorksSelfWriting(root)) return;
    scheduleWorksRefresh(root);
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
