import type { ProjectId, TeamAgent, TeamRoster, TeamScope } from "@synara/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

export interface TeamRepositoryShape {
  readonly getRoster: (scope: TeamScope) => Effect.Effect<TeamRoster, Error>;
  readonly upsertAgent: (scope: TeamScope, agent: TeamAgent) => Effect.Effect<TeamRoster, Error>;
  readonly deleteAgent: (scope: TeamScope, agentId: string) => Effect.Effect<TeamRoster, Error>;
  readonly deleteProjectRoster: (projectId: ProjectId) => Effect.Effect<void, Error>;
  readonly resolveAgent: (
    projectId: ProjectId | null,
    agentId: string | null | undefined,
  ) => Effect.Effect<TeamAgent, Error>;
}

export class TeamRepository extends ServiceMap.Service<TeamRepository, TeamRepositoryShape>()(
  "synara/persistence/TeamRepository",
) {}
