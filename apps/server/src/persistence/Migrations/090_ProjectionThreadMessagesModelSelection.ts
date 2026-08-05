/**
 * Adds `model_selection_json` to projected thread messages so the transcript can
 * show the model + effort a turn actually ran with. The thread-level selection is
 * overwritten by every later turn, so history has no other source.
 */
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { columnExists } from "./schemaHelpers.ts";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  if (!(yield* columnExists(sql, "projection_thread_messages", "model_selection_json"))) {
    yield* sql`
      ALTER TABLE projection_thread_messages
      ADD COLUMN model_selection_json TEXT
    `;
  }
});
