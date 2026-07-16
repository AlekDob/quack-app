import { useEffect, useState } from "react";
import { useChatSwitching } from "../useChatSwitching";

// Fade duration — must match the `.chat-switch-veil` opacity transition in CSS
// so the node unmounts exactly when the fade-out ends (no flicker, no leftover).
const FADE_MS = 160;

/** Gradual translucent loader shown while a chat / session switch hydrates.
 *  Fades IN on `active`, then lingers mounted through a fade-OUT so the
 *  transition reads smooth instead of a hard content pop.
 *
 *  Mounted ONCE at the app root with `global` (driven by the global switch
 *  pulse, `position: fixed` full-window): this way it shows on EVERY switch —
 *  including cross-project switches, where the old host unmounts and the new
 *  one isn't visible yet, so a per-host veil would leave a "stuck" gap.
 *  `active` can still be passed to scope it to a container. */
export function ChatSwitchVeil({
  active,
  global = false,
}: {
  active?: boolean;
  global?: boolean;
}) {
  const auto = useChatSwitching();
  const on = active ?? auto;
  const [mounted, setMounted] = useState(on);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (on) {
      setMounted(true);
      // Paint one frame at opacity 0 before flipping to 1 → the fade-in runs.
      const r = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => {
      setMounted(false);
    }, FADE_MS);
    return () => clearTimeout(t);
  }, [on]);

  if (!mounted) return null;
  return (
    <div
      className={`chat-switch-veil${global ? " chat-switch-veil--global" : ""}${
        shown ? " is-shown" : ""
      }`}
      role="status"
      aria-live="polite"
    >
      <span className="chat-switch-veil-bar" aria-hidden="true" />
      <span className="ai-spinner chat-switch-veil-spinner" aria-hidden="true" />
      <span className="chat-switch-veil-label">Loading chat…</span>
    </div>
  );
}
