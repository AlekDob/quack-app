// Dev-only Agent Mode ↔ IDE toggle simulation (feature 085).
// Trigger: create `<wsRoot>/documentation/.agent-mode-sim-trigger`.
// Results: `<wsRoot>/documentation/.agent-mode-sim-results.json`.

import { getAgentMode, setAgentMode } from "./agentMode";
import { fs } from "./ipc";
import {
  getAgentModePhases,
  subscribeAgentModePhases,
  type AgentModePhaseEvent,
  type AgentModeTarget,
} from "./switchPerf";
import { useStore } from "./store";

const TRIGGER = "documentation/.agent-mode-sim-trigger";
const RESULTS = "documentation/.agent-mode-sim-results.json";
/** Fallback when the open workspace isn't this repo (agent-driven sims). */
const ABS_TRIGGER =
  "/Users/alekdob/Desktop/Dev/Personal/codetta/documentation/.agent-mode-sim-trigger";
const ABS_RESULTS =
  "/Users/alekdob/Desktop/Dev/Personal/codetta/documentation/.agent-mode-sim-results.json";
const TMP_RESULTS = "/tmp/quack-agent-mode-sim-results.json";
const SETTLE_MS = 4000;
const GAP_MS = 600;
const QUIET_MS = 500;

export type AgentModeSimRun = {
  direction: AgentModeTarget;
  startedAt: string;
  phases: AgentModePhaseEvent[];
  dominantPhase: string | null;
  totalMs: number | null;
};

export type AgentModeSimReport = {
  ranAt: string;
  wsId: string;
  root: string;
  openProjects: number;
  openFileTabs: number;
  openTerminals: number;
  openChats: number;
  runs: AgentModeSimRun[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function joinRoot(root: string, rel: string): string {
  const base = root.endsWith("/") ? root.slice(0, -1) : root;
  return `${base}/${rel}`;
}

function countOpenTabs(wsId: string): number {
  const ws = useStore.getState().loaded[wsId];
  if (!ws) return 0;
  let n = 0;
  const walk = (pane: {
    kind: string;
    tabs?: string[];
    first?: unknown;
    second?: unknown;
  }) => {
    if (pane.kind === "tabs" && pane.tabs) n += pane.tabs.length;
    if (pane.kind === "split") {
      if (pane.first) walk(pane.first as typeof pane);
      if (pane.second) walk(pane.second as typeof pane);
    }
  };
  walk(ws.layout.editorRoot);
  return n;
}

function waitForPhase(
  name: string,
  timeoutMs: number,
): Promise<AgentModePhaseEvent | null> {
  const existing = getAgentModePhases().find((p) => p.phase === name);
  if (existing) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const t = window.setTimeout(() => {
      unsub();
      resolve(null);
    }, timeoutMs);
    const unsub = subscribeAgentModePhases((e) => {
      if (e.phase !== name) return;
      window.clearTimeout(t);
      unsub();
      resolve(e);
    });
  });
}

function waitForQuiet(timeoutMs: number, quietMs: number): Promise<void> {
  return new Promise((resolve) => {
    let lastAt = performance.now();
    const unsub = subscribeAgentModePhases(() => {
      lastAt = performance.now();
    });
    const started = performance.now();
    const tick = window.setInterval(() => {
      const now = performance.now();
      if (now - lastAt >= quietMs || now - started >= timeoutMs) {
        window.clearInterval(tick);
        unsub();
        resolve();
      }
    }, 50);
  });
}

function dominantPhaseOf(
  phases: AgentModePhaseEvent[],
): string | null {
  if (phases.length === 0) return null;
  return phases.reduce((a, b) => (b.sinceMs >= a.sinceMs ? b : a)).phase;
}

