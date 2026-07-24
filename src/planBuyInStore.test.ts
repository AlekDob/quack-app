import { afterEach, describe, expect, it } from "vitest";
import {
  _resetPlanBuyInStoreForTests,
  getPlanBuyIn,
  publishPlanBuyIn,
} from "./planBuyInStore";

afterEach(() => _resetPlanBuyInStoreForTests());

describe("planBuyInStore isolation", () => {
  it("returns the buy-in only for the owning chatId", () => {
    publishPlanBuyIn({
      requestId: "r1",
      plan: "Plan A",
      chatId: "chat-a",
      sessionId: "sid-a",
      cwd: "/proj",
    });

    expect(getPlanBuyIn({ chatId: "chat-a" })?.plan).toBe("Plan A");
    expect(getPlanBuyIn({ chatId: "chat-b" })).toBeNull();
    expect(getPlanBuyIn({ chatId: "chat-b", sessionId: "sid-b" })).toBeNull();
  });

  it("does not leak via shared cwd (regression 008)", () => {
    publishPlanBuyIn({
      requestId: "r1",
      plan: "Price Guard",
      chatId: "orders-chat",
      sessionId: "sid-orders",
      cwd: "/Users/alek/codetta",
    });

    // Sibling Agent Mode session in the same workspace — must stay clean.
    expect(
      getPlanBuyIn({
        chatId: "graphify-chat",
        sessionId: undefined,
      }),
    ).toBeNull();
    expect(
      getPlanBuyIn({
        chatId: "graphify-chat",
        sessionId: "sid-other",
      }),
    ).toBeNull();
  });

  it("still resolves by Claude session id for the owner", () => {
    publishPlanBuyIn({
      requestId: "r1",
      plan: "Plan A",
      chatId: "chat-a",
      sessionId: "sid-a",
      cwd: "/proj",
    });
    expect(getPlanBuyIn({ sessionId: "sid-a" })?.chatId).toBe("chat-a");
  });
});
