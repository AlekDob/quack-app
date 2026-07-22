import { describe, expect, it } from "vitest";
import { isSpendLimitText, splitSpendLimitText } from "./spendLimitMessage";

const ORG =
  "You've hit your org's monthly spend limit · run /usage-credits to ask your admin for a higher limit";

describe("isSpendLimitText", () => {
  it("matches org monthly spend limit copy", () => {
    expect(isSpendLimitText(ORG)).toBe(true);
  });

  it("rejects normal assistant prose", () => {
    expect(isSpendLimitText("Explored 4 files in public/images.")).toBe(false);
  });
});

describe("splitSpendLimitText", () => {
  it("returns null when there is no limit", () => {
    expect(splitSpendLimitText("hello")).toBeNull();
  });

  it("treats a pure limit message as limit-only", () => {
    expect(splitSpendLimitText(ORG)).toEqual({
      remainder: "",
      limit: ORG,
    });
  });

  it("keeps preceding prose and isolates the limit line", () => {
    const prose = "Ci sono foto in `public/images/clients/`.";
    expect(splitSpendLimitText(`${prose}\n${ORG}`)).toEqual({
      remainder: prose,
      limit: ORG,
    });
  });
});
