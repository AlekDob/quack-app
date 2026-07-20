// Perf Audit companion window (?audit=1). Main window pushes snapshots;
// this webview only listens — no process_stats poll of its own.

import { useEffect, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  AUDIT_REQUEST_EVENT,
  AUDIT_SNAPSHOT_EVENT,
  type AuditProcStat,
  type AuditSnapshot,
  type PerfEvent,
} from "../perfAuditBus";
import { saveAuditPos, markAuditClosed } from "../auditWindow";
import { Icon } from "./Icon";

function fmtMem(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function roleOf(p: AuditProcStat): string {
  if (p.related) return "Quack UI (WebKit)";
  const n = p.name.toLowerCase();
  const cmd = p.cmd.toLowerCase();
  if (p.depth === 0) return "Quack";
  if (n.includes("claude")) return "Claude Code";
  if (n.startsWith("node")) {
    if (cmd.includes("vite")) return "Vite dev server";
    return "Node";
  }
  if (n.includes("cursor")) return "Cursor CLI";
  if (n.includes("zsh") || n.includes("bash") || n.includes("fish"))
    return "Terminal shell";
  return p.name;
}

function kindLabel(kind: PerfEvent["kind"]): string {
  switch (kind) {
    case "chat-switch":
      return "Chat";
    case "new-chat":
      return "New";
    case "switch-perf":
      return "Project";
    case "resume":
      return "Wake";
    case "agent-mode":
      return "Mode";
    default:
      return kind;
  }
}

/** Prefer phase-local duration in `detail.elapsedMs` — agent-mode top-level
 *  `elapsedMs` is "since mode toggle started" and misleads (e.g. 162s). */
function displayElapsedMs(e: PerfEvent): number | undefined {
  const d = e.detail?.elapsedMs;
  if (typeof d === "number") return d;
  if (typeof e.detail?.loadMs === "number") return e.detail.loadMs as number;
  return e.elapsedMs;
}

function fmtTime(at: number): string {
  const d = new Date(at);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Compact JSON for pasting into chat — trims long cmd lines, keeps timings. */
function buildAuditExport(snap: AuditSnapshot): string {
  const processes = snap.processes.map((p) => ({
    role: roleOf(p),
    pid: p.pid,
    cpu: Math.round(p.cpu * 10) / 10,
    memMb: Math.round(p.mem / (1024 * 1024)),
    depth: p.depth,
    related: p.related || undefined,
    cmd: p.cmd.length > 120 ? `${p.cmd.slice(0, 117)}…` : p.cmd || undefined,
  }));
  const events = snap.events.map((e) => ({
    kind: e.kind,
    label: e.label,
    elapsedMs: displayElapsedMs(e),
    sinceModeMs:
      e.kind === "agent-mode" &&
      typeof e.elapsedMs === "number" &&
      e.elapsedMs !== displayElapsedMs(e)
        ? e.elapsedMs
        : undefined,
    at: new Date(e.at).toISOString(),
    detail: e.detail,
  }));
  const cpuSum = snap.processes.reduce((a, p) => a + p.cpu, 0);
  const memSum = snap.processes.reduce((a, p) => a + p.mem, 0);
  return JSON.stringify(
    {
      type: "quack-perf-audit",
      v: 1,
      capturedAt: new Date(snap.at).toISOString(),
      context: snap.context,
      totals: {
        cpuPct: Math.round(cpuSum * 10) / 10,
        memMb: Math.round(memSum / (1024 * 1024)),
        processCount: processes.length,
        eventCount: events.length,
      },
      processes,
      events,
    },
    null,
    2,
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function useThemeSync() {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "lcp.theme") return;
      const v = e.newValue;
      document.documentElement.dataset.theme =
        v === "light" || v === "dark"
          ? v
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}

export function PerfAuditWindow() {
  useThemeSync();
  const [snap, setSnap] = useState<AuditSnapshot | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "err">("idle");

  useEffect(() => {
    const theme = new URLSearchParams(window.location.search).get("theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    }
    document.documentElement.classList.add("audit-root");
  }, []);

  useEffect(() => {
    const offs: Array<() => void> = [];
    void listen<AuditSnapshot>(AUDIT_SNAPSHOT_EVENT, (e) => {
      setSnap(e.payload);
    }).then((u) => offs.push(u));
    void emit(AUDIT_REQUEST_EVENT);
    return () => offs.forEach((f) => f());
  }, []);

  useEffect(() => {
    let un: (() => void) | undefined;
    void getCurrentWindow()
      .onCloseRequested(() => {
        markAuditClosed();
      })
      .then((u) => {
        un = u;
      });
    return () => un?.();
  }, []);

  useEffect(() => {
    let un: (() => void) | undefined;
    void getCurrentWindow()
      .onMoved(({ payload }) => {
        saveAuditPos(payload.x, payload.y);
      })
      .then((u) => {
        un = u;
      });
    return () => un?.();
  }, []);

  const ctx = snap?.context;
  const procs = snap?.processes ?? [];
  const events = snap?.events ?? [];
  const cpuSum = procs.reduce((a, p) => a + p.cpu, 0);
  const memSum = procs.reduce((a, p) => a + p.mem, 0);

  const onCopy = () => {
    if (!snap) return;
    void copyText(buildAuditExport(snap)).then((ok) => {
      setCopyState(ok ? "ok" : "err");
      window.setTimeout(() => setCopyState("idle"), 1600);
    });
  };

  return (
    <div className="audit-win">
      <header className="audit-head">
        <div className="audit-title">
          <Icon name="chart-bar" size={14} />
          <span>Perf Audit</span>
        </div>
        <div className="audit-head-actions">
          <div className="audit-ctx" title="Workspace warm-LRU + chat-switch state">
            <span className={ctx?.activeWsWarm ? "is-warm" : "is-cold"}>
              {ctx?.activeWsWarm ? "Warm" : "Cold"}
            </span>
            {ctx?.chatSwitching && (
              <span className="is-switch">
                Switching
                {ctx.chatSwitchTarget
                  ? ` → ${ctx.chatSwitchTarget.slice(0, 8)}`
                  : ""}
              </span>
            )}
          </div>
          <button
            type="button"
            className="audit-copy-btn"
            onClick={onCopy}
            disabled={!snap}
            title="Copy snapshot as JSON — paste into chat for diagnosis"
          >
            <Icon name="copy" size={12} />
            {copyState === "ok"
              ? "Copied"
              : copyState === "err"
                ? "Failed"
                : "Copy JSON"}
          </button>
        </div>
      </header>

      <section className="audit-section">
        <div className="audit-section-head">
          <h2>Processes</h2>
          <span className="audit-totals">
            {Math.round(cpuSum)}% · {fmtMem(memSum)}
          </span>
        </div>
        {procs.length === 0 ? (
          <p className="audit-empty">Waiting for StatusBar sample…</p>
        ) : (
          <div className="audit-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th className="num">CPU</th>
                  <th className="num">RAM</th>
                </tr>
              </thead>
              <tbody>
                {procs.map((p) => (
                  <tr key={p.pid} className={p.related ? "is-related" : undefined}>
                    <td>
                      <span
                        className="audit-indent"
                        style={{ paddingLeft: `${p.depth * 10}px` }}
                      >
                        {roleOf(p)}
                      </span>
                      <span className="audit-pid">{p.pid}</span>
                    </td>
                    <td className="num">{p.cpu.toFixed(1)}</td>
                    <td className="num">{fmtMem(p.mem)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="audit-section audit-timeline">
        <div className="audit-section-head">
          <h2>Timeline</h2>
          <span className="audit-totals">{events.length} events</span>
        </div>
        {events.length === 0 ? (
          <p className="audit-empty">
            Switch chats, create a chat, or wake from sleep to see timings.
          </p>
        ) : (
          <ul className="audit-events">
            {events.map((e) => {
              const ms = displayElapsedMs(e);
              return (
              <li key={e.id} className={`audit-event kind-${e.kind}`}>
                <span className="audit-event-kind">{kindLabel(e.kind)}</span>
                <span className="audit-event-label">{e.label}</span>
                {typeof ms === "number" && (
                  <span className="audit-event-ms">{ms}ms</span>
                )}
                <span className="audit-event-time">{fmtTime(e.at)}</span>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="audit-foot">
        Copy JSON → paste in chat · Kill via Task Manager (Ctrl+Alt+U)
      </footer>
    </div>
  );
}
