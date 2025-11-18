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

**When to Update**: Any architectural changes, new major features, system design modifications

---

## 🐛 Bug Fixes (`02-bug-fixes/`)

### Active Fixes
- **`MESSAGE_DUPLICATION_FIX.md`** ✅ - Message duplication bug (RESOLVED)
  - Root cause: Session key instability
  - Solution: Content-based event IDs + stable session keys
  - Tests: 37 passing tests in `src/tests/`

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
- **Total**: 37 tests, all passing

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
- Old analysis reports
- Legacy schemas
- Initial project requirements

**Note**: Archive docs may not reflect current implementation.

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

---

## 🚀 Quick Start for New Contributors

1. **Read first**: `01-architecture.md` - Understand the system
2. **Set up testing**: `03-testing/TEST_MODE.md` - Run tests
3. **Check recent fixes**: `02-bug-fixes/` - Known issues
4. **Review build setup**: `04-build-setup/` - Resolve build errors

---

## 📊 Documentation Health

**Last Updated**: 2025-01-16
**Total Docs**: 26+ files
**Test Coverage**: 37 tests passing ✅
**Active Categories**: 7
**Deprecated Docs**: 9 (in archive)

---

**Need help?** Search docs with `grep -r "your-topic" docs/` or check the category folders above!
