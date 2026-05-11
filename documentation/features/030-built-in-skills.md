---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-04-03
last_verified: 2026-05-11
tags: [skills, built-in-skills, bundled-skills, marketplace, droid-factory, whiteboard, mermaid, md-card, sdk-skills-option]
---

## Built-in Skills
**Purpose:** Discover, view, create, install, and manage Claude Code skills from global/project directories and marketplace, with semver-aware bundled skill installation on app startup.
**Stack:** Tauri v2 (Rust backend), React 18, TypeScript strict

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | src-tauri/src/skills.rs | `list_skills`, `get_skill_details`, `check_skills_directory`, `install_bundled_skills` -- Rust backend for skill discovery, detail loading, and bundled skill installation |
| Config | src-tauri/templates/skills/feature-creator.md | Bundled skill template embedded at compile time via `include_str!` |
| Config | src-tauri/templates/skills/quack-brain.md | Bundled skill template embedded at compile time via `include_str!` |
| Config | src-tauri/templates/skills/whiteboard.md | Bundled skill template — whiteboard interaction (post-its, groups, images, **md-cards with Mermaid support**, auto-organize, nested components). Current version: `1.2.0` |
| Config | src-tauri/templates/skills/quack-remote.md | Bundled skill template — Remote API control (agents, sessions, jobs, teams) |
| Config | src-tauri/src/lib.rs (line ~698) | Calls `install_bundled_skills()` during Tauri app setup |
| Model/Type | src/types.ts (SkillInfo, SkillDetails) | TypeScript interfaces mirroring Rust structs |
| Model/Type | src/components/modal-steps/types.ts (SkillMetadata) | Extended metadata for skill selection with marketplace flag |
| Model/Type | src/components/droid-factory/types.ts (SkillSpec, SKILL_TEMPLATES) | Skill creation spec and 5 preset templates |
| Component | src/components/SkillsPanel.tsx | List view of skills grouped by scope (project/global) with search, drag support |
| Component | src/components/SkillDrawer.tsx | Drawer panel showing skill details, markdown content, file tree |
| Component | src/components/SkillViewer.tsx | Tab-embedded skill viewer with SKILL.md rendering and directory browsing |
| Component | src/components/SkillSelector.tsx | Chip/tag-based skill selector for agent personality configuration |
| Component | src/components/droid-factory/SkillWizard.tsx | Form wizard for creating new skills (name, description, category, resources) |
| Component | src/components/droid-factory/SkillTemplateGallery.tsx | Gallery of 5 preset skill templates for quick creation |
| Component | src/components/chat/EquipBar.tsx | Quick-access bar inserting `@skill:name` mentions into chat prompt |
| Util | src/utils/skillsAndDroidsLoader.ts | `loadAvailableSkills`, `formatSkillsForClaudeMd` -- loads skills via Tauri, converts to SkillMetadata |
| Service | src/hooks/useMarketplace.ts | `downloadSkillDirectory` -- downloads skills from GitHub marketplace |
| Store/State | src/contexts/UIContext.tsx | `selectedSkill` state for currently viewed skill |
| Style | src/components/SkillViewer.css | Styles for tab-embedded skill viewer |
| Style | src/components/SkillSelector.css | Styles for chip-based skill selector |
| Test | src/tests/skills.globalVisibility.test.ts | Tests for global skills visibility bug fix |

### Data Flow

**Skill Discovery (startup):**
[Tauri setup] -> [install_bundled_skills()] -> [~/.claude/skills/{name}/SKILL.md] (semver check: install or update)

**Skill Listing:**
[React: loadSkills()] -> [Tauri: list_skills(workingDir)] -> [Rust: read ~/.claude/skills/ + .claude/skills/] -> [SkillInfo[]] -> [SkillsPanel / SkillSelector]

**Skill Details:**
[SkillViewer/SkillDrawer] -> [Tauri: get_skill_details(name, scope)] -> [Rust: parse SKILL.md] -> [SkillDetails] -> [MarkdownText render]

**Marketplace Install:**
[MarketplaceDrawer] -> [downloadSkillDirectory()] -> [GitHub API / raw.githubusercontent.com] -> [Tauri: write_file_content] -> [~/.claude/skills/{name}/]

