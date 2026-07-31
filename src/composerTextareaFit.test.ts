import { describe, expect, it } from "vitest";
import {
  COMPOSER_INPUT_MAX_HEIGHT_PX,
  fitComposerInputHeight,
} from "./composerTextareaFit";

describe("fitComposerInputHeight", () => {
  it("caps at the composer max", () => {
    const el = {
      scrollHeight: 999,
      style: { height: "" },
    } as HTMLTextAreaElement;
    fitComposerInputHeight(el);
    expect(el.style.height).toBe(`${COMPOSER_INPUT_MAX_HEIGHT_PX}px`);
  });

  it("shrinks to content when shorter than max", () => {
    const el = {
      scrollHeight: 40,
      style: { height: "160px" },
    } as HTMLTextAreaElement;
    fitComposerInputHeight(el);
    expect(el.style.height).toBe("40px");
  });
});
