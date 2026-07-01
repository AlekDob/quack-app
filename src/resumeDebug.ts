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

const components = new Map<string, ResumeComponent>();

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

  // Single grouped console so the entire resume story is one collapsible
  // entry in DevTools instead of 4 disjoint lines.
  // eslint-disable-next-line no-console
  console.warn(
    `[resume] reason=${reason} components=${components.size} ` +
      `healed=${healedComponents.length}`,
    {
      viewport: {
        w: window.innerWidth,
        h: window.innerHeight,
        dpr: window.devicePixelRatio,
      },
      visible: typeof document !== "undefined" ? !document.hidden : true,
      heap:
        // performance.memory is a Chromium-only extension; on Tauri
        // (WKWebView) and Firefox it's undefined. Gate defensively so
        // the log doesn't throw mid-resume.
        typeof performance !== "undefined" &&
        (performance as Performance & { memory?: { usedJSHeapSize: number } })
          .memory
          ? Math.round(
              (performance as Performance & {
                memory?: { usedJSHeapSize: number };
              }).memory!.usedJSHeapSize / 1024 / 1024,
            ) + "MB"
          : "n/a",
      snaps,
    },
  );
}

/** Wire visibility/focus/pageshow listeners. Idempotent. */
export function installResumeDebug(): () => void {
  if (installed) return () => {};
  installed = true;

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
