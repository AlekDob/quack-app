// Resume-debug: instruments the white/blank-screen-after-standby class of
// bugs that hit Tauri/WKWebView (and Safari/Chrome on dev URLs) when JS
// pauses during macOS sleep, then resumes.
//
// The path we observed in the wild:
//   1. App goes to sleep. JS execution pauses; WebGL contexts are NOT
//      notified via webglcontextlost (WKWebView omits the event).
//   2. User reopens the window. The DOM is intact, the React tree mounts
//      fine, but Monaco's WebGL/canvas renderer has gone blind — its
//      dom node is sized 0×0 from a stale layout pass, or the GL
//      texture is gone. Result: a perfectly white `.pane-content`.
//   3. xterm + flex layouts sometimes show the same symptom on resume.
//
// This module does two things at once:
//   - Logs ([resume] prefix, easy to grep in DevTools) so the next
//     incident leaves a paper trail in the console.
//   - Heals on resume by dispatching `resize` (re-runs all layout
//     listeners, including Monaco's and xterm's ResizeObserver-backed
//     fits) and asking each registered component to self-recover.
//
// Keep the registry self-contained: callers register their instance
// (`monaco`, `xterm`) at mount and unregister at dispose. That avoids
// coupling to module-scope singletons (Monaco has per-editor models,
// xterm has per-Terminal instances).

export type ResumeComponentKind = "monaco" | "xterm";

export interface ResumeComponent {
  /** Stable id; used as the registry key and in log lines. */
  id: string;
  kind: ResumeComponentKind;
  /** Lightweight JSON-ish snapshot. Must NEVER throw — wrap internally. */
  snapshot(): unknown;
  /** Best-effort recovery. Must NEVER throw — wrap internally. */
  heal?(): void;
}

/** A single captured resume event, persisted so it survives a reload. */
export interface ResumeLogEntry {
  at: number; // epoch ms
  reason: string;
  components: number;
  healed: number;
  viewport: { w: number; h: number; dpr: number };
  visible: boolean;
  heap: string;
  snaps: Array<Record<string, unknown>>;
}

const components = new Map<string, ResumeComponent>();

// Persist the last N events to localStorage. The whole point: the previous
// system logged only to the live console, so if DevTools wasn't open at the
// moment of wake the incident left no trace. Now every resume is durable and
// readable after the fact (window.__resumeLog or getResumeLog()).
const RESUME_LOG_KEY = "codetta:resumeLog";
const RESUME_LOG_MAX = 50;

let installed = false;
let lastFireAt = 0;
// Coalesce bursts (hidden → visible fires twice on some platforms) into a
// single log line. 250 ms is small enough to feel immediate, large enough
// to skip the noisy double-event pattern.
const FIRE_MIN_GAP_MS = 250;

export function registerResumeComponent(c: ResumeComponent): () => void {
  components.set(c.id, c);
  return () => {
    components.delete(c.id);
  };
}

function safeSnap(c: ResumeComponent): unknown {
  try {
    return c.snapshot();
  } catch (e) {
    return { snapshotError: String(e) };
  }
}

function safeHeal(c: ResumeComponent): boolean {
  if (!c.heal) return false;
  try {
    c.heal();
    return true;
  } catch {
    return false;
  }
}

// performance.memory is a Chromium-only extension; on Tauri (WKWebView) and
// Firefox it's undefined. Gate defensively so the snapshot never throws.
function readHeap(): string {
  const mem = (performance as Performance & {
    memory?: { usedJSHeapSize: number };
  }).memory;
  if (typeof performance === "undefined" || !mem) return "n/a";
  return Math.round(mem.usedJSHeapSize / 1024 / 1024) + "MB";
}

/** Append an entry to the capped localStorage ring. Never throws. */
function persistResumeEntry(entry: ResumeLogEntry): void {
  try {
    const log = getResumeLog();
    log.push(entry);
    localStorage.setItem(
      RESUME_LOG_KEY,
      JSON.stringify(log.slice(-RESUME_LOG_MAX)),
    );
  } catch {
    /* localStorage full/unavailable — the console log still stands. */
  }
}

