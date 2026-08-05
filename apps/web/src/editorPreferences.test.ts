import { describe, expect, it } from "vitest";

import { resolveAndPersistPreferredEditor } from "./editorPreferences";

describe("editor preference resolution", () => {
  it("does not select an editor when no preference was saved", () => {
    expect(resolveAndPersistPreferredEditor(["antigravity", "cursor"])).toBeNull();
  });
});