async function runDirection(to: AgentModeTarget): Promise<AgentModeSimRun> {
  const startedAt = new Date().toISOString();
  setAgentMode(to === "agent");
  const settleName = to === "agent" ? "agent-shell mounted" : "editors ready";
  await waitForPhase(settleName, SETTLE_MS);
  await waitForPhase("chat hydrate done", SETTLE_MS);
  await waitForQuiet(SETTLE_MS, QUIET_MS);
  await sleep(GAP_MS);
  const phases = [...getAgentModePhases()];
  const last = phases[phases.length - 1];
  return {
    direction: to,
    startedAt,
    phases,
    dominantPhase: dominantPhaseOf(phases),
    totalMs: last?.sinceMs ?? null,
  };
}

function buildContext(wsId: string, root: string): Omit<AgentModeSimReport, "runs" | "ranAt"> {
  const ws = useStore.getState().loaded[wsId];
  return {
    wsId,
    root,
    openProjects: useStore.getState().openIds.length,
    openFileTabs: countOpenTabs(wsId),
    openTerminals: ws ? Object.keys(ws.terminals).length : 0,
    openChats: ws ? Object.keys(ws.aiChats).length : 0,
  };
}

/** One full round-trip: ensure IDE → Agent → IDE (or reverse start). */
export async function runAgentModeSwitchSim(
  root: string,
  wsId: string,
): Promise<AgentModeSimReport> {
  const wasAgent = getAgentMode();
  const runs: AgentModeSimRun[] = [];
  if (wasAgent) {
    runs.push(await runDirection("ide"));
    await sleep(GAP_MS);
    runs.push(await runDirection("agent"));
  } else {
    runs.push(await runDirection("agent"));
    await sleep(GAP_MS);
    runs.push(await runDirection("ide"));
  }
  setAgentMode(wasAgent);
  const report: AgentModeSimReport = {
    ranAt: new Date().toISOString(),
    ...buildContext(wsId, root),
    runs,
  };
  await fs.writeFile(joinRoot(root, RESULTS), JSON.stringify(report, null, 2));
  console.log("[agent-mode-switch] sim report", report);
  return report;
}

let simRunning = false;
let pollStarted = false;

async function resolveTrigger(
  root: string,
): Promise<{ triggerPath: string; resultsPath: string } | null> {
  const local = joinRoot(root, TRIGGER);
  try {
    if (await fs.exists(local)) {
      return { triggerPath: local, resultsPath: joinRoot(root, RESULTS) };
    }
  } catch {
    /* ignore */
  }
  try {
    if (await fs.exists(ABS_TRIGGER)) {
      return { triggerPath: ABS_TRIGGER, resultsPath: ABS_RESULTS };
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function writeSimReport(
  report: AgentModeSimReport,
  resultsPath: string,
): Promise<void> {
  const json = JSON.stringify(report, null, 2);
  await fs.writeFile(ABS_RESULTS, json);
  await fs.writeFile(TMP_RESULTS, json);
  if (resultsPath !== ABS_RESULTS) await fs.writeFile(resultsPath, json);
}

/** If the trigger file exists under the active workspace, run once and delete it. */
export async function maybeRunAgentModeSwitchSim(): Promise<void> {
  if (!import.meta.env.DEV || simRunning) return;
  const st = useStore.getState();
  const wsId = st.activeId;
  if (!wsId) return;
  const root = st.loaded[wsId]?.meta.root;
  if (!root) return;
  const paths = await resolveTrigger(root);
  if (!paths) return;
  simRunning = true;
  console.log("[agent-mode-switch] sim trigger found — running");
  try {
    await fs.delete(paths.triggerPath);
    const report = await runAgentModeSwitchSim(root, wsId);
    await writeSimReport(report, paths.resultsPath);
  } catch (e) {
    console.warn("[agent-mode-switch] sim failed", e);
  } finally {
    simRunning = false;
  }
}

/** Start a cheap poll for the trigger file (idempotent). Called from App + HMR. */
export function startAgentModeSimPoll(): void {
  if (!import.meta.env.DEV || pollStarted) return;
  pollStarted = true;
  void maybeRunAgentModeSwitchSim();
  window.setInterval(() => {
    void maybeRunAgentModeSwitchSim();
  }, 2000);
}

if (import.meta.env.DEV && import.meta.hot) {
  import.meta.hot.accept(() => {
    pollStarted = false;
    startAgentModeSimPoll();
  });
}
