# Quack Constitution

## Core Principles

### I. AI-First Architecture
Quack is a workspace built on top of the Claude Agent SDK. Every feature must enhance AI agent workflows. Human = architect, AI = builder. Code is 80%+ AI-generated, but always reviewed and validated by the human architect.

### II. Tauri + React Full-Stack
Frontend in React 18 + TypeScript strict + Zustand stores. Backend in Rust (Tauri v2). Node.js bridge for Claude SDK integration. No Electron, no web-only fallbacks. PWA dashboard is the exception (remote access via embedded HTTP server).

### III. Domain-Driven Organization
Features are organized by domain (Chat, Kanban, Brain, Settings, Terminal, Automation), not by tech type. Each domain owns its components, stores, and services. Shared utilities live in `src/services/` and `src/utils/`.

### IV. Code Quality Gates (NON-NEGOTIABLE)
- TypeScript strict mode, no `any`
- Functions: max 20 lines
- Files: max 300 lines
- Self-documenting names: `verbNoun`, `PascalCase`, `UPPER_SNAKE`
- Absolute imports, colocated files
- Brain breadcrumbs (`// Brain: {slug}`) for documented fixes/patterns

### V. Knowledge-Driven Development
Two-level Brain knowledge store: project (`documentation/`) + global (`~/.quack/brain/`). Every non-trivial change gets a diary entry. Gotchas, patterns, and bugs are documented with YAML frontmatter. CLAUDE.md is the compass — always reference it first.

### VI. Simplicity Over Cleverness
Start simple, YAGNI. No premature abstractions. Three similar lines > one clever abstraction. Only add complexity when the current task demands it. Avoid over-engineering, feature flags, and backwards-compatibility shims.

### VII. User Experience First
Italian-first UI. Glassmorphism design with `backdrop-blur`. Mobile-first, WCAG AA. Micro-interactions via Framer Motion. Dark theme as primary. Every technical decision must improve or maintain user experience.

## Technical Standards

### Stack
- **Frontend**: React 18, Vite, TypeScript strict, Zustand, Tailwind, Framer Motion
- **Backend**: Rust (Tauri v2), axum for embedded HTTP
- **AI Bridge**: Node.js stream-claude.js → stdout → Rust parsing
- **Data**: Local filesystem (JSONL, JSON, MD), no external database
- **Build**: npm, Tauri CLI

### Error Handling Pattern
```typescript
try { return { success: true, data }; }
catch (err) { return { success: false, error: err.message }; }
```

### Store Pattern
Zustand with devtools middleware. Singleton services. State changes are synchronous where possible, async for I/O.

## Development Workflow

### APATR-D Cycle
1. **Analyze** — Read files, search patterns, understand context
2. **Plan** — Todo list, success criteria, minimum viable solution
3. **Act** — Implement one thing at a time, delegate to droids when needed
4. **Test** — Smart testing (complex logic, regressions), not exhaustive
5. **Review** — Project patterns, no regressions, TypeScript strict, size limits
6. **Document** — Diary entry, Brain entries for discoveries, CLAUDE.md updates

### Delegation Decision
- **Single Agent**: <= 3 files, interconnected logic
- **Subagent**: one domain, clear deliverable
- **Team**: > 1 domain, non-overlapping files, > 15 min per subtask

### Spec-Kit Integration
All non-trivial features follow the 7-phase Spec-Kit workflow: Constitution → Specify → Clarify → Plan → Tasks → Analyze → Implement. Specs live in `.specify/specs/NNN-feature-name/`.

## Governance

- This constitution governs all development decisions in Quack
- Amendments require documentation and explicit approval from the project architect (Alek)
- All feature specs must verify alignment with these principles
- When principles conflict, priority order: Code Quality > User Experience > Simplicity > AI-First

**Version**: 1.0.0 | **Ratified**: 2026-02-27 | **Last Amended**: 2026-02-27
