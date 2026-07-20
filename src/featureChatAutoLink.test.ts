import { describe, expect, it } from "vitest";
import { featureSlugFromEditPath } from "./featureChatAutoLink";

const ROOT = "/Users/me/proj";

describe("featureSlugFromEditPath", () => {
  it("accepts abs path under documentation/features", () => {
    expect(
      featureSlugFromEditPath(
        `${ROOT}/documentation/features/104-scadenzario-avviso.md`,
        ROOT,
      ),
    ).toBe("104-scadenzario-avviso");
  });

  it("accepts relative FEATURE_DIR path", () => {
    expect(
      featureSlugFromEditPath(
        "documentation/features/054-works-layer.md",
        ROOT,
      ),
    ).toBe("054-works-layer");
  });

  it("rejects diary and non-NNN basename", () => {
    expect(
      featureSlugFromEditPath(
        `${ROOT}/documentation/diary/2026-07-20.md`,
        ROOT,
      ),
    ).toBeNull();
    expect(
      featureSlugFromEditPath(
        `${ROOT}/documentation/features/readme.md`,
        ROOT,
      ),
    ).toBeNull();
  });

  it("rejects nested paths under features/", () => {
    expect(
      featureSlugFromEditPath(
        `${ROOT}/documentation/features/sub/054-works-layer.md`,
        ROOT,
      ),
    ).toBeNull();
  });

  it("rejects unknown sentinel", () => {
    expect(featureSlugFromEditPath("(unknown)", ROOT)).toBeNull();
  });
});
