import { useEffect, useState } from "react";
import { useChatSwitching } from "../useChatSwitching";

// Fade duration — must match the `.chat-switch-veil` opacity transition in CSS
// so the node unmounts exactly when the fade-out ends (no flicker, no leftover).
const FADE_MS = 240;

/** Gradual translucent loader shown while a chat / session switch hydrates.
 *  Fades IN on `active`, then lingers mounted through a fade-OUT so the
 *  transition reads smooth instead of a hard content pop. `active` defaults to
 *  the global switch pulse; hosts pass their own foreground-gated flag so a
 *  background (non-visible) panel never flashes the veil. Mount inside any
 *  chat host with `position: relative`. */
export function ChatSwitchVeil({ active }: { active?: boolean }) {
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
    const t = setTimeout(() => setMounted(false), FADE_MS);
    return () => clearTimeout(t);
  }, [on]);

  if (!mounted) return null;
  return (
    <div
      className={`chat-switch-veil${shown ? " is-shown" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="chat-switch-veil-bar" aria-hidden="true" />
      <span className="ai-spinner chat-switch-veil-spinner" aria-hidden="true" />
      <span className="chat-switch-veil-label">Loading chat…</span>
    </div>
  );
}