**Agent Equip:**
[PersonalityBuilder: selectedSkills] -> [AgentPersonality.selectedSkills] -> [CLAUDE.md injection] -> [EquipBar: @skill:name mentions]

### Key Functions

**Rust (src-tauri/src/skills.rs):**
- `list_skills(working_dir: Option<String>) -> Vec<SkillInfo>` -- scans global + project skill directories
- `get_skill_details(name: String, working_dir: Option<String>, scope: Option<String>) -> SkillDetails` -- loads SKILL.md content
- `check_skills_directory(working_dir: Option<String>) -> bool` -- checks if .claude/skills/ exists in project
- `install_bundled_skills() -> Result<()>` -- semver-aware install/update of compile-time embedded skills
- `parse_skill_file_with_scope(path: PathBuf, scope: str) -> SkillInfo` -- extracts name/description from markdown
- `extract_version(content: str) -> Option<(u32,u32,u32)>` -- parses semver from YAML frontmatter
- `is_newer(bundled: (u32,u32,u32), local: (u32,u32,u32)) -> bool` -- version comparison

**TypeScript:**
- `loadAvailableSkills(projectPath: string) -> Promise<SkillMetadata[]>` -- wrapper around Tauri list_skills
- `formatSkillsForClaudeMd(skills: SkillMetadata[], selectedIds: string[]) -> string` -- formats for CLAUDE.md injection
- `downloadSkillDirectory(pluginSource: string, skillPath: string, targetDir: string) -> Promise<void>` -- GitHub download with fallback

### State
- `skills`: SkillInfo[] -- all discovered skills (component)
- `selectedSkill`: SkillInfo | null -- currently viewed skill (global via UIContext)
- `skillsDirectoryExists`: boolean -- whether project has .claude/skills/ (component)
- `selectedSkills`: string[] -- skills assigned to agent personality (component)
- `availableSkills`: SkillMetadata[] -- skills loaded for selector (component)

### External Dependencies
- GitHub API: `api.github.com/repos/AlekDob/quack-marketplace/contents` for marketplace skill listing
- GitHub Raw: `raw.githubusercontent.com` for downloading skill files
- `dirs::home_dir()` (Rust crate): resolve ~/.claude/skills/ path

### Bundled Skill Versions
| Skill | Current version | Notes |
|-------|-----------------|-------|
| feature-creator | see template | Auto-numbered feature doc generation |
| quack-brain | see template | Two-level Second Brain read/write/search |
| whiteboard | **1.2.0** | Bumped from 1.1.0 to document md-cards + Mermaid (2026-04-17). Semver check in `install_bundled_skills()` auto-updates users' `~/.claude/skills/whiteboard.md` on next app start. |
| quack-remote | see template | Remote API control |

### Config
- Bundled skills: `BUNDLED_SKILLS` const array in skills.rs (feature-creator, quack-brain, whiteboard, quack-remote)
- Skill file patterns: `{name}.md` (single file) or `{name}/SKILL.md` (directory skill)
- Skill scopes: `"global"` (~/.claude/skills/) and `"project"` (.claude/skills/)
- Sort order: global first, then alphabetical by name
- Skill templates: 5 presets in `SKILL_TEMPLATES` (api-client, data-processor, report-generator, workflow-automation, domain-expert)
- Skill categories: workflow, tool-integration, domain-expertise, bundled-resources

### SDK Wiring (stream-daemon.js)

Skills surfaced to Quack are loaded into the agent session via the Claude Agent SDK `skills` option (introduced v0.2.120, replaces the deprecated `'Skill'` entry in `allowedTools` as of v0.2.133):

```js
// src-tauri/node-sdk/stream-daemon.js
const options = {
  // ...
  allowedTools: resolvedAllowedTools,   // no longer includes 'Skill'
  skills: 'all',                        // string[] | 'all'
};
```

`'all'` loads every skill discovered by the SDK from its setting sources (project + user + local), matching the scopes the Rust `list_skills` already walks. To restrict, pass an array of skill names. See `pattern-sdk-version-upgrade.md` for the migration history.
