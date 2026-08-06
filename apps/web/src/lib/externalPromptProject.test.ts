import { describe, expect, it } from "vitest";
import type { ProjectId } from "@synara/contracts";
import type { Project } from "../types";
import { resolveExternalPromptProjectId } from "./externalPromptProject";

function project(overrides: Partial<Project> & Pick<Project, "id">): Project {
  return {
    kind: "project",
    name: "Esopo",
    remoteName: "",
    folderName: "esopo",
    localName: null,
    cwd: "/Users/me/dev/esopo",
    defaultModelSelection: null,
    expanded: false,
    scripts: [],
    ...overrides,
  } as Project;
}

const esopo = project({ id: "p1" as ProjectId });
const other = project({
  id: "p2" as ProjectId,
  name: "Quack",
  folderName: "quack-20",
  cwd: "/Users/me/dev/quack-20",
});
const projects = [esopo, other];

describe("resolveExternalPromptProjectId", () => {
  it("returns null without a hint", () => {
    expect(resolveExternalPromptProjectId(projects, undefined)).toBeNull();
    expect(resolveExternalPromptProjectId(projects, "   ")).toBeNull();
  });

  it("matches by project id", () => {
    expect(resolveExternalPromptProjectId(projects, "p1")).toBe("p1");
  });

  it("matches by name, case-insensitively", () => {
    expect(resolveExternalPromptProjectId(projects, "esopo")).toBe("p1");
    expect(resolveExternalPromptProjectId(projects, "  ESOPO  ")).toBe("p1");
  });

  it("matches by folder name", () => {
    expect(resolveExternalPromptProjectId(projects, "quack-20")).toBe("p2");
  });

  it("matches by workspace path, ignoring a trailing slash", () => {
    expect(resolveExternalPromptProjectId(projects, "/Users/me/dev/esopo/")).toBe("p1");
  });

  it("prefers an id match over a name match", () => {
    const collision = [project({ id: "p1" as ProjectId, name: "Quack" }), other];
    expect(resolveExternalPromptProjectId(collision, "p1")).toBe("p1");
  });

  it("returns null when nothing matches", () => {
    expect(resolveExternalPromptProjectId(projects, "does-not-exist")).toBeNull();
  });

  it("ignores an empty localName rather than matching a blank hint", () => {
    expect(resolveExternalPromptProjectId([project({ id: "p3" as ProjectId })], "")).toBeNull();
  });
});
