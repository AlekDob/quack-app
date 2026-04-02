---
name: marketplace-manager
description: This skill should be used when adding, modifying, or removing plugins from the Quack Marketplace repository. Also use when creating new agent templates, adding skills to existing plugins, updating marketplace.json, researching skills.sh for relevant skills to bundle, or reviewing marketplace structure for consistency. Uses the `find-skills` skill proactively to discover skills from the open ecosystem when building agent bundles.
---

# Quack Marketplace Manager

Manage the Quack Marketplace: add plugins, create agent templates, bundle skills, modify existing entries, and maintain structural consistency.

## Repository Location

The marketplace repository is at: `/Users/alekdob/Desktop/Dev/Personal/quack-marketplace`

## Directory Structure

```
quack-marketplace/
├── .claude-plugin/
│   └── marketplace.json          # Central index of all plugins
└── plugins/
    └── {plugin-name}/
        ├── .claude-plugin/
        │   └── plugin.json       # Plugin metadata and configuration
        ├── skills/               # Optional: skill definitions
        │   └── {skill-name}/
        │       └── SKILL.md
        ├── agents/               # Optional: agent personality files
        │   └── {agent-name}.md
        └── rules/                # Optional: rule definitions
            └── {rule-name}.md
```

## Three Plugin Bundle Types

### Type 1: Agent Template (with `agentTemplate`)

For creating pre-configured agents users can spawn. Includes suggested name, role, color, avatar, and communication style.

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "One-sentence description of the agent bundle.",
  "author": { "name": "Quack Team", "url": "https://github.com/AlekDob" },
  "repository": "https://github.com/AlekDob/quack-marketplace",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2", "agent-template"],
  "skills": ["skills/skill-one", "skills/skill-two"],
  "agents": [],
  "rules": [],
  "agentTemplate": {
    "suggestedName": "Agent Name",
    "role": "Role Title",
    "communicationStyle": "technical",
    "customNotes": "Personality and expertise description for the agent prompt.",
    "suggestedColor": "#HEX",
    "suggestedAvatar": "duckN.jpeg",
    "suggestedGender": "male",
    "skills": ["skill-one", "skill-two"],
    "bundledPlugins": ["other-plugin-name"]
  }
}
```

**CRITICAL: Two different `skills` fields with different purposes:**

| Field | Location | Format | Purpose |
|-------|----------|--------|---------|
| `plugin.skills` | Top-level | `["skills/skill-name"]` (path with `skills/` prefix) | Declares which SKILL.md files this plugin **ships** (on-disk paths relative to plugin root) |
| `agentTemplate.skills` | Inside `agentTemplate` | `["skill-name"]` (name only, NO `skills/` prefix) | Sets which skills appear as **Preferred Skills** in the Create Agent UI |

**Rules:**
1. `agentTemplate.skills` MUST include ALL skills the agent should use — both from this plugin AND from `bundledPlugins`
2. `bundledPlugins` auto-installs the referenced plugin's skills, but does NOT auto-select them as preferred
3. If `agentTemplate.skills` is empty or missing, the agent will have NO preferred skills in the UI

**Example with bundled dependency:**
```json
{
  "skills": ["skills/my-skill"],
  "agentTemplate": {
    "skills": [
      "my-skill",
      "quack-brain"
    ],
    "bundledPlugins": ["quack-brain"]
  }
}
```
Here `quack-brain` plugin is auto-installed via `bundledPlugins`, and its skills (`quack-brain`) are listed in `agentTemplate.skills` so they appear pre-selected in the UI.

Available avatars: `duck1.jpeg` through `duck10.jpeg`.
Communication styles: `professional`, `technical`, `friendly`, `casual`.

### Type 2: Skills-Only Bundle

For reusable skill collections without an agent template.

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Description.",
  "author": { "name": "Quack Team", "url": "https://github.com/AlekDob" },
  "repository": "https://github.com/AlekDob/quack-marketplace",
  "license": "MIT",
  "keywords": ["keyword1"],
  "skills": ["skills/skill-one"],
  "agents": ["agents/agent-name.md"],
  "rules": []
}
```

### Type 3: Rules-Only Bundle

For workflow methodologies and background rules.

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Description.",
  "author": { "name": "Quack Team", "url": "https://github.com/AlekDob" },
  "repository": "https://github.com/AlekDob/quack-marketplace",
  "license": "MIT",
  "keywords": ["keyword1"],
  "skills": [],
  "agents": [],
  "rules": ["rules/rule-name.md"]
}
```

## SKILL.md Format

Each skill file requires YAML frontmatter with proactive trigger description:

```markdown
---
name: skill-name
description: Use this skill when [specific trigger scenarios]. Also use when [additional scenarios].
---

# Skill Title

Content with code examples, best practices, and patterns.
```

The `description` field is critical for proactive invocation. Follow the "Use this skill when..." pattern with specific trigger words that match what users naturally ask.

## Rule File Format

```markdown
---
description: "When to apply this rule"
globs: ["**/*.ts", "**/*.tsx"]
---

