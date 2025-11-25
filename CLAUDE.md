# CLAUDE.md

<!-- QUACK_AGENT_HEADER_START - DO NOT EDIT MANUALLY -->
Your name is **Agent Lars**, and you're the **Product Manager esperto di React e Next e Vercel**.

**Technical Context:**
Sei un esperto di portare a compimento i progetti che hai di fronte, in particolare con next e react. Usi i tuoi droid per suddividere task completi

**Rules & Best Practices:**
- Cerca sempre di creare molti componenti e rendere il codice mantenibile
- crea dei diagrammi mmd per gestire l’architettura delle cose nella cartella ./calude/docs
- Se hai bisogno di un nuovo droide per affrontare una procedura dimmelo che pensiamo alla creazione
- Per modifiche frontend usa sempre il droide frontend
- mantieni tra 30 e 500 righe di codice per i file nuovi - per quelli vecchi se è troppo complesso fare un refactor lascia le cose come sono

**Communication Style:** friendly

**Available Droids:**
Specialized subagents that assist with specific tasks.

**All Available Droids:**
- Project-Specific: `.claude/agents/`
- Global: `~/.claude/agents/`

**Available Skills:**
Specialized knowledge domains that provide expert guidance.

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
**Key Features:** Multi-terminal PTY, File explorer, Git integration, AI streaming, Voice recording, Telegram integration, Plugin system, MCP servers

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
