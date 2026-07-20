import { describe, expect, it } from "vitest";
import {
  backfillAssistantAgentIds,
  displayAgentForAssistantRow,
  resolveMessageAgentId,
  sessionAgentFromStored,
  streamingBubbleAgentId,
} from "./chatTurnAgent";
import type { ChatMessage } from "./ai";

describe("streamingBubbleAgentId", () => {
  it("keeps the frozen turn agent when the composer switches mid-turn", () => {
    expect(streamingBubbleAgentId("builder", null)).toBe("builder");
    expect(streamingBubbleAgentId(null, "builder")).toBe(null);
  });

  it("falls back to the live preset when no turn is in flight", () => {
    expect(streamingBubbleAgentId(undefined, "builder")).toBe("builder");
    expect(streamingBubbleAgentId(undefined, null)).toBe(null);
  });
});

describe("resolveMessageAgentId", () => {
  it("keeps an explicit Jack null even when the session is Milo", () => {
    expect(resolveMessageAgentId(null, "builder")).toBe(null);
  });

  it("keeps a stamped preset id", () => {
    expect(resolveMessageAgentId("debugger", "builder")).toBe("debugger");
  });

  it("falls back to the session preset for legacy rows missing agentId", () => {
    expect(resolveMessageAgentId(undefined, "builder")).toBe("builder");
    expect(resolveMessageAgentId(undefined, null)).toBe(null);
  });
});

describe("sessionAgentFromStored", () => {
  it("maps omitted presetId to Jack (null)", () => {
    expect(sessionAgentFromStored(undefined)).toBe(null);
  });

  it("keeps an explicit Milo/builder id", () => {
    expect(sessionAgentFromStored("builder")).toBe("builder");
  });
});

describe("pass-ball apply-then-send contract", () => {
  it("send reads the sync-applied preset, not stale React state", () => {
    // Mirrors applyPreset: ref updates immediately; setState is deferred.
    let reactPresetId: string | null = null; // Jack
    const presetIdRef = { current: reactPresetId as string | null };
    const applyPreset = (id: string | null) => {
      presetIdRef.current = id;
      // setPresetId(id) scheduled — reactPresetId stays Jack until re-render
    };
    applyPreset("builder");
    const agentAtSend = presetIdRef.current;
    expect(agentAtSend).toBe("builder");
    expect(reactPresetId).toBe(null);
    expect(streamingBubbleAgentId(agentAtSend, reactPresetId)).toBe("builder");
  });

  it("stamps commit and bubble with the same agentAtSend (no Jack/Milo split)", () => {
    const agentAtSend = "builder";
    const bubble = streamingBubbleAgentId(agentAtSend, null);
    const commit = agentAtSend;
    expect(bubble).toBe(commit);
    expect(bubble).not.toBe(null);
  });

  it("does not apply a deleted preset id to the ref before validation", () => {
    // Contract: resolve def first; only then write presetIdRef.
    let reactPresetId: string | null = null;
    const presetIdRef = { current: reactPresetId as string | null };
    const resolve = (id: string | null) =>
      id === "gone" ? undefined : { id };
    const applyPreset = (id: string | null) => {
      const def = resolve(id);
      if (!def) return;
      presetIdRef.current = id;
      reactPresetId = id;
    };
    applyPreset("gone");
    expect(presetIdRef.current).toBe(null);
    applyPreset("builder");
    expect(presetIdRef.current).toBe("builder");
  });
});

describe("chat-session switch Jack ↔ Milo", () => {
  it("legacy Milo transcript without agentId paints as Milo after backfill", () => {
    const sessionAgent = sessionAgentFromStored("builder");
    const raw: ChatMessage[] = [
      { role: "user", content: "go" },
      { role: "assistant", content: "Sono Milo…" },
    ];
    const filled = backfillAssistantAgentIds(raw, sessionAgent);
    expect(
      displayAgentForAssistantRow({
        messageAgentId: filled[1].agentId,
        sessionPresetId: sessionAgent,
        turnFrozenId: undefined,
        isStreamingBubble: false,
      }),
    ).toBe("builder");
  });

  it("Jack session with explicit null agentId stays Jack when opening Milo chat is N/A per panel", () => {
    const jackSession = sessionAgentFromStored(undefined);
    const msgs = backfillAssistantAgentIds(
      [{ role: "assistant", content: "plan", agentId: null }],
      jackSession,
    );
    expect(
      resolveMessageAgentId(msgs[0].agentId, jackSession),
    ).toBe(null);
  });

  it("switching composer mid-stream does not reattribute the live bubble", () => {
    const frozenAtSend: string | null = null; // started as Jack
    const liveAfterSwitch = "builder"; // user picked Milo
    expect(
      displayAgentForAssistantRow({
        messageAgentId: undefined,
        sessionPresetId: liveAfterSwitch,
        turnFrozenId: frozenAtSend,
        isStreamingBubble: true,
      }),
    ).toBe(null);
  });

  it("regression: Sono Milo under Jack header must not happen after handoff", () => {
    // Before fix: stale react state null + live Milo words.
    // After fix: agentAtSend from ref === builder for both stamp and identity.
    let reactState: string | null = null;
    const ref: { current: string | null } = { current: reactState };
    ref.current = "builder"; // applyPreset sync
    const agentAtSend = ref.current;
    const header = streamingBubbleAgentId(agentAtSend, reactState);
    expect(header).toBe("builder");
    expect(header).not.toBe(null);
  });
});

describe("backfillAssistantAgentIds", () => {
  it("stamps only assistant rows that lack agentId", () => {
    const msgs: ChatMessage[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "a" },
      { role: "assistant", content: "b", agentId: null },
      { role: "assistant", content: "c", agentId: "debugger" },
    ];
    const out = backfillAssistantAgentIds(msgs, "builder");
    expect(out[1].agentId).toBe("builder");
    expect(out[2].agentId).toBe(null);
    expect(out[3].agentId).toBe("debugger");
    expect(out[0]).toBe(msgs[0]);
  });

  it("returns the same array when nothing needs backfill", () => {
    const msgs: ChatMessage[] = [
      { role: "assistant", content: "a", agentId: "builder" },
    ];
    expect(backfillAssistantAgentIds(msgs, "builder")).toBe(msgs);
  });

  it("backfills Jack session (null) without rewriting explicit Milo rows", () => {
    const msgs: ChatMessage[] = [
      { role: "assistant", content: "old" },
      { role: "assistant", content: "milo", agentId: "builder" },
    ];
    const out = backfillAssistantAgentIds(msgs, null);
    expect(out[0].agentId).toBe(null);
    expect(out[1].agentId).toBe("builder");
  });
});
