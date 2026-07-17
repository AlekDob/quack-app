// Task Manager — live view of Quack's own process tree (the app,
// PTY shells, Claude Code subprocesses, hook helpers, anything they
// spawned) with CPU / RAM per process and a kill button for runaway
// descendants. Also lists related macOS WebKit UI helpers (WKWebView
// XPC) that are not tree descendants but often the real CPU/RAM hog.
// Scoped on the Rust side — not a system task manager.

import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { onTaskManagerOpen } from "../taskManagerBus";
import { confirm as dialogConfirm } from "../dialog";
import { error as toastError, errMsg } from "../notify";

interface ProcStat {
  pid: number;
  parent: number | null;
  name: string;
  cmd: string;
  cpu: number;
  mem: number;
  depth: number;
  killable: boolean;
  related: boolean;
}

const POLL_MS = 2000;

function fmtMem(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

/** Friendly role guess from image name + command line. */
function roleOf(p: ProcStat): string {
  if (p.related) return "Quack UI (WebKit)";
  const n = p.name.toLowerCase();
  const cmd = p.cmd.toLowerCase();
  if (p.depth === 0) return "Quack";
  if (n.includes("claude")) return "Claude Code";
  if (n.startsWith("node")) {
    if (cmd.includes("hookspecificoutput") || cmd.includes("pretooluse"))
      return "Permission hook";
    if (cmd.includes("vite")) return "Vite dev server";
    if (cmd.includes("claude")) return "Claude Code";
    return "Node";
  }
  if (
    n.includes("powershell") ||
    n.includes("pwsh") ||
    n.includes("cmd") ||
    n.includes("bash") ||
    n.includes("zsh") ||
    n.includes("fish")
  )
    return "Terminal shell";
  if (n.includes("conhost") || n.includes("openconsole")) return "Console host";
  if (n.includes("webview2") || n.includes("msedgewebview")) return "WebView";
  return "";
}

export function TaskManagerModal() {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<ProcStat[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => onTaskManagerOpen(() => setOpen(true)), []);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const tick = async () => {
      try {
        const s = await invoke<ProcStat[]>("process_stats");
        if (live) setStats(s);
      } catch {
        /* backend gone mid-poll — keep last snapshot */
      }
      if (live) timerRef.current = window.setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    return () => {
      live = false;
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const totals = useMemo(() => {
    const cpu = stats.reduce((a, p) => a + p.cpu, 0);
    const mem = stats.reduce((a, p) => a + p.mem, 0);
    return { cpu, mem };
  }, [stats]);

  if (!open) return null;

  const kill = async (p: ProcStat) => {
    const ok = await dialogConfirm(
      `Kill ${p.name} (PID ${p.pid})? Unsaved state in that process is lost.`,
      { title: "Kill process", okLabel: "Kill", danger: true },
    );
    if (!ok) return;
    try {
      await invoke("process_kill", { pid: p.pid });
    } catch (e) {
      toastError(`Kill failed: ${errMsg(e)}`);
    }
  };

  return (
    <div className="settings-backdrop" onMouseDown={() => setOpen(false)}>
      <div
        className="taskman-modal"
        role="dialog"
        aria-label="Task Manager"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="taskman-head">
          <strong>Task Manager</strong>
          <span className="taskman-totals">
            {stats.length} processes · CPU {totals.cpu.toFixed(0)}% · RAM{" "}
            {fmtMem(totals.mem)}
          </span>
          <button
            className="taskman-close"
            onClick={() => setOpen(false)}
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>
        <div className="taskman-body">
          <table className="taskman-table">
            <thead>
              <tr>
                <th>Process</th>
                <th>Role</th>
                <th>PID</th>
                <th className="num">CPU</th>
                <th className="num">Memory</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stats.map((p) => (
                <tr key={p.pid}>
                  <td title={p.cmd}>
                    <span
                      className="taskman-indent"
                      style={{ paddingLeft: `${Math.min(p.depth, 6) * 12}px` }}
                    >
                      {p.name}
                    </span>
                  </td>
                  <td className="taskman-role">{roleOf(p)}</td>
                  <td className="taskman-pid">{p.pid}</td>
                  <td className="num">{p.cpu.toFixed(1)}%</td>
                  <td className="num">{fmtMem(p.mem)}</td>
                  <td className="taskman-actions">
                    {p.killable && (
                      <button
                        className="taskman-kill"
                        onClick={() => void kill(p)}
                        title={`Kill ${p.name} (${p.pid})`}
                      >
                        Kill
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td colSpan={6} className="taskman-empty">
                    Collecting…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="taskman-foot">
          CPU is per-core percent since the previous 2s sample. Shows
          Quack&apos;s process tree plus related WebKit UI helpers
          (WKWebView). Kill only works on tree descendants — not WebKit.
        </div>
      </div>
    </div>
  );
}
