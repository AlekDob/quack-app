import { useChatSwitching } from "../useChatSwitching";

/** Solid loading veil — mount inside any chat host with position: relative. */
export function ChatSwitchVeil() {
  if (!useChatSwitching()) return null;
  return (
    <div className="chat-switch-veil" role="status" aria-live="polite">
      <span className="ai-spinner chat-switch-veil-spinner" aria-hidden="true" />
      <span className="chat-switch-veil-label">Loading chat…</span>
    </div>
  );
}
