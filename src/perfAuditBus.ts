// Perf Audit contract — main window produces snapshots; the companion
// `?audit=1` window renders them. Ring is always cheap; Tauri emit only
// when the audit pref is on (throttled / forced on request).

import { emit } from "@tauri-apps/api/event";
import { getString as lsGetString } from "./localStore";

export const AUDIT_SNAPSHOT_EVENT = "audit:snapshot";
export const AUDIT_REQUEST_EVENT = "audit:request";

const KEY_ENABLED = "lcp.audit.enabled";
const RING_MAX = 100;
const EMIT_THROTTLE_MS = 500;

export type PerfEventKind =
  | "chat-switch"
  | "new-chat"
  | "switch-perf"
  | "resume"
  | "agent-mode";

export interface PerfEvent {
  id: string;
  at: number;
  kind: PerfEventKind;
  label: string;
  elapsedMs?: number;
  detail?: Record<string, unknown>;
}

/** Mirrors sysmon `ProcStat` — kept local so the audit window needs no IPC. */
export interface AuditProcStat {
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

export interface AuditContext {
  activeWsId: string | null;
  activeWsWarm: boolean;
  chatSwitchTarget: string | null;
  chatSwitching: boolean;
}

export interface AuditSnapshot {
  at: number;
  processes: AuditProcStat[];
  events: PerfEvent[];
  context: AuditContext;
}

const EMPTY_CONTEXT: AuditContext = {
  activeWsId: null,
  activeWsWarm: false,
  chatSwitchTarget: null,
  chatSwitching: false,
};

const ring: PerfEvent[] = [];
let processes: AuditProcStat[] = [];
let contextProvider: (() => AuditContext) | null = null;
let lastEmitAt = 0;
let emitTimer: ReturnType<typeof setTimeout> | null = null;
let seq = 0;

function auditPrefOn(): boolean {
  return lsGetString(KEY_ENABLED) === "1";
}

/** Installed once from MainApp — avoids a chatSwitch ↔ bus import cycle. */
export function setAuditContextProvider(fn: () => AuditContext): void {
  contextProvider = fn;
}

function buildSnapshot(): AuditSnapshot {
  return {
    at: Date.now(),
    processes,
    events: ring.slice().reverse(),
    context: contextProvider ? contextProvider() : EMPTY_CONTEXT,
  };
}

/** StatusBar owns the sole process_stats poll — push samples here. */
export function publishProcessStats(stats: AuditProcStat[]): void {
  processes = stats;
  if (auditPrefOn()) scheduleEmit();
}

/** Append a timeline row. Always cheap; emit only when audit is enabled. */
export function recordPerfEvent(
  kind: PerfEventKind,
  label: string,
  opts?: { elapsedMs?: number; detail?: Record<string, unknown> },
): void {
  seq += 1;
  ring.push({
    id: `${Date.now()}-${seq}`,
    at: Date.now(),
    kind,
    label,
    elapsedMs: opts?.elapsedMs,
    detail: opts?.detail,
  });
  if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
  if (auditPrefOn()) scheduleEmit();
}

function scheduleEmit(): void {
  const wait = Math.max(0, EMIT_THROTTLE_MS - (Date.now() - lastEmitAt));
  if (emitTimer) return;
  emitTimer = setTimeout(() => {
    emitTimer = null;
    void emitAuditSnapshot(false);
  }, wait);
}

/** Broadcast to the audit window. `force` skips throttle (on request). */
export function emitAuditSnapshot(force = false): void {
  if (!force && !auditPrefOn()) return;
  if (!force && Date.now() - lastEmitAt < EMIT_THROTTLE_MS) {
    scheduleEmit();
    return;
  }
  lastEmitAt = Date.now();
  if (emitTimer) {
    clearTimeout(emitTimer);
    emitTimer = null;
  }
  void emit(AUDIT_SNAPSHOT_EVENT, buildSnapshot()).catch(() => {});
}

/** Main-window listener: audit window asks for an immediate snapshot. */
export function installAuditRequestListener(): () => void {
  let off: (() => void) | undefined;
  void import("@tauri-apps/api/event").then(({ listen }) => {
    void listen(AUDIT_REQUEST_EVENT, () => emitAuditSnapshot(true)).then(
      (u) => {
        off = u;
      },
    );
  });
  return () => off?.();
}
