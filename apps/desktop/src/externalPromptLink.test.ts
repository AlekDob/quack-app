import { describe, expect, it } from "vitest";

import {
  findExternalPromptLink,
  MAX_EXTERNAL_PROMPT_BYTES,
  parseExternalPromptLink,
} from "./externalPromptLink";

describe("externalPromptLink", () => {
  it("accepts a Linear prompt, including Unicode", () => {
    expect(parseExternalPromptLink("quack://open?source=linear&prompt=Caff%C3%A8%20%F0%9F%A6%86")).toEqual({
      source: "linear",
      prompt: "Caffè 🦆",
    });
  });

  it.each([
    "https://open?source=linear&prompt=Fix",
    "quack://other?source=linear&prompt=Fix",
    "quack://open?source=other&prompt=Fix",
    "quack://open?source=linear&prompt=",
    "quack://open?source=linear&prompt=Fix&extra=value",
    "quack://open?source=linear&prompt=%ZZ",
    "quack://open?source=linear&source=linear&prompt=Fix",
    "quack://open?source=linear&prompt=Fix&prompt=Again",
  ])("rejects invalid links: %s", (url) => {
    expect(parseExternalPromptLink(url)).toBeNull();
  });

  it("rejects prompts beyond the byte limit", () => {
    const prompt = "a".repeat(MAX_EXTERNAL_PROMPT_BYTES + 1);
    expect(parseExternalPromptLink(`quack://open?source=linear&prompt=${prompt}`)).toBeNull();
  });

  it("finds a prompt link in process arguments", () => {
    expect(findExternalPromptLink(["Quack", "--flag", "quack://open?source=linear&prompt=Fix"])).toEqual({
      source: "linear",
      prompt: "Fix",
    });
  });
});
