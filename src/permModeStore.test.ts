import { describe, expect, it } from "vitest";
import { getPermModeFor, setPermMode } from "./permModeStore";

describe("permModeStore isolation", () => {
  it("keeps Plan per session_id and does not leak via byCwd", () => {
    setPermMode({ sessionId: "chat-a", cwd: "/proj" }, "plan");
    setPermMode({ sessionId: "chat-b", cwd: "/proj" }, "auto");

    expect(getPermModeFor({ session_id: "chat-a", cwd: "/proj" })).toBe(
      "plan",
    );
    expect(getPermModeFor({ session_id: "chat-b", cwd: "/proj" })).toBe(
      "auto",
    );
    // Known session id with no recorded mode must not inherit sibling cwd mode.
    expect(
      getPermModeFor({ session_id: "chat-c", cwd: "/proj" }),
    ).toBe("default");
  });

  it("allows byCwd only when request has no session_id", () => {
    setPermMode({ sessionId: null, cwd: "/fresh" }, "acceptEdits");
    expect(getPermModeFor({ session_id: null, cwd: "/fresh" })).toBe(
      "acceptEdits",
    );
    setPermMode({ sessionId: "s1", cwd: "/fresh" }, "plan");
    // Plan clears byCwd — bare cwd lookup falls back to Ask.
    expect(getPermModeFor({ cwd: "/fresh" })).toBe("default");
  });
});
