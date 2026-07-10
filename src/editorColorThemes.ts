import type { Monaco } from "@monaco-editor/react";
import { VS_CODE_THEME_BUNDLES } from "./vscodeThemeBundles";

export interface EditorColorThemeOption {
  id: string;
  label: string;
  mode: "light" | "dark";
}

/** Mirrors VS Code's bundled color-theme picker (English labels). */
const LIGHT_THEMES: EditorColorThemeOption[] = [
  { id: "quack-light-modern", label: "Light Modern", mode: "light" },
  { id: "vs", label: "Light (Visual Studio)", mode: "light" },
  { id: "quack-light-plus", label: "Light+", mode: "light" },
  { id: "quack-quiet-light", label: "Quiet Light", mode: "light" },
  { id: "quack-solarized-light", label: "Solarized Light", mode: "light" },
  { id: "hc-light", label: "High Contrast Light", mode: "light" },
];

const DARK_THEMES: EditorColorThemeOption[] = [
  { id: "quack-dark-modern", label: "Dark Modern", mode: "dark" },
  { id: "quack-abyss", label: "Abyss", mode: "dark" },
  { id: "quack-kimbie-dark", label: "Kimbie Dark", mode: "dark" },
  { id: "quack-monokai", label: "Monokai", mode: "dark" },
  { id: "quack-monokai-dimmed", label: "Monokai Dimmed", mode: "dark" },
  { id: "quack-red", label: "Red", mode: "dark" },
  { id: "vs-dark", label: "Dark (Visual Studio)", mode: "dark" },
  { id: "quack-dark-plus", label: "Dark+", mode: "dark" },
  { id: "quack-solarized-dark", label: "Solarized Dark", mode: "dark" },
  {
    id: "quack-tomorrow-night-blue",
    label: "Tomorrow Night Blue",
    mode: "dark",
  },
  { id: "hc-black", label: "High Contrast Dark", mode: "dark" },
];

const BY_MODE = { light: LIGHT_THEMES, dark: DARK_THEMES } as const;

const DEFAULT_BY_MODE = {
  light: "quack-light-modern",
  dark: "quack-dark-modern",
} as const;

/** Map legacy ids from the first Quack theme picker to VS Code equivalents. */
const LEGACY_ALIASES: Record<string, string> = {
  "quack-github-light": "quack-light-modern",
  "quack-github-dark": "quack-dark-modern",
  "quack-dracula": "quack-abyss",
  "quack-one-dark": "quack-dark-plus",
};

export function themesForMode(mode: "light" | "dark"): EditorColorThemeOption[] {
  return BY_MODE[mode];
}

export function defaultColorThemeForMode(mode: "light" | "dark"): string {
  return DEFAULT_BY_MODE[mode];
}

export function normalizeColorTheme(
  id: string,
  mode: "light" | "dark",
): string {
  const resolved = LEGACY_ALIASES[id] ?? id;
  const allowed = BY_MODE[mode];
  return allowed.some((t) => t.id === resolved)
    ? resolved
    : DEFAULT_BY_MODE[mode];
}

export function colorThemeLabel(id: string, mode: "light" | "dark"): string {
  const resolved = normalizeColorTheme(id, mode);
  const hit = BY_MODE[mode].find((t) => t.id === resolved);
  return hit?.label ?? DEFAULT_BY_MODE[mode];
}

let registered = false;
let monacoApi: Monaco | null = null;
/** Theme id requested before Monaco mounted — applied on first register. */
let pendingThemeId: string | null = null;

/** Register custom themes and keep the Monaco handle for live `setTheme`. */
export function registerMonacoForThemes(monaco: Monaco): void {
  monacoApi = monaco;
  ensureEditorColorThemes(monaco);
  if (pendingThemeId) {
    monaco.editor.setTheme(pendingThemeId);
    pendingThemeId = null;
  }
}

/** Register Quack custom Monaco themes once per runtime. */
export function ensureEditorColorThemes(monaco: Monaco): void {
  if (registered) return;
  registered = true;
  for (const [id, data] of Object.entries(VS_CODE_THEME_BUNDLES)) {
    monaco.editor.defineTheme(id, data);
  }
}

/** Apply a theme id immediately (built-in or custom). */
export function applyEditorColorTheme(themeId: string): void {
  if (monacoApi) {
    monacoApi.editor.setTheme(themeId);
    pendingThemeId = null;
    return;
  }
  pendingThemeId = themeId;
}

/** All custom theme ids (for JSON settings validation docs). */
export function customThemeIds(): string[] {
  return Object.keys(VS_CODE_THEME_BUNDLES);
}
