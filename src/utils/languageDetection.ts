/**
 * Map file extensions to language identifiers.
 * Used for IDE context tags and CodeMirror language detection.
 */

const languageMap: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  mjs: "javascript",
  cjs: "javascript",
  html: "html",
  htm: "html",
  css: "css",
  scss: "css",
  sass: "css",
  less: "css",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  md: "markdown",
  mdx: "markdown",
  markdown: "markdown",
  py: "python",
  rs: "rust",
  sh: "shell",
  bash: "shell",
  go: "go",
  java: "java",
  rb: "ruby",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  toml: "toml",
  xml: "xml",
  svg: "xml",
  sql: "sql",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  vue: "vue",
  svelte: "svelte",
};

export function getLanguageFromFilename(filename: string | null): string {
  if (!filename) return "plaintext";

  const extension = filename.split(".").pop()?.toLowerCase() || "";
  return languageMap[extension] || "plaintext";
}
