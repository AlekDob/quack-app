# 🟡 Priority 1 - High Impact Tasks

**Significant impact on performance and code quality**

---

## Task List

### Performance Optimizations

1. **lazy-loading-components.md** - Lazy load heavy components
   - Effort: 4 hours
   - Impact: ~560KB first load savings
   - Components: Mermaid, Marketplace, Settings, etc.

2. **tree-shaking-optimization.md** - Optimize Lucide imports
   - Effort: 45 minutes ⚡ Quick Win
   - Impact: ~40KB savings
   - Script-based automatic migration

### Code Quality

3. **logger-replacement.md** - Replace 1,125 console.log statements
   - Effort: 4 hours
   - Impact: Production-ready logging, 0 console.log
   - Unified logger with levels

4. **split-types-file.md** - Split types.ts (762 lines)
   - Effort: 2 hours
   - Impact: Better organization, easier imports
   - Split by domain: terminal, git, chat, agent, storage

5. **split-marketplace-data.md** - Split marketplaceData.ts (1,022 lines)
   - Effort: 1 hour
   - Impact: Better organization, -1,022 lines from one file
   - Split by category: agents, plugins, skills

### Test Coverage

6. **test-suite-chat-system.md** - Complete chat system tests
   - Effort: 6 hours
   - Impact: 20% coverage increase
   - Files: ChatInput, ChatView, AIAssistant

7. **test-suite-terminal.md** - Terminal management tests
   - Effort: 6 hours
   - Impact: 15% coverage increase
   - Files: TerminalSidebar, TerminalView, hooks

8. **test-suite-git.md** - Git integration tests
   - Effort: 6 hours
   - Impact: 15% coverage increase
   - Files: GitPanel, GitSidebar, BranchManager

---

## Quick Reference

### By Effort

**< 1 hour** ⚡:
- None (all moved to P0)

**1-2 hours**:
- split-marketplace-data.md (1h)
- split-types-file.md (2h)

**4-6 hours**:
- lazy-loading-components.md (4h)
- logger-replacement.md (4h)
- test-suite-chat-system.md (6h)
- test-suite-terminal.md (6h)
- test-suite-git.md (6h)

### By Impact

**Bundle Size**:
- lazy-loading-components: -560KB
- tree-shaking-optimization: -40KB

**Code Quality**:
- logger-replacement: 0 console.log in production
- split-types-file: Better organization
- split-marketplace-data: Better organization

**Test Coverage**:
- test-suite-chat-system: +20%
- test-suite-terminal: +15%
- test-suite-git: +15%

---

## Suggested Order

1. **tree-shaking-optimization** (45min) - Quick win first!
2. **split-types-file** (2h) - Easy organizational win
3. **split-marketplace-data** (1h) - Another easy win
4. **lazy-loading-components** (4h) - Big performance impact
5. **logger-replacement** (4h) - Production readiness
6. **test-suite-chat-system** (6h) - Most critical tests
7. **test-suite-terminal** (6h) - Core functionality
8. **test-suite-git** (6h) - Important feature coverage

**Total Effort**: ~30 hours over 1-2 weeks

---

**Note**: Create individual task files following the template in main README.md
