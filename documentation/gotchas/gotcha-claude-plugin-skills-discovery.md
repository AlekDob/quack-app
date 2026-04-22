---
type: gotcha
project: quack-app
created: 2026-04-22
last_verified: 2026-04-22
tags: [skills, plugins, claude-code, tauri-command]
---
# Claude Plugin Skills Discovery

## What

Claude Code installs plugin-bundled skills (e.g. `superpowers:brainstorming`, `superpowers:systematic-debugging`) into a **different** location than hand-authored skills. They do NOT live under `~/.claude/skills/` and will be invisible in Quack if the scanner only looks there.

## Layout

```
~/.claude/plugins/
├── installed_plugins.json          ← manifest (source of truth)
└── cache/
    └── <marketplace>/
        └── <plugin>/
            └── <version>/
                └── skills/
                    ├── <skill-a>/SKILL.md
                    └── <skill-b>/SKILL.md
```

Example on disk: `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/skills/brainstorming/SKILL.md`.

## Manifest shape

`~/.claude/plugins/installed_plugins.json`:

```json
{
  "version": 2,
  "plugins": {
    "superpowers@claude-plugins-official": [
      {
        "scope": "user",
        "installPath": "/Users/.../cache/claude-plugins-official/superpowers/5.0.7",
        "version": "5.0.7",
        "installedAt": "...",
        "lastUpdated": "...",
        "gitCommitSha": "..."
      }
    ]
  }
}
```

Key points:
- Map key is `<plugin-name>@<marketplace>`. Split on `'@'` and take the first part for the plugin name.
- Value is an **array** of install entries. The first element is the active version Claude Code is using — mirror that choice; don't enumerate multiple versions.
- `installPath` is absolute and already points at the version directory, so just append `/skills`.

## Naming convention

Surface these skills with the name format **`<plugin>:<skill>`** (e.g. `superpowers:brainstorming`). This matches what the Claude Agent SDK expects in `@skill:` mentions, so `@skill:superpowers:brainstorming` round-trips through the existing mention regex (`@skill:([^\s]+)`) and the SDK without any transform.

## Graceful degradation

The manifest may be missing (no plugins installed), malformed, or have a stale `installPath` (pointing at an uninstalled version). Always `Ok(Vec::new())` on missing file, log + continue on per-entry errors, and never let plugin-discovery failures block the global/project skill list.

## Where this is implemented

- `src-tauri/src/skills.rs` — `list_plugin_skills()` walks the manifest. `resolve_plugin_skill_path()` resolves a `plugin:skill` name back to its `SKILL.md` path for the details view.
- `src/components/SkillsPanel.tsx` — "Plugin Skills" collapsible section, renders the plugin name as a tag next to each row.
