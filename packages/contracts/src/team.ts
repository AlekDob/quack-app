import { Schema } from "effect";

import { ModelSelection } from "./orchestration";
import { ProjectId, TrimmedNonEmptyString } from "./baseSchemas";

export const TEAM_MAX_NAME_LENGTH = 48;
export const TEAM_MAX_ROLE_LENGTH = 120;
export const TEAM_MAX_INSTRUCTIONS_LENGTH = 20_000;

export const TeamAgentId = TrimmedNonEmptyString;
export type TeamAgentId = typeof TeamAgentId.Type;

export const TeamScope = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("global") }),
  Schema.Struct({ kind: Schema.Literal("project"), projectId: ProjectId }),
]);
export type TeamScope = typeof TeamScope.Type;

export const TeamAgentSource = Schema.Literals(["builtin", "custom"]);
export type TeamAgentSource = typeof TeamAgentSource.Type;

export const TeamModelSlots = Schema.Record(Schema.String, ModelSelection);
export type TeamModelSlots = typeof TeamModelSlots.Type;

export const TeamAgentOverrideField = Schema.Literals([
  "name",
  "role",
  "avatar",
  "purpose",
  "instructions",
  "modelSlots",
]);
export type TeamAgentOverrideField = typeof TeamAgentOverrideField.Type;

export const TeamAgent = Schema.Struct({
  id: TeamAgentId,
  source: TeamAgentSource,
  name: TrimmedNonEmptyString.check(Schema.isMaxLength(TEAM_MAX_NAME_LENGTH)),
  role: TrimmedNonEmptyString.check(Schema.isMaxLength(TEAM_MAX_ROLE_LENGTH)),
  avatar: TrimmedNonEmptyString,
  purpose: Schema.String,
  instructions: TrimmedNonEmptyString.check(Schema.isMaxLength(TEAM_MAX_INSTRUCTIONS_LENGTH)),
  modelSlots: TeamModelSlots,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  deletedAt: Schema.NullOr(Schema.String),
  /** Present on project rosters to explain whether this agent inherits Global. */
  inheritedFromGlobal: Schema.optional(Schema.Boolean),
  /** The fields this project intentionally differs from Global on. */
  overriddenFields: Schema.optional(Schema.Array(TeamAgentOverrideField)),
});
export type TeamAgent = typeof TeamAgent.Type;

export const TeamRoster = Schema.Struct({
  scope: TeamScope,
  agents: Schema.Array(TeamAgent),
});
export type TeamRoster = typeof TeamRoster.Type;

export const TeamGetRosterInput = Schema.Struct({ scope: TeamScope });
export type TeamGetRosterInput = typeof TeamGetRosterInput.Type;

export const TeamUpsertAgentInput = Schema.Struct({
  scope: TeamScope,
  agent: TeamAgent,
});
export type TeamUpsertAgentInput = typeof TeamUpsertAgentInput.Type;

export const TeamDeleteAgentInput = Schema.Struct({
  scope: TeamScope,
  agentId: TeamAgentId,
});
export type TeamDeleteAgentInput = typeof TeamDeleteAgentInput.Type;