function fireResumeOnce(reason: string): void {
  const now = Date.now();
  if (now - lastFireAt < FIRE_MIN_GAP_MS) return;
  lastFireAt = now;

  const snaps = Array.from(components.values()).map((c) => ({
    id: c.id,
    kind: c.kind,
    ...(safeSnap(c) as Record<string, unknown>),
  }));

  const healedComponents: string[] = [];
  for (const c of components.values()) {
    if (safeHeal(c)) healedComponents.push(c.id);
    // Heal failures are captured in each component's snapshot via the
    // safeSnap wrapper; we don't keep a separate failed-array here.
  }

  // The one-shot heal that catches everything: a synthetic `resize`.
  // Monaco's onDidContentSizeChange + xterm's ResizeObserver both wake
  // up; pure-CSS flex layouts that lost their cached measurements also
  // re-run. Idempotent and cheap.
  try {
    window.dispatchEvent(new Event("resize"));
  } catch {
    /* ignore */
  }

  const entry: ResumeLogEntry = {
    at: now,
    reason,
    components: components.size,
    healed: healedComponents.length,
    viewport: {
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: window.devicePixelRatio,
    },
    visible: typeof document !== "undefined" ? !document.hidden : true,
    heap: readHeap(),
    snaps,
  };

  persistResumeEntry(entry);

  // Single grouped console so the entire resume story is one collapsible
  // entry in DevTools instead of 4 disjoint lines.
  // eslint-disable-next-line no-console
  console.warn(
    `[resume] reason=${reason} components=${entry.components} ` +
      `healed=${entry.healed}`,
    entry,
  );
}

/** Read the persisted resume log (oldest → newest). Never throws. */
export function getResumeLog(): ResumeLogEntry[] {
  try {
    const raw = localStorage.getItem(RESUME_LOG_KEY);
    return raw ? (JSON.parse(raw) as ResumeLogEntry[]) : [];
  } catch {
    return [];
  }
}

/** Wipe the persisted resume log. */
export function clearResumeLog(): void {
  try {
    localStorage.removeItem(RESUME_LOG_KEY);
  } catch {
    /* ignore */
  }
}

/** Wire visibility/focus/pageshow listeners. Idempotent. */
export function installResumeDebug(): () => void {
  if (installed) return () => {};
  installed = true;

  // Console conveniences so an incident can be inspected without importing
  // anything: `__resumeLog()` prints the durable ring, `__resumeClear()` wipes.
  const w = window as unknown as Record<string, unknown>;
  w.__resumeLog = () => {
    // eslint-disable-next-line no-console
    console.table(getResumeLog());
    return getResumeLog();
  };
  w.__resumeClear = clearResumeLog;

  let lastHiddenAt = 0;

  const onVisibility = () => {
    if (document.hidden) {
      lastHiddenAt = Date.now();
      return;
    }
    fireResumeOnce(
      lastHiddenAt
        ? `visibility (was hidden ${Date.now() - lastHiddenAt}ms)`
        : "visibility (initial)",
    );
  };

  const onFocus = () => {
    // Only treat as "resume" if we were actually hidden; refocus from a
    // different app window mid-session is not a blank-screen trigger.
    if (lastHiddenAt && Date.now() - lastHiddenAt > 100) {
      fireResumeOnce(`focus (was hidden ${Date.now() - lastHiddenAt}ms)`);
    }
  };

  const onPageShow = (e: PageTransitionEvent) => {
    // BFCache restore on Safari lands here. Reset hidden timer so the
    // accompanying `visibilitychange` reports a coherent duration.
    if (e.persisted) lastHiddenAt = Date.now();
  };

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", onFocus);
  window.addEventListener("pageshow", onPageShow);

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("pageshow", onPageShow);
    installed = false;
  };
}

/** Manual trigger for tests / "did this fix it?" button. */
export function debugFireResume(reason = "manual"): void {
  fireResumeOnce(reason);
}
