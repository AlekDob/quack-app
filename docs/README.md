# 📚 Quack Documentation Hub

**All project documentation is organized here.** Use `grep` or search to find specific topics.

---

## 📖 Quick Navigation

| Category | Location | Description |
|----------|----------|-------------|
| 🏗️ **Architecture** | `01-architecture.md` | Complete system architecture |
| 🐛 **Bug Fixes** | `02-bug-fixes/` | Bug analysis & solutions |
| 🧪 **Testing** | `03-testing/` | Test results & verification |
| 🔧 **Build & Setup** | `04-build-setup/` | Build issues & SDK setup |
| ✨ **Features** | `05-features/` | Feature implementations |
| 🎨 **Design** | `06-design/` | UI/UX design docs |
| 📦 **Archive** | `07-archive/` | Deprecated/old docs |
| 🚀 **Optimizations** | `08-optimizations/` | **NEW!** Performance & refactoring tracking |

---

## 🏗️ Architecture

**Main File**: `01-architecture.md`

**Topics Covered**:
- Application structure & component hierarchy
- Terminal system (xterm.js, PTY, sessions)
- Git integration (status, commits, branches)
- AI assistant (Claude Agent SDK integration)
- File explorer & Monaco editor
- State management (Zustand, Context)
- MCP servers & plugin system
- **Documentation System** - Integrated docs center architecture

