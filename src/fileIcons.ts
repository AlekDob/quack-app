import type { IconName } from "./components/Icon";

// VS Code-style per-type icons for the file tree. Shapes come from the
// shared Icon registry; tints (fileIconTint) add Cursor-like color on
// the glyph only — chrome stays neutral.
//
// Single source of truth: call fileIconName/fileIconTint at call-sites,
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
  if (dot <= 0) return "settings";
  return BY_EXT[lower.slice(dot + 1)] ?? "file";
}

/** CSS class suffix for tree-icon tint (tree-icon--{value}). */
export type FileIconTint =
  | "default"
  | "folder"
  | "folder-src"
  | "folder-modules"
  | "folder-public"
  | "folder-git"
  | "folder-scripts"
  | "code-ts"
  | "code-js"
  | "code-py"
  | "code-rs"
  | "code-go"
  | "web"
  | "style"
  | "data"
  | "config"
  | "doc"
  | "shell"
  | "image"
  | "lock"
  | "git";

const FOLDER_TINT: Record<string, FileIconTint> = {
  src: "folder-src",
  source: "folder-src",
  lib: "folder-src",
  app: "folder-src",
  apps: "folder-src",
  node_modules: "folder-modules",
  public: "folder-public",
  static: "folder-public",
  assets: "folder-public",
  ".git": "folder-git",
  scripts: "folder-scripts",
  bin: "folder-scripts",
};

const EXT_TINT: Record<string, FileIconTint> = {
  ts: "code-ts", tsx: "code-ts", mts: "code-ts", cts: "code-ts",
  js: "code-js", jsx: "code-js", mjs: "code-js", cjs: "code-js",
  py: "code-py", pyw: "code-py",
  rs: "code-rs",
  go: "code-go",
  html: "web", htm: "web", xml: "web",
  css: "style", scss: "style", sass: "style", less: "style", styl: "style",
  json: "data", jsonc: "data", json5: "data",
  yaml: "config", yml: "config", toml: "config", ini: "config",
  conf: "config", cfg: "config", properties: "config", plist: "config",
  md: "doc", mdx: "doc", mmd: "doc", markdown: "doc", txt: "doc", rst: "doc",
  pdf: "doc", doc: "doc", docx: "doc",
  sh: "shell", bash: "shell", zsh: "shell", fish: "shell",
  ps1: "shell", bat: "shell", cmd: "shell",
  png: "image", jpg: "image", jpeg: "image", gif: "image", svg: "image",
  webp: "image", ico: "image", bmp: "image", avif: "image", tiff: "image",
  lock: "lock", pem: "lock", key: "lock",
};

const NAME_TINT: Record<string, FileIconTint> = {
  "package.json": "data",
  ".gitignore": "git",
  ".gitattributes": "git",
  ".gitmodules": "git",
  ".env": "lock",
  dockerfile: "config",
  makefile: "shell",
};

/** Tint class for a tree row icon — folders by name, files by ext. */
export function fileIconTint(name: string, isDir: boolean): FileIconTint {
  const lower = name.toLowerCase();
  if (isDir) return FOLDER_TINT[lower] ?? "folder";
  if (lower in NAME_TINT) return NAME_TINT[lower];
  const dot = lower.lastIndexOf(".");
  if (dot <= 0) return "config";
  return EXT_TINT[lower.slice(dot + 1)] ?? "default";
}
