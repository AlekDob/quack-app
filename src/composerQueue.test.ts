import { describe, expect, it } from "vitest";
import {
  normalizeQueuedDraft,
  queueItemFromSend,
  stripQueueForPersist,
  type QueuedComposerKnobs,
} from "./composerQueue";

const knobs: QueuedComposerKnobs = {
  presetId: "nora",
  model: "sonnet",
  effort: "high",
  thinking: true,
  permMode: "default",
};

describe("queueItemFromSend", () => {
  it("stamps agent knobs onto the item", () => {
    const item = queueItemFromSend("follow up", [], knobs);
    expect(item).toEqual({
      text: "follow up",
      presetId: "nora",
      model: "sonnet",
      effort: "high",
      thinking: true,
      permMode: "default",
    });
  });

  it("returns null for empty text and no images", () => {
    expect(queueItemFromSend("  ", [], knobs)).toBeNull();
  });

  it("keeps image metas and knobs together", () => {
    const item = queueItemFromSend("", [
      { id: "i1", path: "/tmp/a.png", name: "a.png", thumb: "data:x" },
    ], knobs);
    expect(item?.text).toBe("");
    expect(item?.images).toHaveLength(1);
    expect(item?.presetId).toBe("nora");
    expect(item?.model).toBe("sonnet");
  });
});

describe("stripQueueForPersist", () => {
  it("keeps knobs and strips thumbs", () => {
    const out = stripQueueForPersist([
      {
        text: "hi",
        presetId: "milo",
        model: "opus",
        effort: "medium",
        thinking: null,
        permMode: null,
        images: [{ id: "i1", path: "/p", name: "n", thumb: "data:big" }],
      },
    ]);
    expect(out[0]).toEqual({
      text: "hi",
      presetId: "milo",
      model: "opus",
      effort: "medium",
      thinking: null,
      permMode: null,
      images: [{ id: "i1", path: "/p", name: "n" }],
    });
  });
});

describe("normalizeQueuedDraft", () => {
  it("accepts legacy string[]", () => {
    expect(normalizeQueuedDraft(["a", "b"])).toEqual([
      { text: "a", presetId: null, model: "" },
      { text: "b", presetId: null, model: "" },
    ]);
  });

  it("round-trips knobs on object entries", () => {
    const raw = [
      {
        text: "x",
        presetId: "vera",
        model: "haiku",
        effort: "low",
        thinking: false,
        permMode: "plan",
      },
    ];
    expect(normalizeQueuedDraft(raw)).toEqual(raw);
  });

  it("fills missing knobs on legacy { text } objects", () => {
    expect(normalizeQueuedDraft([{ text: "old" }])).toEqual([
      { text: "old", presetId: null, model: "", images: undefined },
    ]);
  });
});
