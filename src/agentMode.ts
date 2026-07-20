// Global "agent mode" toggle — flips the whole window from the
// editor-centric layout (sidebar + editor panes + docked AI) into an
// agent-centric one: a sessions list, a full-width chat, and a
// Changes/Files context panel. Think of it as Zen's opposite number —
// where Zen strips the chrome to foreground code, Agent Mode
// foregrounds the conversation with the model.
//
// Why a global flag (same reasoning as zenMode.ts): the chrome
// (TopBar, ActivityBar, StatusBar) lives above the per-workspace layer,
// and which workspace is active is orthogonal to which *view mode* the
// window is in. A per-workspace flag would force the same shouty
// branching in App.tsx that zen deliberately avoids. Agent mode is a
// viewing preference, not project state.
//
// Persistence: localStorage so the choice survives reloads. Like Zen we
// don't toast on toggle — the layout swap IS the feedback.

import { useEffect, useState } from "react";
import { getString as lsGetString, setString as lsSetString } from "./localStore";
import { markAgentModeSwitch } from "./switchPerf";

const KEY = "lcp.agentMode";

let _agent = lsGetString(KEY) === "1";
const listeners = new Set<(v: boolean) => void>();

function notify() {
  for (const l of listeners) l(_agent);
}

export function getAgentMode(): boolean {
  return _agent;
}

export function setAgentMode(v: boolean): void {
  if (_agent === v) return;
  markAgentModeSwitch(v ? "agent" : "ide");
  _agent = v;
  if (v) lsSetString(KEY, "1");
  else lsSetString(KEY, "");
  notify();
}

export function toggleAgentMode(): void {
  setAgentMode(!_agent);
}

export function useAgentMode(): boolean {
  const [v, setV] = useState(_agent);
  useEffect(() => {
    listeners.add(setV);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}
