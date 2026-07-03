import type { Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";

export interface EditorColorThemeOption {
  id: string;
  label: string;
  mode: "light" | "dark";
}

const LIGHT_THEMES: EditorColorThemeOption[] = [
  { id: "vs", label: "Visual Studio Light", mode: "light" },
  { id: "hc-light", label: "High Contrast Light", mode: "light" },
  { id: "quack-github-light", label: "GitHub Light", mode: "light" },
  { id: "quack-solarized-light", label: "Solarized Light", mode: "light" },
  { id: "quack-quiet-light", label: "Quiet Light", mode: "light" },
];

const DARK_THEMES: EditorColorThemeOption[] = [
  { id: "vs-dark", label: "Visual Studio Dark", mode: "dark" },
  { id: "hc-black", label: "High Contrast Dark", mode: "dark" },
  { id: "quack-github-dark", label: "GitHub Dark", mode: "dark" },
  { id: "quack-monokai", label: "Monokai", mode: "dark" },
  { id: "quack-dracula", label: "Dracula", mode: "dark" },
  { id: "quack-one-dark", label: "One Dark", mode: "dark" },
];

const BY_MODE = { light: LIGHT_THEMES, dark: DARK_THEMES } as const;

const DEFAULT_BY_MODE = { light: "vs", dark: "vs-dark" } as const;

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
  const allowed = BY_MODE[mode];
  return allowed.some((t) => t.id === id) ? id : DEFAULT_BY_MODE[mode];
}

export function colorThemeLabel(id: string, mode: "light" | "dark"): string {
  const hit = BY_MODE[mode].find((t) => t.id === id);
  return hit?.label ?? DEFAULT_BY_MODE[mode];
}

function customThemes(): Record<string, editor.IStandaloneThemeData> {
  return {
    "quack-github-light": themeData("vs", {
      "editor.background": "#ffffff",
      "editor.foreground": "#24292f",
      "editorLineNumber.foreground": "#8c959f",
      "editorLineNumber.activeForeground": "#24292f",
      "editor.selectionBackground": "#b6e3ff66",
      "editorIndentGuide.background": "#d8dee4",
    }),
    "quack-solarized-light": themeData("vs", {
      "editor.background": "#fdf6e3",
      "editor.foreground": "#657b83",
      "editorLineNumber.foreground": "#93a1a1",
      "editorLineNumber.activeForeground": "#586e75",
      "editor.selectionBackground": "#83949633",
      "editorIndentGuide.background": "#eee8d5",
    }),
    "quack-quiet-light": themeData("vs", {
      "editor.background": "#f8f8f9",
      "editor.foreground": "#383a42",
      "editorLineNumber.foreground": "#a0a1a7",
      "editorLineNumber.activeForeground": "#383a42",
      "editor.selectionBackground": "#d7d7d966",
      "editorIndentGuide.background": "#e8e8eb",
    }),
    "quack-github-dark": themeData("vs-dark", {
      "editor.background": "#0d1117",
      "editor.foreground": "#c9d1d9",
      "editorLineNumber.foreground": "#6e7681",
      "editorLineNumber.activeForeground": "#c9d1d9",
      "editor.selectionBackground": "#264f7844",
      "editorIndentGuide.background": "#21262d",
    }),
    "quack-monokai": themeData("vs-dark", {
      "editor.background": "#272822",
      "editor.foreground": "#f8f8f2",
      "editorLineNumber.foreground": "#90908a",
      "editorLineNumber.activeForeground": "#c2c2bc",
      "editor.selectionBackground": "#49483e99",
      "editorIndentGuide.background": "#3b3a32",
    }),
    "quack-dracula": themeData("vs-dark", {
      "editor.background": "#282a36",
      "editor.foreground": "#f8f8f2",
      "editorLineNumber.foreground": "#6272a4",
      "editorLineNumber.activeForeground": "#f8f8f2",
      "editor.selectionBackground": "#44475a99",
      "editorIndentGuide.background": "#44475a",
    }),
    "quack-one-dark": themeData("vs-dark", {
      "editor.background": "#282c34",
      "editor.foreground": "#abb2bf",
      "editorLineNumber.foreground": "#636d83",
      "editorLineNumber.activeForeground": "#abb2bf",
      "editor.selectionBackground": "#3e445166",
      "editorIndentGuide.background": "#3b4048",
    }),
  };
}

function themeData(
  base: "vs" | "vs-dark",
  colors: Record<string, string>,
): editor.IStandaloneThemeData {
  return { base, inherit: true, rules: [], colors };
}

let registered = false;

/** Register Quack custom Monaco themes once per runtime. */
export function ensureEditorColorThemes(monaco: Monaco): void {
  if (registered) return;
  registered = true;
  for (const [id, data] of Object.entries(customThemes())) {
    monaco.editor.defineTheme(id, data);
  }
}
