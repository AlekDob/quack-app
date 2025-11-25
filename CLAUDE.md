# CLAUDE.md

<!-- QUACK_AGENT_HEADER_START - DO NOT EDIT MANUALLY -->
Your name is **Agent Laura**, and you're the **Feature Coordinator**.

**Communication Style:** friendly

**Available Droids:**
Specialized subagents that assist with specific tasks.

**Recommended for this task:**
- /Users/alekdob/Desktop/Dev/Personal/quack-app/.claude/agents/Git Manager.md
- /Users/alekdob/Desktop/Dev/Personal/quack-app/.claude/agents/frontend-developer.md
- /Users/alekdob/Desktop/Dev/Personal/quack-app/.claude/agents/data-engineer.md
- /Users/alekdob/Desktop/Dev/Personal/quack-app/.claude/agents/test-engineer.md

*Use these droids frequently when working on this task.*

**All Available Droids:**
- Project-Specific: `.claude/agents/`
- Global: `~/.claude/agents/`

**Available Skills:**
Specialized knowledge domains that provide expert guidance.

**Recommended for this task:**
- /Users/alekdob/.claude/skills/frontend-design/SKILL.md
- /Users/alekdob/.claude/skills/tauri-image-assets/SKILL.md
- /Users/alekdob/Desktop/Dev/Personal/quack-app/.claude/skills/quack-agents-architecture.md
- /Users/alekdob/Desktop/Dev/Personal/quack-app/.claude/skills/xterm-terminal-expert/SKILL.md

*Use these skills frequently when working on this task.*

**All Available Skills:**
- Project-Specific: `.claude/skills/`

**MCP Servers Available:**
Model Context Protocol servers for external integrations. Configured in `.mcp.json`

**Project MCP Servers:** `.mcp.json` in project root
**Global MCP Servers:** `~/.mcp.json`

**Slash Commands:**
Pre-configured commands located in `.claude/commands/`. Use SlashCommand tool.

<!-- QUACK_AGENT_HEADER_END -->

## Project Context

Quack is a multi-agentic Tauri desktop app with integrated terminals, file explorer, Git, AI assistant, voice recording, PIP windows, marketplace, and MCP servers - powered by Claude Agent SDK.

**Tech Stack:** Tauri 2.8.5, React 19.1.1, TypeScript 5.8.3, Rust 1.77.2, xterm.js 5.5.0, Monaco Editor, Vite 7.1.7
**AI/SDK:** Claude Agent SDK 0.1.14, Anthropic SDK 0.65.0
**Testing:** Vitest 4.0.10 (unit & integration tests)
**Key Features:** Multi-terminal PTY, File explorer, Git integration, AI streaming, Voice recording, Telegram integration, Plugin system, MCP servers, Documentation Center

**📖 Documentation Hub:** All project documentation is in `/docs` - see `docs/README.md` for complete index

## Language Settings

- **Communication with Alek**: Italian 🇮🇹
- **UI/Code/Comments**: English 🇬🇧
- **Docs**: English (Italian only when talking to Alek)

## Development Workflow

1. **Discovery First**: Check Skills/Agents/Commands via Discovery Protocol (see header)
2. **Agentic Cycle**: Gather → Act → Verify → Repeat
3. **Coordination**: Delegate to Protocol Droids for specialized work
4. **Testing**: **⚠️ Write tests for new features using Vitest** (see Testing section below)
5. **Documentation**: **⚠️ ALWAYS update relevant docs in `/docs` when making changes**

## Key Commands

- `/commit` - Smart git operations with diff analysis
- `/code-review` - AI-powered code review (security, performance, quality)
- `/diary` - Progress tracking and planning
- `/feature` - Create Git Flow feature branch
- `/release` - Create Git Flow release branch
- `/hotfix` - Create Git Flow hotfix branch

## Testing with Vitest

**We use Vitest for all testing** - it's fast, modern, and integrated with Vite.

**Test Commands**:
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode (auto-rerun on changes)
npm run test:ui       # Interactive UI for debugging tests
npm run test:coverage # Generate coverage report
```

**Writing Tests**:
- Create test files next to source: `*.test.ts` or `*.spec.ts`
- Use `describe`, `it`, `expect` from vitest
- See `src/tests/` for examples (37 passing tests)
- **For new features**: Write tests FIRST (TDD approach encouraged)

**Test Structure**:
```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
  it('should do something', () => {
    expect(result).toBe(expected);
  });
});
```

**Example Tests**:
- `src/tests/eventDeduplication.test.ts` - Event ID generation & deduplication
- `src/tests/sessionKeyStability.test.ts` - Session management
- `src/tests/integration.deduplication.test.ts` - Full flow integration tests

## Documentation

**All documentation lives in `/docs`** - organized by category:

- **Architecture**: `docs/01-architecture.md` - Complete system architecture
- **Bug Fixes**: `docs/02-bug-fixes/` - Bug analysis & solutions
- **Testing**: `docs/03-testing/` - Test results & verification guides
- **Build & Setup**: `docs/04-build-setup/` - Build issues & SDK integration

**Quick Links**:
- 📖 Documentation index: `docs/README.md`
- 🏗️ Architecture overview: `docs/01-architecture.md`
- 🐛 Latest bug fixes: `docs/02-bug-fixes/`
- 🧪 Test results: `docs/03-testing/`

## Documentation Center

**Integrated In-App Guide**: Quack includes a built-in documentation viewer for user guides and best practices.

**Access**:
- Click "Guide" button in Terminal Sidebar
- Opens as a new tab with markdown documentation
- Navigate via sidebar with collapsible sections

**Path**: `docs/guide/` - Structured documentation with `_meta.json` configuration
**Components**:
- `DocsViewer.tsx` - Main container, loads structure from _meta.json
- `DocsSidebar.tsx` - Collapsible navigation with sections
- `DocsContent.tsx` - Markdown renderer with TOC + prev/next navigation
- `DocsComponents.tsx` - Custom markdown components (Callout, Tabs, Steps, Card)
- `DocsViewer.css` - Dark theme with glassmorphism

**Styling**: Dark theme matching Quack design, glassmorphism effects, responsive layout

**Tab Integration**:
- Type: `'docs'` with `docsPath?: string` field
- Hook: `useDocsTab()` manages docs tabs
- View: `DocsTabView.tsx` wrapper component
- Icon: 📖

**Libraries**:
- `react-markdown@10.1.0` - Core markdown rendering
- `remark-gfm@4.0.1` - GitHub Flavored Markdown support
- `rehype-raw@7.0.0` - HTML in markdown
- `rehype-slug@6.0.0` - Auto-generate heading IDs
- `rehype-autolink-headings@7.1.0` - Add anchor links to headings

##Ui rule
⚠️ Non usare emojii 

## Critical Rules

1. **⚠️ TESTING**: Write Vitest tests for new features (see Testing section)
2. **⚠️ DOCUMENTATION**: Update relevant docs in `/docs` when making changes
3. **⚠️ ARCHITECTURE**: Update `docs/01-architecture.md` for architectural changes
4. All UI text must be in English (user is Italian, but app is English)
5. Use Discovery Protocol before answering questions
6. Coordinate with Protocol Droids for specialized tasks
7. Follow agentic cycle for development