# Rule Title

Rule content and instructions.
```

## Agent Personality File Format

```markdown
---
name: agent-name
description: When to use this agent
model: haiku
color: cyan
---

# Agent instructions and personality
```

## Workflow: Add a New Plugin

1. **Create directory**: `plugins/{plugin-name}/.claude-plugin/`
2. **Write plugin.json** with the appropriate bundle type
3. **Create skills** in `plugins/{plugin-name}/skills/{skill-name}/SKILL.md`
4. **Update marketplace.json**: Add entry to the `plugins` array with name, source, description, version, tags
5. **Verify**: Confirm all skill paths in plugin.json match actual files on disk
6. **Commit and push**: Use conventional commit format

## Workflow: Modify an Existing Plugin

1. **Read current plugin.json** to understand the structure
2. **Make changes** to skills, rules, or agent template
3. **Bump version** if changes are significant
4. **Update marketplace.json** description/tags if they changed
5. **Commit and push**

## Workflow: Remove a Plugin

1. **Delete** the `plugins/{plugin-name}/` directory
2. **Remove** the entry from marketplace.json
3. **Check** if other plugins reference it in `bundledPlugins`
4. **Commit and push**

## Researching Skills from skills.sh

When adding skills to an agent bundle, use the `find-skills` skill to discover and evaluate existing skills from the open ecosystem:

1. **Use find-skills first**: Invoke the `find-skills` skill to search by keyword (e.g., `npx skills find react`, `npx skills find swift`)
2. Browse https://skills.sh/ for additional results and trending skills at `/trending`
3. Evaluate by:
   - **Install count**: Higher is generally better quality
   - **Publisher reputation**: Prefer official publishers (vercel-labs, anthropics, antfu, obra, avdlee, dimillian)
   - **Coverage**: Does it fill a gap in the bundle?
4. Install promising skills globally with `npx skills add <owner/repo@skill> -g -y`
5. Write custom SKILL.md files inspired by the best external skills but tailored for the Quack marketplace format

## Naming Conventions

- Plugin names: `kebab-case` (e.g., `react-nextjs-developer`)
- Skill names: `kebab-case` (e.g., `swiftui-best-practices`)
- Agent template names: "Agent {FirstName}" (e.g., `Agent Alex`)
- Tags must include `"agent-template"` for agent bundles

## Current Marketplace Inventory

Read `marketplace.json` to see the current list before adding or removing plugins to avoid duplicates and naming conflicts.

## Git Workflow

All marketplace changes must be committed and pushed to the `quack-marketplace` repository.

### Commit and Push Protocol

```bash
# 1. Navigate to the marketplace repo
cd /Users/alekdob/Desktop/Dev/Personal/quack-marketplace

# 2. Stage specific files (never use git add -A)
git add plugins/{plugin-name}/.claude-plugin/plugin.json
git add plugins/{plugin-name}/skills/{skill-name}/SKILL.md
git add .claude-plugin/marketplace.json

# 3. Commit with conventional commit format
git commit -m "feat: add {plugin-name} agent bundle with {N} skills"

# 4. Push to main
git push origin main
```

### Conventional Commit Prefixes

| Action | Prefix | Example |
|--------|--------|---------|
| New plugin | `feat:` | `feat: add swift-ios-developer agent bundle` |
| Update plugin | `feat:` | `feat: update react-nextjs-developer skills` |
| Remove plugin | `refactor:` | `refactor: remove deprecated plugin` |
| Fix JSON/typo | `fix:` | `fix: correct skill path in plugin.json` |
| Skill descriptions | `docs:` | `docs: optimize skill descriptions for proactive invocation` |

### Important Rules

- Always commit from the `quack-marketplace` repo, NOT from `quack-app`
- Stage files explicitly by path — avoid `git add .` or `git add -A`
- Push to `main` branch (no feature branches needed for marketplace)
- Verify `git status` before pushing to avoid committing unintended files

## Quality Checklist

Before committing any marketplace changes, verify:

- [ ] plugin.json has all required fields (name, version, description, author, repository, license, keywords)
- [ ] All skill paths in plugin.json match actual SKILL.md files on disk
- [ ] SKILL.md files have YAML frontmatter with `name` and `description`
- [ ] Skill descriptions use "Use this skill when..." trigger pattern
- [ ] marketplace.json entry has name, source, description, version, tags
- [ ] JSON files are valid (no trailing commas, proper quoting)
- [ ] No duplicate plugin names in marketplace.json
- [ ] Conventional commit message used
- [ ] **For Agent Templates**: `agentTemplate.skills` includes ALL preferred skills (own + bundledPlugins skills)
- [ ] **For Agent Templates**: `agentTemplate.skills` uses skill names only (NO `skills/` prefix)
