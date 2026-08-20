import { beforeEach, expect, test } from "vitest";

import { readProjectLinearDefaults, writeProjectLinearDefaults } from "./projectLinearDefaults";

// Node env: the module only needs window.localStorage, so stub that much.
const store = new Map<string, string>();
globalThis.window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  },
} as unknown as Window & typeof globalThis;

beforeEach(() => store.clear());

test("round-trips, clears, and ignores incomplete entries", () => {
  expect(readProjectLinearDefaults("p1")).toBeNull();

  writeProjectLinearDefaults("p1", { workspaceId: "w", teamId: "t", projectId: null });
  writeProjectLinearDefaults("p2", { workspaceId: "w", teamId: "t2", projectId: "proj" });
  expect(readProjectLinearDefaults("p1")).toEqual({
    workspaceId: "w",
    teamId: "t",
    projectId: null,
  });
  expect(readProjectLinearDefaults("p2")?.projectId).toBe("proj");

  writeProjectLinearDefaults("p1", null);
  expect(readProjectLinearDefaults("p1")).toBeNull();
  expect(readProjectLinearDefaults("p2")?.teamId).toBe("t2");

  window.localStorage.setItem(
    "synara:project-linear-defaults:v1",
    JSON.stringify({ p3: { workspaceId: "w", teamId: "" } }),
  );
  expect(readProjectLinearDefaults("p3")).toBeNull();
});
