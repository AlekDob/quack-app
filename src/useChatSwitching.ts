import { useEffect, useState } from "react";
import { isChatSwitching, subscribeChatSwitch } from "./chatSwitch";

export function useChatSwitching(): boolean {
  const [, setTick] = useState(0);
  useEffect(() => subscribeChatSwitch(() => setTick((n) => n + 1)), []);
  return isChatSwitching();
}
