// Agent Hub view preferences — global (the hub is one cross-project rail
// now, not per-workspace), persisted to localStorage. Cloned from the
// agentMode.ts pattern. Holds the expanded/collapsed rail state and which
// status sections the user has collapsed.

import { useEffect, useState } from "react";
import {
  getString as lsGetString,
  setString as lsSetString,
  getJson as lsGetJson,
  setJson as lsSetJson,
} from "./localStore";

const KEY_EXPANDED = "lcp.hub.expanded";
const KEY_COLLAPSED = "lcp.hub.collapsedSections";
// sessionStorage — survives HMR, clears on full app quit/new tab.
const KEY_DONE_BOOTED = "lcp.hub.doneBooted";

// Default expanded: the hub's whole point is reading status at a glance,
// which needs titles + group headers visible.
let _expanded = lsGetString(KEY_EXPANDED) !== "0";
const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

function readCollapsed(): Set<string> {
  if (lsGetString(KEY_COLLAPSED) === null) return new Set(["done"]);
  return new Set(lsGetJson<string[]>(KEY_COLLAPSED, [], isStringArray));
}

let _collapsed = readCollapsed();

// Once per browser session: start Done collapsed (archive pile). Expanding
// mid-session still works and persists; we must NOT re-seed on Vite HMR or
// the toggle appears broken (stale subscribe + forced re-collapse).
try {
  if (sessionStorage.getItem(KEY_DONE_BOOTED) !== "1") {
    sessionStorage.setItem(KEY_DONE_BOOTED, "1");
    if (!_collapsed.has("done")) {
      _collapsed = new Set(_collapsed);
      _collapsed.add("done");
      lsSetJson(KEY_COLLAPSED, [..._collapsed]);
    }
  }
} catch {
  /* private mode — first-run default above is enough */
}
const expandedListeners = new Set<(v: boolean) => void>();
const collapsedListeners = new Set<() => void>();

export function getHubExpanded(): boolean {
  return _expanded;
}

export function setHubExpanded(v: boolean): void {
  if (_expanded === v) return;
  _expanded = v;
  lsSetString(KEY_EXPANDED, v ? "1" : "0");
  for (const l of expandedListeners) l(v);
}

export function useHubExpanded(): boolean {
  const [v, setV] = useState(_expanded);
  useEffect(() => {
    expandedListeners.add(setV);
    return () => {
      expandedListeners.delete(setV);
    };
  }, []);
  return v;
}

export function isSectionCollapsed(status: string): boolean {
  return _collapsed.has(status);
}

export function toggleSectionCollapsed(status: string): void {
  _collapsed = new Set(_collapsed);
  if (_collapsed.has(status)) _collapsed.delete(status);
  else _collapsed.add(status);
  lsSetJson(KEY_COLLAPSED, [..._collapsed]);
  for (const l of collapsedListeners) l();
}

export function subscribeHubCollapsed(cb: () => void): () => void {
  collapsedListeners.add(cb);
  return () => {
    collapsedListeners.delete(cb);
  };
}
