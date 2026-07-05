import { useStore, type TerminalDescriptor } from "./store";

/**
 * Spawn (or focus) a separate Tauri window that hosts a single terminal.
 * Marks the terminal `popped` in the store so the in-window TerminalCore
 * unmounts; the PTY itself stays alive in the backend, so the popout's
 * fresh TerminalCore re-attaches to it and replays the rolling scrollback.
 */
export async function popOutTerminal(
  wsId: string,
  desc: TerminalDescriptor,
  cwd: string,
): Promise<void> {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const label = `popout-${desc.id}`;

  // Already open? Just focus it.
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    try {
      await existing.unminimize();
    } catch {
      /* ignore */
    }
    try {
      await existing.setFocus();
    } catch {
      /* ignore */
    }
    return;
  }

  const params = new URLSearchParams({
    popout: "1",
    wsId,
    termId: desc.id,
    cwd,
    title: desc.title,
  });
  if (desc.ptyId) params.set("ptyId", desc.ptyId);
  if (desc.shell?.path) params.set("shellPath", desc.shell.path);
  if (desc.shell?.args && desc.shell.args.length > 0) {
    params.set("shellArgs", JSON.stringify(desc.shell.args));
  }
  // Pass the currently-resolved theme so the popout matches dark/light
  // immediately, before any React effects run. Popout still listens for
  // storage events so live theme switches in the main window propagate.
  const currentTheme =
    document.documentElement.dataset.theme === "light" ? "light" : "dark";
  params.set("theme", currentTheme);

  const w = new WebviewWindow(label, {
    url: `index.html?${params.toString()}`,
    title: `${desc.title} — Quack`,
    width: 900,
    height: 560,
    minWidth: 480,
    minHeight: 240,
    resizable: true,
    decorations: false,
    shadow: true,
  });

  // Wait for create OR error so we don't flip `popped` for a window that
  // never actually opened (e.g. capability denied during dev).
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

  useStore.getState().setTerminalPopped(wsId, desc.id, true);

  // Belt-and-braces: if the popout window dies for any reason (OS kill,
  // crash, the JS-side popout:redock event failing to deliver), the
  // window-destroyed event still fires and we flip popped back here.
  void w
    .once("tauri://destroyed", () => {
      const ws = useStore.getState().loaded[wsId];
      if (ws?.terminals[desc.id]?.popped) {
        useStore.getState().setTerminalPopped(wsId, desc.id, false);
      }
    })
    .catch(() => {
      /* ignore — primary popout:redock path still covers normal closes */
    });
}

/**
 * Send a popped-out terminal back to the main window. The popout window's
 * onCloseRequested handler emits `popout:redock`, which the main App
 * listens for and uses to flip `popped` back to false.
 */
export async function redockTerminal(termId: string): Promise<void> {
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const w = await WebviewWindow.getByLabel(`popout-${termId}`);
    if (w) await w.close();
  } catch {
    /* ignore */
  }
}
