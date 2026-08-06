import { assert, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import type { TeamAgent, TeamScope } from "@synara/contracts";

import { runMigrations } from "../Migrations.ts";
import { TeamRepository } from "../Services/TeamRepository.ts";
import { TeamRepositoryLive } from "./TeamRepository.ts";
import { SqlitePersistenceMemory } from "./Sqlite.ts";

const layer = it.layer(TeamRepositoryLive.pipe(Layer.provideMerge(SqlitePersistenceMemory)));
const globalScope: TeamScope = { kind: "global" };
const projectScope: TeamScope = { kind: "project", projectId: "project-1" as never };

function milo(overrides: Partial<TeamAgent> = {}): TeamAgent {
  return {
    id: "builder",
    source: "builtin",
    name: "Milo",
    role: "Builder",
    avatar: "/images/ducks/duck3.jpeg",
    purpose: "Implementation",
    instructions: "Ship the change.",
    modelSlots: {},
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
    deletedAt: null,
    ...overrides,
  };
}

layer("TeamRepository", (it) => {
  it.effect("inherits Global changes while preserving explicit project overrides", () =>
    Effect.gen(function* () {
      const repository = yield* TeamRepository;
      yield* runMigrations();

      yield* repository.upsertAgent(globalScope, milo());
      const firstProjectRoster = yield* repository.getRoster(projectScope);
      const inheritedMilo = firstProjectRoster.agents.find((agent) => agent.id === "builder");
      if (!inheritedMilo) assert.fail("Expected Milo in the project roster.");
      assert.strictEqual(inheritedMilo.avatar, "/images/ducks/duck3.jpeg");
      assert.deepStrictEqual(inheritedMilo.overriddenFields, []);

      yield* repository.upsertAgent(
        projectScope,
        milo({ avatar: "/images/ducks/duck14.jpeg", updatedAt: "2026-08-06T00:01:00.000Z" }),
      );
      yield* repository.upsertAgent(
        globalScope,
        milo({
          role: "Lead Builder",
          instructions: "Use the Global instructions.",
          updatedAt: "2026-08-06T00:02:00.000Z",
        }),
      );

      const projectRoster = yield* repository.getRoster(projectScope);
      const projectMilo = projectRoster.agents.find((agent) => agent.id === "builder");
      if (!projectMilo) assert.fail("Expected Milo in the project roster.");
      assert.strictEqual(projectMilo.avatar, "/images/ducks/duck14.jpeg");
      assert.strictEqual(projectMilo.role, "Lead Builder");
      assert.strictEqual(projectMilo.instructions, "Use the Global instructions.");
      assert.isTrue(projectMilo.inheritedFromGlobal === true);
      assert.deepStrictEqual(projectMilo.overriddenFields, ["avatar"]);
    }),
  );
});
