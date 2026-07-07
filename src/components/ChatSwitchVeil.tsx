import { useEffect, useState } from "react";
import { isChatSwitching, subscribeChatSwitch } from "../chatSwitch";

/** Solid loading veil — mount inside any chat host with position: relative. */
export function ChatSwitchVeil() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeChatSwitch(() => setTick((n) => n + 1)), []);
  if (!isChatSwitching()) return null;
  return (
    <div className="chat-switch-veil" role="status" aria-live="polite">
      <span className="ai-spinner chat-switch-veil-spinner" aria-hidden="true" />
      <span className="chat-switch-veil-label">Loading chat…</span>
    </div>
  );
}
