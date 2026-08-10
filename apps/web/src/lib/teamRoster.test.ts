import type { TeamRoster } from "@synara/contracts";
import { describe, expect, it } from "vitest";

import {
  composerPaperiFromRoster,
  paperoResolverFromRoster,
  teamRosterQueryKey,
} from "./teamRoster";

const roster: TeamRoster = {
  scope: { kind: "global" },
  agents: [
    {
      id: "builder",
      source: "builtin",
      name: "Milo",
      role: "Builder",
      avatar: "/images/ducks/duck14.jpeg",
      purpose: "Ship code.",
      instructions: "Use the edited profile.",
      modelSlots: {},
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-06T00:00:00.000Z",
      deletedAt: null,
    },
  ],
};

describe("composerPaperiFromRoster", () => {
  it("uses the persisted Team avatar for Milo", () => {
    const milo = composerPaperiFromRoster(roster).find((agent) => agent.id === "builder");

    expect(milo).toMatchObject({
      avatar: "/images/ducks/duck14.jpeg",
      instructions: "Use the edited profile.",
    });
  });

  it("keeps built-in definitions when the roster has no override", () => {
    const nora = composerPaperiFromRoster(roster).find((agent) => agent.id === "debugger");

    expect(nora?.avatar).toBe("/images/ducks/duck16.jpeg");
  });
});

describe("paperoResolverFromRoster", () => {
  const resolve = paperoResolverFromRoster(composerPaperiFromRoster(roster));

  it("resolves the Team avatar, so the transcript matches the composer", () => {
    expect(resolve("builder").avatar).toBe("/images/ducks/duck14.jpeg");
  });

  it("falls back to the built-in definition for an unedited papero", () => {
    expect(resolve("debugger").avatar).toBe("/images/ducks/duck16.jpeg");
  });
});

describe("teamRosterQueryKey", () => {
  it("uses the same global key in Team and composer", () => {
    expect(teamRosterQueryKey({ kind: "global" })).toEqual(["team", "global", null]);
  });
});
