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

// Default expanded: the hub's whole point is reading status at a glance,
// which needs titles + group headers visible.
let _expanded = lsGetString(KEY_EXPANDED) !== "0";
const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
// First run (no stored pref): the "done" group starts collapsed — it's the
// archive-ish pile, not what you scan for. Once the user toggles anything
// their explicit choice is persisted and wins.
let _collapsed = new Set(
  lsGetString(KEY_COLLAPSED) === null
    ? ["done"]
    : lsGetJson<string[]>(KEY_COLLAPSED, [], isStringArray),
);
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
