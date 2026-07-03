// Pub/sub for the tool-result drawer — a right-side slide-over that shows the
// full output of a read/search/bash tool call. Mirrors editorState's diff
// pub/sub: a tool-call pill calls requestToolDrawer(); the single
// <ToolResultDrawer> rendered at app level subscribes and slides in.
//
// Edits/writes do NOT use this — they open the centered DiffModal (requestDiff)
// so their before/after reads as a real diff. This drawer is for read-only
// output (file contents, command output, search hits).

export type ToolDrawerVariant = "default" | "terminal";

export interface ToolDrawerData {
  /** Tool name, e.g. "Read" / "Bash" — shown as the drawer title. */
  title: string;
  /** Path / command / query — the secondary line under the title. */
  subtitle?: string;
  /** Raw tool result to show in the body. */
  result: string;
  /** Render the body as Markdown (a `.md` read) instead of monospace. */
  markdown?: boolean;
  /** Terminal-style chrome for Bash / shell output. */
  variant?: ToolDrawerVariant;
  /** Full shell command — shown on the simulated prompt line. */
  command?: string;
  /** When set, the body renders the image at this path (a Read of an image)
   *  instead of the textual `[image]` placeholder. Loaded as a data: URL. */
  imagePath?: string;
  /** When set, the drawer shows an "Open in editor" action (file-ref tools). */
  onOpenFile?: () => void;
}

type DrawerListener = (data: ToolDrawerData) => void;
const listeners = new Set<DrawerListener>();

export function requestToolDrawer(data: ToolDrawerData) {
  for (const l of listeners) l(data);
}

export function onToolDrawer(cb: DrawerListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
