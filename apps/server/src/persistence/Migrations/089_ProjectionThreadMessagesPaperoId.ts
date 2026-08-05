/**
 * Adds `papero_id` to projected thread messages so the papero that opened a turn
 * survives projection: without it the read model drops the id and the transcript
 * avatar falls back to the default papero (Milo) as soon as the optimistic row
 * is reconciled with the server message.
 */
import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { columnExists } from "./schemaHelpers.ts";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  if (!(yield* columnExists(sql, "projection_thread_messages", "papero_id"))) {
    yield* sql`
      ALTER TABLE projection_thread_messages
      ADD COLUMN papero_id TEXT
    `;
  }
});
