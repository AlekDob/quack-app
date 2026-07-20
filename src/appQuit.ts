import { getCurrentWindow } from "@tauri-apps/api/window";
import { closeDock } from "./dock";
import { closeAudit } from "./auditWindow";

let armed = false;

/** True after quit/close was confirmed — skips duplicate guards. */
export function quitArmed(): boolean {
  return armed;
}

async function closeAuxiliaryWindows(): Promise<void> {
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const all = await WebviewWindow.getAll();
    for (const w of all) {
      if (w.label === "main") continue;
      await w.close().catch(() => {});
    }
  } catch {
    /* ignore */
  }
}

/** Close dock + audit + popouts after the unsaved-changes guard passed. */
export async function teardownBeforeQuit(): Promise<void> {
  if (armed) return;
  armed = true;
  await closeDock();
  await closeAudit();
  await closeAuxiliaryWindows();
}

export async function closeMainWindow(): Promise<void> {
  try {
    await getCurrentWindow().close();
  } catch {
    armed = false;
  }
}
