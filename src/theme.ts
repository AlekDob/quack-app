import { useEffect, useState } from "react";
import { getString, setString } from "./localStore";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "lcp.theme";

// True on macOS. navigator.platform is deprecated but stable and already
// used for the same purpose in bootstrapTheme below; centralised here so
// the menubar (TopBar / nativeMenu) shares one platform check.
export const IS_MACOS = /mac/i.test(navigator.platform || "");

// Module-level theme subscribers. The native macOS menubar changes the
// theme from outside React (no hook), so it calls setTheme() directly;
// useTheme() subscribes here to keep its state (and check marks) in sync.
const themeListeners = new Set<(m: ThemeMode) => void>();

/** Set the theme imperatively from anywhere (React or not): applies it,
 *  persists it, and notifies every useTheme() consumer. */
export function setTheme(mode: ThemeMode) {
  applyTheme(mode);
  setString(STORAGE_KEY, mode);
  themeListeners.forEach((l) => l(mode));
}

/** Subscribe to setTheme() calls. Returns an unsubscribe fn. */
export function onThemeChange(cb: (m: ThemeMode) => void): () => void {
  themeListeners.add(cb);
  return () => themeListeners.delete(cb);
}

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
}

export function readStoredTheme(): ThemeMode {
  const v = getString(STORAGE_KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

export function useTheme(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = useState<ThemeMode>(readStoredTheme);

  // Reflect external setTheme() calls (e.g. the native macOS menu) so the
  // hook's state — and any check marks rendered from it — stay current.
  useEffect(() => onThemeChange(setMode), []);

  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  return [mode, setTheme];
}

// Apply the stored theme as early as possible to avoid a flash.
export function bootstrapTheme() {
  applyTheme(readStoredTheme());
  // Tag the OS so CSS can adapt the title bar: on macOS we use native
  // traffic lights (titleBarStyle: Overlay) and need left room for them
  // while hiding the custom window controls. navigator.platform is
  // deprecated but stable and already used elsewhere (aiPrivacy.ts).
  const p = navigator.platform || "";
  document.documentElement.dataset.os = /mac/i.test(p)
    ? "macos"
    : /win/i.test(p)
      ? "windows"
      : "linux";
}

// Returns the currently applied resolved theme ("light" | "dark"),
// reactive to changes of the data-theme attribute on <html>.
export function useResolvedTheme(): "light" | "dark" {
  const [resolved, setResolved] = useState<"light" | "dark">(() => {
    const v = document.documentElement.dataset.theme;
    return v === "light" ? "light" : "dark";
  });
  useEffect(() => {
    const obs = new MutationObserver(() => {
      const v = document.documentElement.dataset.theme;
      setResolved(v === "light" ? "light" : "dark");
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, []);
  return resolved;
}
