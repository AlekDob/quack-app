import { describe, expect, it } from "vitest";
import { veilFloorMs } from "./chatSwitch";

describe("veilFloorMs", () => {
  it("uses a short floor for instant hydrate (warm / empty)", () => {
    expect(veilFloorMs(0)).toBe(160);
    expect(veilFloorMs(23)).toBe(160);
    expect(veilFloorMs(60)).toBe(160);
  });

  it("pads mid-speed hydrate up to the soft floor", () => {
    expect(veilFloorMs(100)).toBe(220);
    expect(veilFloorMs(180)).toBe(220);
  });

  it("does not pad when hydrate already met the soft floor", () => {
    expect(veilFloorMs(220)).toBe(220);
    expect(veilFloorMs(250)).toBe(250);
    expect(veilFloorMs(500)).toBe(500);
  });
});
