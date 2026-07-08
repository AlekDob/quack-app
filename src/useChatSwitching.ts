import { useSyncExternalStore } from "react";
import { isChatSwitching, subscribeChatSwitch } from "./chatSwitch";

/** Subscribe to the module-level chat-switch pulse (agent + editor veils). */
export function useChatSwitching(): boolean {
  return useSyncExternalStore(
    subscribeChatSwitch,
    isChatSwitching,
    isChatSwitching,
  );
}
