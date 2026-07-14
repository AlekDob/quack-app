// Cross-platform path helpers used by the file tree, editor tabs, command
// palette, recent-files overlay, and the remote SFTP browser.
//
// Tauri's fs commands accept either separator on Windows, so we normalize
// to forward slashes everywhere and don't bother with the OS path
// separator. Five copies of `basename` and three copies of `joinPath`
// were drifting; this single set is the one all callers should reach for.
//
// All inputs are tolerant of mixed separators and trailing slashes —
// "C:\Users\me\proj\", "C:/Users/me/proj/", and "C:/Users/me/proj" all
// produce the same basename.

/** Canonical workspace root — forward slashes, no trailing slash. */
export function normalizeWorkspaceRoot(root: string): string {
  return root.replace(/\\/g, "/").replace(/\/+$/, "");
}

/** Basename of a file or directory path. Strips trailing slashes first
 *  so basename("/a/b/") returns "b". */
export function basename(p: string): string {
  const norm = p.replace(/\\/g, "/").replace(/\/+$/, "");
  const i = norm.lastIndexOf("/");
  return i >= 0 ? norm.slice(i + 1) : norm;
}

/** Parent directory of the given path. Strips trailing slashes first.
 *  Returns the input unchanged if there's no separator (so dirname("foo")
 *  returns "foo", not "" — callers expect a non-empty fallback). */
export function dirname(p: string): string {
  const norm = p.replace(/\\/g, "/").replace(/\/+$/, "");
  const i = norm.lastIndexOf("/");
  return i > 0 ? norm.slice(0, i) : norm;
}

/** Join one or more path segments into a forward-slash path. Trims
 *  trailing slashes from every segment except the last. Empty / null
 *  segments are skipped. */
export function joinPath(...parts: string[]): string {
  return parts
    .map((p) => p.replace(/[\\/]+$/, ""))
    .filter(Boolean)
    .join("/");
}

/** Path relative to a workspace root. Returns the original path unchanged
 *  if it doesn't live under the root (different drive, network share,
 *  symlink-escaped, etc.) — callers want to display *something* rather
 *  than an empty string. */
export function relPath(path: string, root: string): string {
  if (!root) return path;
  const p = path.replace(/\\/g, "/");
  const r = root.replace(/\\/g, "/").replace(/\/+$/, "") + "/";
  return p.startsWith(r) ? p.slice(r.length) : p;
}

/** True when `path` resolves under `root` (absolute or workspace-relative). */
export function isUnderRoot(path: string, root: string): boolean {
  if (!path || !root) return false;
  const p = path.replace(/\\/g, "/");
  const r = root.replace(/\\/g, "/").replace(/\/+$/, "");
  if (p === r || p.startsWith(`${r}/`)) return true;
  const joined = joinPath(r, p);
  return joined === r || joined.startsWith(`${r}/`);
}

/** Normalize a workspace-relative or absolute path to an absolute path under root. */
export function resolveUnderRoot(path: string, root: string): string | null {
  if (!path || !root) return null;
  const p = path.replace(/\\/g, "/");
  const r = root.replace(/\\/g, "/").replace(/\/+$/, "");
  if (p === r || p.startsWith(`${r}/`)) return p;
  const joined = joinPath(r, p);
  return joined === r || joined.startsWith(`${r}/`) ? joined : null;
}

/** Display path with home shortened to `~/` (Cursor-style composer label). */
export function displayTildePath(path: string, home: string | null): string {
  const norm = path.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!home) return norm;
  const h = home.replace(/\\/g, "/").replace(/\/+$/, "");
  if (norm === h) return "~";
  if (norm.startsWith(`${h}/`)) return `~${norm.slice(h.length)}`;
  return norm;
}