**Quick Links**:
- [Documentation System Architecture](01-architecture.md#documentation-system) - Complete docs center architecture
- [Content Structure](01-architecture.md#content-structure) - How docs are organized
- [Custom Markdown Components](01-architecture.md#custom-markdown-components) - Markdown extensions
- [App.tsx Integration](01-architecture.md#apptsx-integration) - How docs integrate with tab system

**When to Update**: Any architectural changes, new major features, system design modifications

---

## 🐛 Bug Fixes (`02-bug-fixes/`)

### Active Fixes
- **`MESSAGE_DUPLICATION_FIX.md`** ✅ - Message duplication bug (RESOLVED)
  - Root cause: Session key instability
  - Solution: Content-based event IDs + stable session keys
  - Tests: 37 passing tests in `src/tests/`

- **`GLOBAL_SKILLS_VISIBILITY_FIX.md`** ✅ - Global skills not visible in projects without local skills (RESOLVED)
  - Root cause: Early return prevented backend call
  - Solution: Always call list_skills regardless of directory existence
  - Tests: 9 passing tests in `src/tests/skills.globalVisibility.test.ts`

- **`rust-send-trait-fix.md`** ✅ - Rust Send trait violation in MCP process manager (RESOLVED)
  - Root cause: MutexGuard held across .await boundary
  - Solution: Extract Child from mutex before awaiting
  - Tests: 40 passing tests (18 process lifecycle + 22 auto-start)

- **`mcp-auto-start.md`** ✅ - MCP servers auto-start implementation (COMPLETED)
  - Feature: Automatic stdio server spawning when loading .mcp.json
  - Implementation: Process lifecycle management with proper mutex handling
  - Tests: 22 passing tests in `src/tests/mcp.autostart.test.ts`

- **`03-mcp-integration-fix.md`** ✅ - MCP integration compilation errors (RESOLVED)
  - Root cause: Missing Emitter trait import + string type mismatches
  - Solution: Added trait import, fixed string conversions in mcp.rs
  - Environment: Created dev.sh script for proper PATH setup (Node + Cargo)

- **`AVATAR_IMAGES_FIX.md`** - Avatar image loading fixes

### How to Add New Bug Fix Docs
1. Create: `02-bug-fixes/BUG_NAME_FIX.md`
2. Include: Problem, Root Cause, Solution, Tests, Verification
3. Update this README with a summary

---

## 🧪 Testing (`03-testing/`)

**We use Vitest** for all testing - fast, modern, integrated with Vite.

### Test Documentation
- **`TEST_RESULTS.md`** - Latest test suite results (37/37 passing ✅)
- **`VERIFICATION_GUIDE.md`** - Manual testing procedures
- **`TEST_MODE.md`** - Test mode setup & usage
- **`PROJECT_TERMINAL_RENAME_TESTS.md`** - Terminal rename functionality tests (27 tests ✅)

### Test Commands
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:ui       # Interactive UI
npm run test:coverage # Coverage report
```

### Test Structure
- **Unit tests**: `src/**/*.test.ts` - Test individual functions/components
- **Integration tests**: `src/tests/integration.*.test.ts` - Test complete flows
- **Performance tests**: Included in integration tests (benchmarks)

### Current Test Coverage
- ✅ Event deduplication (17 tests)
- ✅ Session key stability (9 tests)
- ✅ Integration scenarios (11 tests)
- ✅ Global skills visibility (9 tests)
- ✅ Terminal storage (17 tests)
- ✅ Terminal utils (40 tests)
- ✅ Agent chat storage (13 tests)
- ✅ MCP auto-start (22 tests)
- ✅ MCP process lifecycle (18 tests)
- ✅ Project terminal rename (27 tests)
- **Total**: 183 tests, all passing

---

## 🔧 Build & Setup (`04-build-setup/`)

### SDK & Build Issues
- **`CLAUDE_SDK_BUILD_FIX.md`** - Claude SDK build issues & solutions
- **`claude-sdk-integration.md`** - SDK integration guide
- **`CLAUDE_CODE_AUTH_FIX.md`** - Authentication fixes

### Common Build Issues
1. **Node SDK not found**: Run `npm run prepare-node-sdk`
2. **Tauri build fails**: Check Rust version (1.77.2+)
3. **SDK stream errors**: See `MESSAGE_DUPLICATION_FIX.md`

---

## ✨ Features (`05-features/`)

### Implemented Features
- **`background-tasks.md`** ✅ **NEW!** - Background task system (non-blocking command/agent execution)
- **`CLAUDE_SDK_054.md`** ✅ - Claude Agent SDK 0.1.54 features (effort, thinking, droids)
- **`MCP_CONFIGURATION.md`** ✅ - Model Context Protocol setup & configuration guide
- **`MCP_DYNAMIC_LOADING.md`** - Dynamic MCP server loading
- **`MCP_TEMPLATE_IMPLEMENTATION.md`** - MCP template system
- **`PERFORMANCE_OPTIMIZATIONS.md`** - Performance improvements
- **`PLUGIN_MARKETPLACE_IMPLEMENTATION.md`** - Plugin marketplace system
- **`token-counter-implementation.md`** - Token usage tracking

### Feature Documentation Template
```markdown
# Feature Name

## Problem
<what problem does this solve>

## Solution
<how it works>

## Implementation
<code changes, files modified>

## Testing
<how to test, expected behavior>

## Performance
<performance impact, benchmarks>
```

---

## 🎨 Design (`06-design/`)

### Design System
- **`metro-design-implementation.md`** - Metro design system
- **`metro-design-visual-guide.md`** - Visual guidelines
- **`metro-style-fixes.md`** - Style fixes
- **`metro-style-implementation.md`** - Style implementation

### Design Principles
- Metro/Modern UI inspired
- Glassmorphism effects
- Dark theme first
- Responsive layouts

---

## 📦 Archive (`07-archive/`)

**Deprecated or outdated documentation** - kept for reference only.

Contents:
- Gumroad migration docs (replaced by new licensing system)
- Legacy schemas
- Initial project requirements

**Note**: Archive docs may not reflect current implementation.
**Moved to Optimizations**: `analysis-report.md` → `08-optimizations/00-analysis/`

---

## 🚀 Optimizations (`08-optimizations/`) **NEW!**

**Comprehensive tracking system for all optimization work** based on the technical analysis report.

### Structure

- **`00-analysis/`** - Original comprehensive analysis (1780 lines)
  - `analysis-report.md` - Full technical audit
  - Test coverage gaps (0% → 80% target)
  - Architectural violations (App.tsx 7,293 lines)
  - Performance issues (bundle size, duplication)
  - 3-week action plan

- **`01-completed/`** ✅ - Finished optimizations
  - `message-duplication-fix.md` - Event deduplication (DONE ✅)

- **`02-in-progress/`** 🔄 - Currently working on
  - Currently empty - ready for next task!

- **`03-priority-0-critical/`** 🔴 - Must fix for production
  - `app-tsx-refactoring.md` - Reduce 7,293 → <300 lines (3 weeks)
  - `remove-monaco-editor.md` - Remove duplicated editor (-350KB) ⚡ 1h
  - `test-coverage-expansion.md` - Reach 80% coverage
  - `chatinput-refactoring.md` - Reduce 1,540 → <400 lines
  - `repository-group-refactoring.md` - Reduce 1,643 → <300 lines

- **`04-priority-1-high/`** 🟡 - Significant impact
  - `lazy-loading-components.md` - Lazy load heavy components (-560KB)
  - `logger-replacement.md` - Replace 1,125 console.log statements
  - `tree-shaking-optimization.md` - Optimize imports (-40KB) ⚡ 45min
  - Test suites for chat, terminal, git modules

- **`05-priority-2-medium/`** 🟠 - Quality improvements
  - `vite-config-optimization.md` - Advanced build optimizations
  - `bundle-analysis.md` - Comprehensive metrics
  - `delete-old-files.md` - Remove deprecated files ⚡ 5min
  - ESLint audit, TypeScript `any` elimination, CI/CD

### Quick Wins ⚡

High-impact, low-effort tasks:

| Task | Effort | Impact | Savings |
|------|--------|--------|---------|
| Remove Monaco Editor | 1h | 🔥🔥🔥 | -350KB |
| Delete old files | 5min | 🔥 | -791 lines |
| Tree-shake Lucide | 45min | 🔥 | -40KB |

**Total**: ~2 hours for -390KB + better organization!

### Progress Dashboard

| Priority | Total | Done | In Progress | Pending | % |
|----------|-------|------|-------------|---------|---|
| P0 🔴 | 7 | 1 | 0 | 6 | 14% |
| P1 🟡 | 8 | 0 | 0 | 8 | 0% |
| P2 🟠 | 6 | 0 | 0 | 6 | 0% |
| **TOTAL** | **21** | **1** | **0** | **20** | **5%** |

### Usage

```bash
# View all optimization tasks
ls docs/08-optimizations/

# Find P0 critical tasks
ls docs/08-optimizations/03-priority-0-critical/

# Check completed work
ls docs/08-optimizations/01-completed/

# Search for specific optimization
grep -r "monaco" docs/08-optimizations/

# View dashboard
cat docs/08-optimizations/README.md
```

**When to Update**: After completing any optimization task, update dashboard and move task file to `01-completed/`

---

## 🔍 How to Find Information

### By Topic (grep examples)
```bash
# Find all mentions of "event deduplication"
grep -r "event deduplication" docs/

# Find bug fixes
ls docs/02-bug-fixes/

# Find test-related docs
grep -r "vitest\|test" docs/

# Find architecture info about terminals
grep -r "terminal" docs/01-architecture.md
```

### By File Type
```bash
# All markdown docs
find docs/ -name "*.md"

# Bug fixes only
ls docs/02-bug-fixes/

# Testing docs only
ls docs/03-testing/
```

### By Date (recent changes)
```bash
# Files modified in last 7 days
find docs/ -mtime -7 -name "*.md"
```

---

## 📝 Documentation Standards

### File Naming Convention
- Use **descriptive names**: `MESSAGE_DUPLICATION_FIX.md` not `fix.md`
- Use **UPPERCASE** for major docs: `README.md`, `FIX.md`
- Use **lowercase** for component docs: `architecture.md`
- Include **date** for time-sensitive docs: `2025-01-16-release-notes.md`

### Document Structure
1. **Title** (# heading)
2. **Problem/Context** (what & why)
3. **Solution/Implementation** (how)
4. **Testing/Verification** (proof)
5. **Examples/Screenshots** (visuals)
6. **References/Links** (related docs)

### When to Create New Docs
- ✅ New features (major functionality)
- ✅ Bug fixes (with root cause analysis)
- ✅ Architecture changes
- ✅ Performance optimizations
- ❌ Minor code cleanup (use git commit messages)
- ❌ Config changes (unless complex)

### When to Update Existing Docs
- `01-architecture.md` - Any architectural changes
- `02-bug-fixes/` - When fixing bugs
- `03-testing/` - After adding/updating tests
- `README.md` (this file) - When adding new doc categories

---

## 🎯 Document Categories Explained

### 01 - Architecture
**Purpose**: Single source of truth for system design
**Audience**: New developers, complex debugging
**Update Frequency**: Every major feature/refactor

### 02 - Bug Fixes
**Purpose**: Root cause analysis & solutions
**Audience**: Developers debugging similar issues
**Update Frequency**: Each significant bug fix

### 03 - Testing
**Purpose**: Test documentation & verification procedures
**Audience**: QA, developers writing tests
**Update Frequency**: After test suite changes

### 04 - Build & Setup
**Purpose**: Resolve build/setup issues
**Audience**: New developers, CI/CD
**Update Frequency**: When build process changes

### 05 - Features
**Purpose**: Feature implementation details
**Audience**: Developers extending features
**Update Frequency**: Each new feature

### 06 - Design
**Purpose**: UI/UX design guidelines
**Audience**: Frontend developers, designers
**Update Frequency**: Design system updates

### 07 - Archive
**Purpose**: Historical reference
**Audience**: Rare (legacy context)
**Update Frequency**: Never (read-only)

### 08 - Optimizations **NEW!**
**Purpose**: Track performance & refactoring work from analysis report
**Audience**: Developers working on optimizations, project managers
**Update Frequency**: After each optimization task completion
**Structure**: Organized by priority (P0/P1/P2) and status (pending/in-progress/completed)

---

## 🚀 Quick Start for New Contributors

1. **Read first**: `01-architecture.md` - Understand the system
2. **Set up testing**: `03-testing/TEST_MODE.md` - Run tests
3. **Check recent fixes**: `02-bug-fixes/` - Known issues
4. **Review build setup**: `04-build-setup/` - Resolve build errors
5. **View optimizations**: `08-optimizations/README.md` - See improvement roadmap

---

## 📊 Documentation Health

**Last Updated**: 2025-11-28
**Total Docs**: 37+ files
**Test Coverage**: 183 tests passing ✅
**Active Categories**: 7 (merged MCP docs into features)
**Latest Addition**: Project terminal rename tests (27 tests)
**Optimization Tasks**: 21 identified (1 completed, 20 pending)
**Deprecated Docs**: 8 (in archive)

---

**Need help?** Search docs with `grep -r "your-topic" docs/` or check the category folders above!
