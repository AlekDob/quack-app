# 🟠 Priority 2 - Medium Quality Improvements

**Nice to have improvements, polish and refinement**

---

## Task List

### Build & Performance

1. **vite-config-optimization.md** - Advanced Vite build optimizations
   - Effort: 3 hours
   - Impact: Better code splitting, faster builds
   - Features: Chunk optimization, tree-shaking presets

2. **bundle-analysis.md** - Comprehensive bundle size analysis
   - Effort: 4 hours
   - Impact: Identify hidden bloat, metrics dashboard
   - Tools: Bundle analyzer, Lighthouse, metrics tracking

### Code Quality

3. **eslint-audit.md** - Fix all ESLint errors/warnings
   - Effort: Variable (depends on errors found)
   - Impact: Code consistency, catch potential bugs
   - Setup: Enable strict rules, fix violations

4. **typescript-any-elimination.md** - Remove all `any` types
   - Effort: Variable (depends on `any` count)
   - Impact: Better type safety, fewer runtime errors
   - Replace with: `unknown`, generics, union types

5. **delete-old-files.md** - Clean up deprecated files
   - Effort: 5 minutes ⚡ Super quick!
   - Impact: -791 lines (NewTerminalModal.old.tsx)
   - Also: Find other .old, .backup, commented code

### DevOps

6. **ci-cd-pipeline.md** - GitHub Actions for quality gates
   - Effort: 6 hours
   - Impact: Automated testing, quality enforcement
   - Features: Test on PR, coverage reports, performance budgets

---

## Quick Reference

### By Effort

**< 15 minutes** ⚡:
- delete-old-files.md (5min) - DELETE NewTerminalModal.old.tsx!

**3-4 hours**:
- vite-config-optimization.md (3h)
- bundle-analysis.md (4h)

**6+ hours**:
- ci-cd-pipeline.md (6h)
- eslint-audit.md (variable)
- typescript-any-elimination.md (variable)

### By Impact

**Immediate Wins**:
- delete-old-files: -791 lines in 5 minutes!
- vite-config-optimization: Faster builds

**Long-term Quality**:
- eslint-audit: Better code consistency
- typescript-any-elimination: Type safety
- ci-cd-pipeline: Prevent regressions

**Metrics & Insights**:
- bundle-analysis: Understand what's in the bundle

---

## Suggested Order

1. **delete-old-files** (5min) - Do this RIGHT NOW! ⚡
2. **vite-config-optimization** (3h) - Quick build improvements
3. **bundle-analysis** (4h) - Understand the bundle
4. **ci-cd-pipeline** (6h) - Prevent future issues
5. **eslint-audit** (variable) - When you have time
6. **typescript-any-elimination** (variable) - Ongoing improvement

---

## Quick Win Alert! 🚀

**DO THIS NOW**: Delete `NewTerminalModal.old.tsx`

```bash
# 5 minutes, -791 lines!
rm src/components/NewTerminalModal.old.tsx
git add -u
git commit -m "chore: remove deprecated NewTerminalModal.old.tsx (-791 lines)"
```

**Then check for other .old files**:

```bash
find src -name "*.old.*" -o -name "*.backup.*"
# Delete any found files
```

---

**Note**: These tasks can be done anytime, don't block critical work. P2 tasks are "when you have time" improvements.
