import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE TABLE IF NOT EXISTS team_agents (
      scope_key TEXT NOT NULL,
      project_id TEXT,
      agent_id TEXT NOT NULL,
      source TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      avatar TEXT NOT NULL,
      purpose TEXT NOT NULL,
      instructions TEXT NOT NULL,
      model_slots_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT,
      PRIMARY KEY (scope_key, agent_id)
    )
  `;
  yield* sql`
    CREATE INDEX IF NOT EXISTS team_agents_project_id_idx
    ON team_agents(project_id)
  `;
});
