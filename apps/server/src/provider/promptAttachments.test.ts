// FILE: promptAttachments.test.ts
// Purpose: Locks provider prompt attachment filtering so UI-only context chips do not reach native providers.
// Layer: Provider adapter utility tests
// Depends on: promptAttachments helper and shared chat attachment contracts.

import { MessageId, type ChatAttachment } from "@synara/contracts";
import { Effect } from "effect";
import { decode as decodeJpeg } from "jpeg-js";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";

import {
  filterProviderPromptImageAttachments,
  loadProviderPromptImageBlocks,
} from "./promptAttachments.ts";
import { PROMPT_IMAGE_MAX_EDGE_PX } from "./promptImageDownscale.ts";

describe("filterProviderPromptImageAttachments", () => {
  it("keeps images while dropping assistant selections from provider-native prompts", () => {
    const imageAttachment = {
      type: "image",
      id: "thread-1-image-1",
      name: "screen.png",
      mimeType: "image/png",
      sizeBytes: 128,
    } satisfies ChatAttachment;
    const selectionAttachment = {
      type: "assistant-selection",
      id: "thread-1-selection-1",
      assistantMessageId: MessageId.makeUnsafe("assistant-message-1"),
      text: "Selected assistant text is already serialized into the prompt body.",
    } satisfies ChatAttachment;

    expect(filterProviderPromptImageAttachments([selectionAttachment, imageAttachment])).toEqual([
      imageAttachment,
    ]);
  });
});

describe("loadProviderPromptImageBlocks", () => {
  it("downscales a wide PNG into a smaller JPEG", async () => {
    const png = new PNG({ width: 2000, height: 200 });
    for (let i = 0; i < png.data.length; i++) {
      png.data[i] = (i * 13) & 255;
    }
    const pngBytes = PNG.sync.write(png, { deflateLevel: 0 });
    expect(pngBytes.byteLength).toBeGreaterThan(400 * 1024);

    const blocks = await Effect.runPromise(
      loadProviderPromptImageBlocks({
        attachments: [
          {
            type: "image",
            id: "thread-1-image-1",
            name: "wide.png",
            mimeType: "image/png",
            sizeBytes: pngBytes.byteLength,
          },
        ],
        attachmentsDir: "/tmp",
        provider: "cursor",
        method: "session/prompt",
        readFile: () => Effect.succeed(pngBytes),
      }),
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: "image", mimeType: "image/jpeg" });
    if (blocks[0]?.type !== "image") {
      throw new Error("expected an image block");
    }
    const jpegBytes = Buffer.from(blocks[0].data, "base64");
    expect(jpegBytes.byteLength).toBeLessThan(pngBytes.byteLength);
    const jpeg = decodeJpeg(jpegBytes, { maxMemoryUsageInMB: 64 });
    expect(Math.max(jpeg.width, jpeg.height)).toBeLessThanOrEqual(PROMPT_IMAGE_MAX_EDGE_PX);
  });

  it("omits undecodable oversized bytes instead of aborting the turn", async () => {
    const garbage = Buffer.alloc(500 * 1024, 7);
    const blocks = await Effect.runPromise(
      loadProviderPromptImageBlocks({
        attachments: [
          {
            type: "image",
            id: "thread-1-image-2",
            name: "broken.bin",
            mimeType: "image/png",
            sizeBytes: garbage.byteLength,
          },
        ],
        attachmentsDir: "/tmp",
        provider: "cursor",
        method: "session/prompt",
        readFile: () => Effect.succeed(garbage),
      }),
    );

    expect(blocks).toEqual([
      {
        type: "text",
        text: expect.stringContaining("Omitted image broken.bin"),
      },
    ]);
  });
});
