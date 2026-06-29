import type { IconName } from "./components/Icon";

// VS Code-style per-type icons for the file tree — but monochrome to
// respect Quack's neutral-chrome brand rule (color only on workspace
// badges + semantic states). Each file type maps to a distinct SHAPE
// from the shared Icon registry; the color stays currentColor.
//
// Single source of truth: call fileIconName(name) at every call-site,
// never branch on the extension inline.

// Exact filenames (lowercased) that should win over the extension —
// these are recognizable by name, not suffix.
const BY_NAME: Record<string, IconName> = {
  "package.json": "braces",
  "package-lock.json": "lock",
  "yarn.lock": "lock",
  "pnpm-lock.yaml": "lock",
  "cargo.lock": "lock",
  "composer.lock": "lock",
  dockerfile: "settings",
  makefile: "settings",
  ".gitignore": "git-branch",
  ".gitattributes": "git-branch",
  ".gitmodules": "git-branch",
  ".env": "lock",
  "readme.md": "file-text",
  license: "file-text",
};

// Extension (without dot, lowercased) → icon shape.
const BY_EXT: Record<string, IconName> = {
  // Source code
  js: "file-code", jsx: "file-code", mjs: "file-code", cjs: "file-code",
  ts: "file-code", tsx: "file-code", mts: "file-code", cts: "file-code",
  py: "file-code", rs: "file-code", go: "file-code", java: "file-code",
  kt: "file-code", kts: "file-code", c: "file-code", h: "file-code",
  cc: "file-code", cpp: "file-code", cxx: "file-code", hpp: "file-code",
  rb: "file-code", php: "file-code", swift: "file-code", vue: "file-code",
  svelte: "file-code", scala: "file-code", dart: "file-code", lua: "file-code",
  // Web markup + styles
  html: "globe", htm: "globe", xml: "globe",
  css: "hash", scss: "hash", sass: "hash", less: "hash", styl: "hash",
  // Data
  json: "braces", jsonc: "braces", json5: "braces",
  // Config
  yaml: "settings", yml: "settings", toml: "settings", ini: "settings",
  conf: "settings", cfg: "settings", properties: "settings", plist: "settings",
  // Docs / text
  md: "file-text", mdx: "file-text", markdown: "file-text", txt: "file-text",
  rst: "file-text", adoc: "file-text", pdf: "file-text", doc: "file-text",
  docx: "file-text",
  // Shell
  sh: "terminal", bash: "terminal", zsh: "terminal", fish: "terminal",
  ps1: "terminal", bat: "terminal", cmd: "terminal",
  // Images
  png: "image", jpg: "image", jpeg: "image", gif: "image", svg: "image",
  webp: "image", ico: "image", bmp: "image", avif: "image", tiff: "image",
  // Secrets / locks
  lock: "lock", pem: "lock", key: "lock",
};

/** Pick a tree icon for a file by name. Falls back to the generic file. */
export function fileIconName(fileName: string): IconName {
  const lower = fileName.toLowerCase();
  if (lower in BY_NAME) return BY_NAME[lower];
  const dot = lower.lastIndexOf(".");
  // Dotfiles with no real extension (e.g. ".prettierrc") read as config.
  if (dot <= 0) return "settings";
  return BY_EXT[lower.slice(dot + 1)] ?? "file";
}
