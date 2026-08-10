// FILE: teamRoster.ts
// Purpose: Shared Team roster query identity and composer-facing built-in definitions.
// Layer: Web Team domain

import type { TeamRoster, TeamScope } from "@synara/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { ensureNativeApi } from "~/nativeApi";
import {
  getPaperoDefinition,
  listComposerPaperi,
  type PaperoDefinition,
  type PaperoId,
} from "@synara/shared/paperi";

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

/**
 * Single lookup for "who is this papero right now", backed by the Team roster.
 * Used by the composer pill and by the transcript turn identity so an agent edited
 * in Team changes in both places at once.
 */
export function paperoResolverFromRoster(
  paperi: readonly PaperoDefinition[],
): (paperoId: PaperoId) => PaperoDefinition {
  const byId = new Map(paperi.map((definition) => [definition.id, definition]));
  return (paperoId) => byId.get(paperoId) ?? getPaperoDefinition(paperoId);
}

/**
 * Writes an agent's instructions to the Team roster and returns the fresh roster
 * (null when the agent is missing). The server reads instructions from this roster
 * only, so the composer must write here too — a local-only edit would silently do nothing.
 * `instructions: null` restores the built-in text.
 */
export function useSaveTeamAgentInstructions(scope: TeamScope, roster: TeamRoster | undefined) {
  const queryClient = useQueryClient();
  return useCallback(
    async (paperoId: PaperoId, instructions: string | null): Promise<boolean> => {
      const agent = roster?.agents.find((candidate) => candidate.id === paperoId);
      if (!agent) return false;
      const next = await ensureNativeApi().team.upsertAgent({
        scope,
        agent: {
          ...agent,
          instructions: instructions ?? getPaperoDefinition(paperoId).instructions,
          updatedAt: new Date().toISOString(),
        },
      });
      queryClient.setQueryData(teamRosterQueryKey(scope), next);
      return true;
    },
    [queryClient, roster, scope],
  );
}
