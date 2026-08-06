# Team roster

The Team screen defines which agent works on the next message.

## Scopes

There are two scopes:

- **Global Team** is the default roster.
- **Project Team** is the roster for one project.

A project starts from the Global Team. This applies to built-in agents and global custom agents.

## Inheritance

Project rows store only fields that differ from Global. The inherited fields keep following Global
changes.

The overridable fields are:

- name
- role
- avatar
- purpose
- instructions
- model slots

For example, if a project changes only Milo's avatar, a later Global change to Milo's instructions
still reaches that project. The project avatar remains local.

The project Team card shows the source of each agent:

- `Global` means the agent has no project override.
- `Overrides N` means the project overrides N fields. Hovering the badge lists them.
- `Project only` means the agent exists only in that project.

The editor explains this behavior and provides `Reset to Global` for inherited agents.

## Persistence

Project override fields are stored in `team_agents.overridden_fields_json`. Migration 092 adds this
column. Existing project rows are treated as full overrides so an upgrade does not change their
behavior unexpectedly.

The server resolves the effective roster before sending a turn. The composer reads the same roster
through the shared Team query key, so a Global save updates the picker and active project caches.

## Tests

The inheritance behavior is covered by:

- `apps/server/src/persistence/Layers/TeamRepository.test.ts`
- `apps/server/src/persistence/Migrations/092_TeamAgentProjectOverrides.test.ts`
- `apps/web/src/lib/teamRoster.test.ts`
