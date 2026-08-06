// FILE: teamRoster.ts
// Purpose: Shared Team roster query identity and composer-facing built-in definitions.
// Layer: Web Team domain

import type { TeamRoster, TeamScope } from "@synara/contracts";
import { listComposerPaperi, type PaperoDefinition } from "@synara/shared/paperi";

export const GLOBAL_TEAM_SCOPE = { kind: "global" } as const satisfies TeamScope;

export function teamRosterQueryKey(scope: TeamScope) {
  return ["team", scope.kind, scope.kind === "project" ? scope.projectId : null] as const;
}

/** Custom agents are not selectable by the composer yet. */
export function composerPaperiFromRoster(
  roster: TeamRoster | undefined,
): readonly PaperoDefinition[] {
  const agentsById = new Map(
    roster?.agents
      .filter((agent) => agent.source === "builtin" && agent.deletedAt === null)
      .map((agent) => [agent.id, agent]),
  );

  return listComposerPaperi().map((definition) => {
    const agent = agentsById.get(definition.id);
    if (!agent) return definition;
    return {
      ...definition,
      label: agent.name,
      role: agent.role,
      avatar: agent.avatar,
      purpose: agent.purpose,
      instructions: agent.instructions,
    };
  });
}
