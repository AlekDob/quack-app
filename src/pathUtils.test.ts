import { describe, expect, it } from "vitest";
import { isUnderRoot, resolveUnderRoot } from "./pathUtils";

describe("isUnderRoot", () => {
  const alek = "/Users/alek/Desktop/Dev/Personal/alekdob";
  const codetta = "/Users/alek/Desktop/Dev/Personal/codetta";

  it("accepts absolute paths under the root", () => {
    expect(isUnderRoot(`${alek}/firma.html`, alek)).toBe(true);
    expect(isUnderRoot(alek, alek)).toBe(true);
  });

  it("rejects absolute paths in a sibling workspace", () => {
    expect(isUnderRoot(`${alek}/firma.html`, codetta)).toBe(false);
    expect(isUnderRoot(`${codetta}/src/App.tsx`, alek)).toBe(false);
  });

  it("accepts workspace-relative paths", () => {
    expect(isUnderRoot("firma.html", alek)).toBe(true);
    expect(isUnderRoot("src/App.tsx", codetta)).toBe(true);
  });

  it("handles Windows absolute paths", () => {
    expect(isUnderRoot("C:/proj/a/file.ts", "C:/proj/a")).toBe(true);
    expect(isUnderRoot("C:/proj/a/file.ts", "C:/proj/b")).toBe(false);
  });
});

describe("resolveUnderRoot", () => {
  const root = "/Users/alek/ws";

  it("keeps absolute paths already under root", () => {
    expect(resolveUnderRoot(`${root}/a.ts`, root)).toBe(`${root}/a.ts`);
  });

  it("joins relative paths", () => {
    expect(resolveUnderRoot("a.ts", root)).toBe(`${root}/a.ts`);
  });

  it("returns null for absolute paths outside root", () => {
    expect(resolveUnderRoot("/other/a.ts", root)).toBeNull();
  });
});
