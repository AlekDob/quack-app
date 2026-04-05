---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-04-04
last_verified: 2026-04-04
tags: [marketplace, store, plugins, skills, commands, agents, rules, mcp, hooks, install, github]
---

## Quack Store (Marketplace)
**Purpose:** Centralized marketplace to discover, install, update, and uninstall Claude Code resources (skills, commands, agents/droids, rules, MCP servers, hooks, agent-bundles) from a curated GitHub repository. Supports global and project-scoped installation with version tracking.
**Stack:** Tauri v2 (Rust backend), React 18, TypeScript strict, GitHub Raw API

### Architecture Overview

The Store fetches a `marketplace.json` manifest from a GitHub repo, then dynamically resolves each plugin's `plugin.json` to build the resource catalog. Resources are markdown files downloaded directly to `~/.claude/` (global) or `{project}/.claude/` (project scope). Agent-bundles are special composite resources that install multiple skills + rules and create a terminal agent in the sidebar.

**Data flow:**
```
GitHub repo (marketplace.json) → plugin.json per plugin → resource catalog (React state)
User clicks "Get" → fetch .md from GitHub Raw → write to ~/.claude/{type}/ via Tauri invoke
Agent-bundles → project picker → installBundleSkills + create terminal in sidebar
```

### Resource Categories
| Category | Install Target | Install Function | Notes |
|----------|---------------|-----------------|-------|
| skills | `~/.claude/skills/{name}/SKILL.md` | `installResource` → `downloadSkillDirectory` | Downloads full directory (scripts, assets) |
| commands | `~/.claude/commands/{name}.md` | `installResource` | Single .md file |
| agents | `~/.claude/agents/{name}.md` | `installResource` | Single .md droid file |
| droids | `~/.claude/agents/{name}.md` | `installResource` | Distinguished from agents by name pattern |
| rules | `~/.claude/rules/{name}.md` | `installResource` | Single .md file |
| mcp | `~/.mcp.json` (mcpServers entry) | `installResource` | JSON config merge, also installs bundled rules |
| agent-bundles | Terminal + skills + rules | `installBundleSkills` + `onAgentBundleInstalled` | Composite: project picker required |
| hooks | `~/.claude/hooks/` | (planned) | Not yet fully implemented |

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Hook | src/hooks/useMarketplace.ts | `useMarketplace` — core hook: loadResources, installResource, uninstallResource, installAgentBundle, installBundleSkills, checkInstalledResources, version registry |
| Hook | src/hooks/useBundleOperations.ts | `useBundleOperations` — export/import .quack bundles (ZIP), reads real files from disk |
| Component | src/components/QuackStoreDrawer.tsx | Main store drawer: install flow, scope toggle, agent-bundle project picker routing |
| Component | src/components/QuackStoreDrawer.css | Store drawer styles |
| Component | src/components/store/StoreSidebar.tsx | Category navigation sidebar (Discover, Skills, Commands, Agents, etc.) |
| Component | src/components/store/StoreMainContent.tsx | Grid layout for resource cards, search, featured section |
| Component | src/components/store/StoreHeroBanner.tsx | Featured resource hero banner |
| Component | src/components/store/StoreFeaturedCard.tsx | Featured resource card component |
| Component | src/components/store/StoreItemCard.tsx | Individual resource card with Get/Installed badge |
| Component | src/components/store/StoreEmptyState.tsx | Empty state when no resources match filters |
| Component | src/components/store/StoreIcons.tsx | Category-specific icons |
| Component | src/components/store/StoreProjectPickerModal.tsx | Project selection modal for agent-bundle installs |
| Component | src/components/store/storeConstants.ts | Constants (colors, labels, category config) |
| Component | src/components/MarketplaceDrawer.tsx | Resource detail drawer (description, tags, scope toggle, Install button) |
| Component | src/components/MarketplaceCard.tsx | Legacy marketplace card |
| Component | src/components/MarketplaceInstallModal.tsx | Legacy install modal |
| Types | src/types.ts | MarketplaceResource, MarketplaceCategory, MarketplaceFilters, MarketplaceLibrary, PluginJson, AgentTemplate |

### Known Bugs (Active)
1. **Windows path separators in `downloadSkillDirectory`** — `useMarketplace.ts:86,104,117` use hardcoded `/` instead of `join()`. Breaks skill installation on Windows. See `documentation/bugs/bug-marketplace-install-windows-path-separators.md`
2. **Windows path separators in `useBundleOperations.ts`** — `getHome()` adds `/` manually, 12+ path constructions use template literals. Breaks bundle import on Windows.
3. **Commands/Rules fail on Windows** — Marco (Win11 Pro) reports "Failed to install" for non-agent resources. `installResource()` uses `join()` correctly, so root cause may be different (needs console logs to diagnose).

### Version Registry
Installed resources are tracked in `~/.quack/marketplace-registry.json` with version info. On load, `checkInstalledResources()` checks registry first (fast), then falls back to filesystem detection for pre-registry installs.

### Key Patterns
- **GitHub Raw API**: `https://raw.githubusercontent.com/{org}/{repo}/main/{path}` with cache-busting query param
- **Skill directories**: Downloaded recursively via GitHub Contents API, with fallback to single SKILL.md download
- **Agent-bundle routing**: `QuackStoreDrawer` detects `category === 'agent-bundles'` and routes to project picker instead of direct install
- **Scope toggle**: Global (`~/.claude/`) vs Project (`{project}/.claude/`) — only global for agent-bundles

### Cross-Platform Notes
- ALL path construction MUST use `join()` from `@tauri-apps/api/path` — never template literals with `/`
- `homeDir()` returns OS-native separators (`/` on macOS, `\` on Windows)
- `write_file_content` (Rust) does NOT create parent dirs — always call `create_directory` first
- `write_binary_file` (Rust) DOES create parent dirs via `create_dir_all`
