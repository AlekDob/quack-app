import { useLayoutEffect, useState } from "react";
import { useChatSwitching } from "../useChatSwitching";

// Fade-OUT duration — must match the `.chat-switch-veil` opacity transition in CSS.
const FADE_MS = 160;

/** Gradual translucent loader shown while a chat / session switch hydrates.
 *
 *  Mounted ONCE at the app root with `global` (driven by the global switch
 *  pulse, `position: fixed` full-window): shows on EVERY switch — including
 *  cross-project, where the old host unmounts and the new one isn't visible.
 *
 *  Show is SYNCHRONOUS (no fade-in rAF). Fade-in used to leave opacity 0 while
 *  the main thread was busy applying a dense transcript — user saw a blank
 *  stall with no loader (Perf Audit 086). Fade-out still softens the reveal. */
export function ChatSwitchVeil({
  active,
  global = false,
}: {
  active?: boolean;
  global?: boolean;
}) {
  const auto = useChatSwitching();
  const on = active ?? auto;
  // First paint while `on` must already be opaque — layout effect keeps it
  // in sync when the pulse flips without unmounting the node.
  const [mounted, setMounted] = useState(on);
  const [shown, setShown] = useState(on);

  useLayoutEffect(() => {
    if (on) {
      setMounted(true);
      setShown(true);
      return;
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), FADE_MS);
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
