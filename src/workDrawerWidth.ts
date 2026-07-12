import { getJson, setJson } from "./localStore";

const STORAGE_KEY = "lcp.works.drawerWidth";
export const WORK_DRAWER_DEFAULT_W = 680;
export const WORK_DRAWER_MIN_W = 420;
export const WORK_DRAWER_MAX_RATIO = 0.88;

export function clampWorkDrawerWidth(w: number): number {
  const max = Math.floor(window.innerWidth * WORK_DRAWER_MAX_RATIO);
  return Math.min(max, Math.max(WORK_DRAWER_MIN_W, Math.round(w)));
}

export function getWorkDrawerWidth(): number {
  return getJson(
    STORAGE_KEY,
    WORK_DRAWER_DEFAULT_W,
    (v): v is number => typeof v === "number" && v >= WORK_DRAWER_MIN_W,
  );
}

export function setWorkDrawerWidth(w: number): void {
  setJson(STORAGE_KEY, clampWorkDrawerWidth(w));
}
