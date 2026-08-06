import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    ALTER TABLE team_agents
    ADD COLUMN overridden_fields_json TEXT NOT NULL DEFAULT '[]'
  `;
  // Before project inheritance, saving an agent copied every field into the
  // project row. Preserve that behavior as an explicit full override.
  yield* sql`
    UPDATE team_agents
    SET overridden_fields_json = '["name","role","avatar","purpose","instructions","modelSlots"]'
    WHERE scope_key LIKE 'project:%'
  `;
});
