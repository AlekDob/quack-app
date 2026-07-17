import { useEffect, useState } from "react";
import {
  getWorkspaceLoad,
  subscribeWorkspaceLoad,
} from "../workspaceSwitchLoader";
import { getWorkspaceColor, subscribeWorkspaceColors } from "../workspaceColors";
import { useStore } from "../store";

// Must match the `.ws-switch-veil` opacity transition in App.css so the node
// unmounts exactly when the fade-out ends.
const FADE_MS = 220;

/** Project initials, same rule as the activity-bar icon (CO, SA, GG…). */
function initials(name: string): string {
  const parts = name.trim().split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

/** Full-screen wash shown while a COLD project switch mounts (workspace
 *  switch loader). Tinted with the incoming project's color so the wait reads
 *  as an intentional, branded transition instead of a jank. Warm switches
 *  never trigger it. Mounted once at the app root. */
export function WorkspaceSwitchVeil() {
  // Re-render on loader state changes; read fresh each render (getWorkspaceLoad
  // returns a new object, so we drive re-render via a tick, not useSyncStore).
  const [, tick] = useState(0);
  useEffect(() => subscribeWorkspaceLoad(() => tick((t) => t + 1)), []);
  useEffect(() => subscribeWorkspaceColors(() => tick((t) => t + 1)), []);

  const { wsId, visible } = getWorkspaceLoad();
  const name = useStore((s) => (wsId ? s.loaded[wsId]?.meta.name ?? "" : ""));
  const on = visible && !!wsId;

  const [mounted, setMounted] = useState(on);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (on) {
      setMounted(true);
      const r = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), FADE_MS);
    return () => clearTimeout(t);
  }, [on]);

  if (!mounted || !wsId) return null;
  const hex = getWorkspaceColor(wsId)?.hex ?? null;
  const style = hex
    ? ({ ["--ws-load-color"]: hex } as React.CSSProperties)
    : undefined;
  return (
    <div className={`ws-switch-veil${shown ? " is-shown" : ""}`} style={style}>
      <div className="ws-switch-veil-inner">
        <span className="ws-switch-veil-badge">{initials(name)}</span>
        {name && <span className="ws-switch-veil-name">{name}</span>}
      </div>
    </div>
  );
}
