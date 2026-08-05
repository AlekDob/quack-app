import type {
  ModelSelection,
  ProjectId,
  TeamAgent,
  TeamRoster,
  TeamScope,
} from "@synara/contracts";
import {
  DEFAULT_PAPERO_ID,
  getPaperoDefinition,
  listComposerPaperi,
  type PaperoId,
} from "@synara/shared/paperi";
import { Effect, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { TeamRepository, type TeamRepositoryShape } from "../Services/TeamRepository.ts";

const DUCK_AVATAR_PATTERN = /^\/images\/ducks\/(?:jack|duck(?:[1-9]|[12][0-9]|3[0-5]))\.jpeg$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BUILTIN_IDS = new Set(listComposerPaperi().map((agent) => agent.id));

type TeamAgentRow = {
  readonly scopeKey: string;
  readonly projectId: string | null;
  readonly agentId: string;
  readonly source: "builtin" | "custom";
  readonly name: string;
  readonly role: string;
  readonly avatar: string;
  readonly purpose: string;
  readonly instructions: string;
  readonly modelSlotsJson: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
};

function scopeKey(scope: TeamScope): string {
  return scope.kind === "global" ? "global" : `project:${scope.projectId}`;
}

function scopeProjectId(scope: TeamScope): string | null {
  return scope.kind === "project" ? scope.projectId : null;
}

function baseAgent(id: PaperoId): TeamAgent {
  const definition = getPaperoDefinition(id);
  return {
    id: definition.id,
    source: "builtin",
    name: definition.label,
    role: definition.role,
    avatar: definition.avatar,
    purpose: definition.purpose,
    instructions: definition.instructions,
    modelSlots: {},
    createdAt: "",
    updatedAt: "",
    deletedAt: null,
  };
}

function parseModelSlots(value: string): Record<string, ModelSelection> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, ModelSelection>)
      : {};
  } catch {
    return {};
  }
}

