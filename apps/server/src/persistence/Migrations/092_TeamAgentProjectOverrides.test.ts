import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

it.effect("marks existing project Team rows as full overrides", () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* runMigrations({ toMigrationInclusive: 91 });
    yield* sql`
      INSERT INTO team_agents (
        scope_key, project_id, agent_id, source, name, role, avatar, purpose,
        instructions, model_slots_json, created_at, updated_at, deleted_at
      ) VALUES (
        'project:project-1', 'project-1', 'builder', 'builtin', 'Milo', 'Builder',
        '/images/ducks/duck14.jpeg', 'Implementation', 'Project instructions.', '{}',
        '2026-08-06T00:00:00.000Z', '2026-08-06T00:00:00.000Z', NULL
      )
    `;

    yield* runMigrations({ toMigrationInclusive: 92 });
    const rows = yield* sql<{ readonly overriddenFieldsJson: string }>`
      SELECT overridden_fields_json AS "overriddenFieldsJson"
      FROM team_agents
      WHERE scope_key = 'project:project-1' AND agent_id = 'builder'
    `;

    assert.strictEqual(
      rows[0]?.overriddenFieldsJson,
      '["name","role","avatar","purpose","instructions","modelSlots"]',
    );
  }).pipe(Effect.provide(NodeSqliteClient.layerMemory())),
);
