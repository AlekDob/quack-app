// Activity bar view-icon order + visible/more split — global prefs
// (the activity bar is app chrome, not per-workspace).
import { useEffect, useState } from "react";
import { getJson, setJson } from "./localStore";
import {
  DEFAULT_ACTIVITY_BAR_ORDER,
  DEFAULT_VISIBLE_COUNT,
  normalizeActivityBarOrder,
  type ActivityBarIconId,
} from "./activityBarViews";

const KEY_ORDER = "lcp.activityBar.order";
const KEY_VISIBLE = "lcp.activityBar.visibleCount";

export interface ActivityBarPrefs {
  order: ActivityBarIconId[];
  visibleCount: number;
}

const listeners = new Set<() => void>();

function clampVisibleCount(count: number, orderLen: number): number {
  return Math.max(1, Math.min(orderLen, Math.round(count)));
}

function readPrefs(): ActivityBarPrefs {
  const order = normalizeActivityBarOrder(
    getJson<unknown>(KEY_ORDER, DEFAULT_ACTIVITY_BAR_ORDER),
  );
  const stored = getJson<number | null>(KEY_VISIBLE, null);
  const visibleCount =
    typeof stored === "number" && Number.isFinite(stored)
      ? clampVisibleCount(stored, order.length)
      : clampVisibleCount(DEFAULT_VISIBLE_COUNT, order.length);
  return { order, visibleCount };
}

let _prefs = readPrefs();

function emit(): void {
  for (const l of listeners) l();
}

export function getActivityBarPrefs(): ActivityBarPrefs {
  return _prefs;
}

export function setActivityBarPrefs(next: ActivityBarPrefs): void {
  const order = normalizeActivityBarOrder(next.order);
  const visibleCount = clampVisibleCount(next.visibleCount, order.length);
  _prefs = { order, visibleCount };
  setJson(KEY_ORDER, order);
  setJson(KEY_VISIBLE, visibleCount);
  emit();
}

export function moveActivityBarItem(
  from: number,
  to: number,
): ActivityBarPrefs {
  const { order, visibleCount } = _prefs;
  if (from === to || from < 0 || to < 0 || from >= order.length) {
    return _prefs;
  }
  const next = order.slice();
  const [item] = next.splice(from, 1);
  const adjustedTo = to > from ? to - 1 : to;
  next.splice(adjustedTo, 0, item);

  let vc = visibleCount;
  if (from < visibleCount && adjustedTo >= visibleCount) vc--;
  else if (from >= visibleCount && adjustedTo < visibleCount) vc++;
  vc = clampVisibleCount(vc, next.length);

  const prefs = { order: next, visibleCount: vc };
  setActivityBarPrefs(prefs);
  return prefs;
}

export function subscribeActivityBarPrefs(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useActivityBarPrefs(): ActivityBarPrefs {
  const [prefs, setPrefs] = useState(_prefs);
  useEffect(() => subscribeActivityBarPrefs(() => setPrefs(readPrefs())), []);
  return prefs;
}

/** Height math for the view-icons column. */
export const ACTIVITY_ICON_SLOT_PX = 42; // 38px icon + 4px gap

export interface BarIconLayout {
  visible: number;
  showMore: boolean;
}

/** How many icons fit on the bar; reserves footer slots for `…` + customize. */
export function computeBarIconLayout(
  availablePx: number,
  totalIcons: number,
): BarIconLayout {
  if (totalIcons <= 0) return { visible: 0, showMore: false };
  const totalSlots =
    availablePx <= 0
      ? 1
      : Math.floor((availablePx + 4) / ACTIVITY_ICON_SLOT_PX);
  const customizeSlot = 1;
  let iconSlots = Math.max(0, totalSlots - customizeSlot);
  if (iconSlots <= 0) {
    return { visible: 0, showMore: totalIcons > 0 };
  }
  if (totalIcons <= iconSlots) {
    return { visible: totalIcons, showMore: false };
  }
  iconSlots = Math.max(1, iconSlots - 1);
  return { visible: Math.min(iconSlots, totalIcons), showMore: true };
}

/** Max icons that can show on the bar at once (excludes footer chrome). */
export function maxFitIcons(containerHeight: number): number {
  const slots = Math.floor((containerHeight + 4) / ACTIVITY_ICON_SLOT_PX);
  return Math.max(1, slots - 2);
}
