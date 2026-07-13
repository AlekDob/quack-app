// Mirrors src-tauri/src/search.rs HEAVY_DIRS — skip during recursive walks
// so expand-all / filter scans don't crawl node_modules, .git, etc.
const HEAVY_DIRS = new Set([
  "node_modules",
  ".pnpm-store",
  "vendor",
  ".git",
  ".hg",
  ".svn",
  "target",
  "dist",
  "build",
  "out",
  "coverage",
  ".nyc_output",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  ".vercel",
  ".svelte-kit",
  ".angular",
  ".astro",
  ".docusaurus",
  ".parcel-cache",
  ".gradle",
  ".venv",
  "venv",
  "__pycache__",
  ".tox",
  ".mypy_cache",
  ".ruff_cache",
  ".pytest_cache",
  ".idea",
]);

export function isHeavyDir(name: string): boolean {
  return HEAVY_DIRS.has(name.toLowerCase());
}
