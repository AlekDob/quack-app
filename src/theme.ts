import { useEffect, useState } from "react";
import { getString, setString } from "./localStore";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "lcp.theme";

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

  useEffect(() => {
    applyTheme(mode);
    setString(STORAGE_KEY, mode);
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  return [mode, setMode];
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
