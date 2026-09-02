import { describe, expect, it } from "vitest";

import {
  computeFunctionaryChildPositions,
  functionaryChildPlaqueWidth,
} from "./functionaryFlowLayout";
import {
  explainFunctionaryNode,
  parseFunctionaryMap,
  topLevelFunctionaryNodes,
  withFunctionarySourceNodes,
  type FunctionaryNode,
} from "./functionaryMap";

const mapJson = JSON.stringify({
  schemaVersion: 1,
  id: "quack",
  name: "Quack",
  nodes: [
    { id: "scope-web", label: "Web", kind: "scope", archetype: "district" },
    {
      id: "dock",
      label: "Right dock",
      kind: "module",
      archetype: "building",
      parentId: "scope-web",
    },
    {
      id: "tabs",
      label: "Tabs",
      kind: "module",
      archetype: "room",
      parentId: "dock",
      sourceRefs: [{ path: "apps/web/src/Tabs.tsx", line: 12, note: "Tab implementation." }],
    },
  ],
  edges: [],
});

describe("parseFunctionaryMap", () => {
  it("accepts Functionary schema v1 maps", () => {
    expect(parseFunctionaryMap(mapJson).name).toBe("Quack");
  });

  it("rejects unrelated JSON", () => {
    expect(() => parseFunctionaryMap('{"nodes":[]}')).toThrow(
      "This is not a Functionary schema v1 map.",
    );
  });
});

describe("topLevelFunctionaryNodes", () => {
  it("keeps structures inside scopes and hides their rooms", () => {
    expect(topLevelFunctionaryNodes(parseFunctionaryMap(mapJson)).map((node) => node.id)).toEqual([
      "dock",
    ]);
  });
});

describe("withFunctionarySourceNodes", () => {
  it("adds cited files under leaf components", () => {
    const map = withFunctionarySourceNodes(parseFunctionaryMap(mapJson));
    expect(map.nodes.at(-1)).toMatchObject({
      label: "Tabs.tsx",
      parentId: "tabs",
      sourceRefs: [{ path: "apps/web/src/Tabs.tsx", line: 12 }],
    });
  });

  it("does not add file nodes beside existing semantic children", () => {
    const map = withFunctionarySourceNodes(parseFunctionaryMap(mapJson));
    expect(map.nodes.some((node) => node.parentId === "dock" && node.label === "Tabs.tsx")).toBe(
      false,
    );
  });
});

describe("computeFunctionaryChildPositions", () => {
  it("leaves a gap between variable-width labels", () => {
    const nodes = [
      { id: "one", label: "Navigation and session boundary", kind: "module", archetype: "room" },
      { id: "two", label: "Orchestration state projection", kind: "module", archetype: "room" },
      { id: "three", label: "Conversation and workspace UI", kind: "module", archetype: "room" },
    ] as const;
    const positions = computeFunctionaryChildPositions(nodes, [0, 0]);

    for (let index = 1; index < nodes.length; index += 1) {
      const left = nodes[index - 1]!;
      const right = nodes[index]!;
      const distance = positions.get(right.id)![0] - positions.get(left.id)![0];
      const required =
        (functionaryChildPlaqueWidth(left.label) + functionaryChildPlaqueWidth(right.label)) / 2;
      expect(distance - required).toBeCloseTo(0.5, 8);
    }
  });
});

describe("explainFunctionaryNode", () => {
  it("maps archetypes to plain roles and softens technical wording", () => {
    const node = {
      id: "desktop-shell",
      label: "Desktop Shell",
      kind: "deployable",
      archetype: "building",
      description:
        "Electron application that hosts the client, supervises the local backend, and provides native IPC and browser capabilities.",
    } satisfies FunctionaryNode;

    expect(explainFunctionaryNode(node)).toEqual({
      title: "Desktop Shell",
      role: "A major piece of the product",
      body: "Desktop app that hosts the client, supervises the local backend, and provides native bridge and browser capabilities.",
    });
  });

  it("prefers external kind wording over archetype", () => {
    const node = {
      id: "github",
      label: "GitHub",
      kind: "external",
      archetype: "cloud",
      description: "External GitHub APIs and command-line services.",
    } satisfies FunctionaryNode;

    expect(explainFunctionaryNode(node)).toMatchObject({
      role: "Something outside Quack that it talks to",
      body: "External GitHub APIs and command-line services.",
    });
  });

  it("falls back to the role when description is missing", () => {
    const node = {
      id: "dock",
      label: "Right dock",
      kind: "module",
      archetype: "room",
    } satisfies FunctionaryNode;

    expect(explainFunctionaryNode(node)).toEqual({
      title: "Right dock",
      role: "A part inside that piece",
      body: "A part inside that piece",
    });
  });
});
