import { basename, dirname, isUnderRoot } from "./pathUtils";

/** Stable Tauri window label for a given absolute file path. */
export function filePopoutLabel(path: string): string {
  let h = 0;
  for (let i = 0; i < path.length; i++) {
    h = (Math.imul(31, h) + path.charCodeAt(i)) | 0;
  }
  return `file-${Math.abs(h).toString(36)}`;
}

function gitRootForPath(absPath: string, roots: string[]): string {
  for (const root of roots) {
    if (isUnderRoot(absPath, root)) return root;
  }
  return dirname(absPath);
}

async function focusWindow(
  w: import("@tauri-apps/api/webviewWindow").WebviewWindow,
): Promise<void> {
  try {
    await w.unminimize();
  } catch {
    /* ignore */
  }
  try {
    await w.setFocus();
  } catch {
    /* ignore */
  }
}

/** Open a standalone editor window for a file outside any open workspace. */
export async function popOutFile(absPath: string, roots: string[]): Promise<void> {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const label = filePopoutLabel(absPath);
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await focusWindow(existing);
    return;
  }

  const theme =
    document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const params = new URLSearchParams({
    file: "1",
    path: absPath,
    gitRoot: gitRootForPath(absPath, roots),
    theme,
  });

  const w = new WebviewWindow(label, {
    url: `index.html?${params.toString()}`,
    title: `${basename(absPath)} — Quack`,
    width: 920,
    height: 720,
    minWidth: 480,
    minHeight: 320,
    resizable: true,
    decorations: false,
    shadow: true,
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (err?: unknown) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve();
    };
    void w.once("tauri://created", () => finish());
    void w.once("tauri://error", (e) => finish(e.payload ?? "unknown error"));
    setTimeout(() => finish(), 4000);
  });
}