function toAgent(row: TeamAgentRow): TeamAgent {
  return {
    id: row.agentId,
    source: row.source,
    name: row.name,
    role: row.role,
    avatar: row.avatar,
    purpose: row.purpose,
    instructions: row.instructions,
    modelSlots: parseModelSlots(row.modelSlotsJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

function assertAgent(agent: TeamAgent): void {
  if (!agent.name.trim()) {
    throw new Error("An agent name is required.");
  }
  if (!DUCK_AVATAR_PATTERN.test(agent.avatar)) {
    throw new Error("Choose an avatar from Quack's duck gallery.");
  }
  if (agent.source === "builtin" && !BUILTIN_IDS.has(agent.id as never)) {
    throw new Error("Unknown built-in agent.");
  }
  if (agent.source === "custom" && BUILTIN_IDS.has(agent.id as never)) {
    throw new Error("A custom agent cannot use a built-in id.");
  }
  if (agent.source === "custom" && !UUID_PATTERN.test(agent.id)) {
    throw new Error("Custom agent ids must be UUIDs.");
  }
  if (agent.source === "custom" && !agent.instructions.trim()) {
    throw new Error("Custom agent instructions are required.");
  }
}

const makeTeamRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const rowsForScope = (scope: TeamScope) =>
    sql<TeamAgentRow>`
      SELECT
        scope_key AS "scopeKey", project_id AS "projectId", agent_id AS "agentId", source,
        name, role, avatar, purpose, instructions, model_slots_json AS "modelSlotsJson",
        created_at AS "createdAt", updated_at AS "updatedAt", deleted_at AS "deletedAt"
      FROM team_agents
      WHERE scope_key = ${scopeKey(scope)}
      ORDER BY created_at ASC, agent_id ASC
    `;

  const getRoster: TeamRepositoryShape["getRoster"] = (scope) =>
    rowsForScope(scope).pipe(
      Effect.mapError((cause) => new Error(`Could not load Team: ${String(cause)}`)),
      Effect.map((rows) => {
        const persisted = rows.map(toAgent);
        const overrides = new Map(
          persisted.filter((agent) => agent.source === "builtin").map((agent) => [agent.id, agent]),
        );
        const builtins = listComposerPaperi().map(
          (definition) => overrides.get(definition.id) ?? baseAgent(definition.id),
        );
        const custom = persisted.filter((agent) => agent.source === "custom");
        return { scope, agents: [...builtins, ...custom] } satisfies TeamRoster;
      }),
    );

  const upsertAgent: TeamRepositoryShape["upsertAgent"] = (scope, agent) =>
    Effect.try({
      try: () => assertAgent(agent),
      catch: (cause) => (cause instanceof Error ? cause : new Error("Invalid Team agent.")),
    }).pipe(
      Effect.andThen(() =>
        rowsForScope(scope).pipe(
          Effect.mapError((cause) => new Error(`Could not validate Team: ${String(cause)}`)),
          Effect.flatMap((rows) => {
            const duplicate = rows.some(
              (row) =>
                row.agentId !== agent.id &&
                row.deletedAt === null &&
                row.name.localeCompare(agent.name, undefined, { sensitivity: "accent" }) === 0,
            );
            if (duplicate) return Effect.fail(new Error("An agent with this name already exists."));
            return sql`
              INSERT INTO team_agents (
                scope_key, project_id, agent_id, source, name, role, avatar, purpose,
                instructions, model_slots_json, created_at, updated_at, deleted_at
              ) VALUES (
                ${scopeKey(scope)}, ${scopeProjectId(scope)}, ${agent.id}, ${agent.source},
                ${agent.name}, ${agent.role}, ${agent.avatar}, ${agent.purpose},
                ${agent.instructions}, ${JSON.stringify(agent.modelSlots)}, ${agent.createdAt},
                ${agent.updatedAt}, ${agent.deletedAt}
              )
              ON CONFLICT(scope_key, agent_id) DO UPDATE SET
                source = excluded.source, name = excluded.name, role = excluded.role,
                avatar = excluded.avatar, purpose = excluded.purpose,
                instructions = excluded.instructions, model_slots_json = excluded.model_slots_json,
                updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
            `.pipe(Effect.mapError((cause) => new Error(`Could not save Team: ${String(cause)}`)));
          }),
        ),
      ),
      Effect.andThen(() => getRoster(scope)),
    );

  const deleteAgent: TeamRepositoryShape["deleteAgent"] = (scope, agentId) => {
    if (BUILTIN_IDS.has(agentId as never))
      return Effect.fail(new Error("Built-in agents cannot be deleted."));
    const now = new Date().toISOString();
    return sql`
      UPDATE team_agents
      SET deleted_at = ${now}, updated_at = ${now}
      WHERE scope_key = ${scopeKey(scope)} AND agent_id = ${agentId} AND source = 'custom'
    `.pipe(
      Effect.mapError((cause) => new Error(`Could not delete Team agent: ${String(cause)}`)),
      Effect.andThen(() => getRoster(scope)),
    );
  };

  const deleteProjectRoster: TeamRepositoryShape["deleteProjectRoster"] = (projectId) =>
    sql`DELETE FROM team_agents WHERE project_id = ${projectId}`.pipe(
      Effect.mapError(
        (cause) => new Error(`Could not delete Team project roster: ${String(cause)}`),
      ),
      Effect.asVoid,
    );

  const resolveAgent: TeamRepositoryShape["resolveAgent"] = (projectId, agentId) => {
    const scope: TeamScope = projectId ? { kind: "project", projectId } : { kind: "global" };
    return getRoster(scope).pipe(
      Effect.map(
        (roster) =>
          roster.agents.find((agent) => agent.id === agentId && agent.deletedAt === null) ??
          roster.agents.find((agent) => agent.id === DEFAULT_PAPERO_ID) ??
          baseAgent(DEFAULT_PAPERO_ID),
      ),
    );
  };

  return {
    getRoster,
    upsertAgent,
    deleteAgent,
    deleteProjectRoster,
    resolveAgent,
  } satisfies TeamRepositoryShape;
});

export const TeamRepositoryLive = Layer.effect(TeamRepository, makeTeamRepository);
