// Map a filename to a Monaco language id by its extension. Single shared
// table so the editor and the diff viewer can't drift apart on which
// extensions get syntax highlighting. Adding a language? Add it here,
// not in a per-component copy.
//
// Keep keys lowercase. The lookup lowercases the path, so the map only
// needs the canonical form. "plaintext" is the fallback so Monaco still
// renders the file (just without highlighting) when we don't know the
// extension.

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  md: "markdown",
  mdx: "markdown",
  rs: "rust",
  py: "python",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  go: "go",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  hpp: "cpp",
  cc: "cpp",
  cs: "csharp",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  ini: "ini",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ps1: "powershell",
  sql: "sql",
  xml: "xml",
  rb: "ruby",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  dart: "dart",
};

export function langOf(path: string): string {
  const m = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  return (m && EXT_TO_LANG[m[1]]) || "plaintext";
}
