import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  isChatSwitching,
  pulseChatSwitch,
  endChatSwitch,
} from "./chatSwitch";
import { runOrDeferDuringChatSwitch } from "./deferDuringChatSwitch";

describe("runOrDeferDuringChatSwitch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Clear any leftover pulse from a prior test.
    if (isChatSwitching()) {
      endChatSwitch("test-reset");
      vi.runAllTimers();
    }
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs immediately when not switching", () => {
    const fn = vi.fn();
    runOrDeferDuringChatSwitch("a", fn);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("defers until veil drops and dedupes by key", () => {
    pulseChatSwitch({ source: "test", chatId: "c1" });
    expect(isChatSwitching()).toBe(true);

    const first = vi.fn();
    const second = vi.fn();
    runOrDeferDuringChatSwitch("same", first);
    runOrDeferDuringChatSwitch("same", second);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();

    endChatSwitch("test", "c1");
    vi.runAllTimers();
    expect(isChatSwitching()).toBe(false);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
