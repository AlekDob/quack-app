# 🔥 Quick Win: Remove Monaco Editor (P0)

**Priority**: P0 Critical 🔴 ⚡ **QUICK WIN**
**Effort**: 1 hour
**Impact**: -350KB bundle size (-14% reduction!)
**Status**: ⏳ Pending

---

## 📊 Summary

Remove duplicated Monaco Editor dependencies and use only CodeMirror for code editing. This is a **high-impact, low-effort** optimization that saves ~350KB from the bundle.

---

## Problem Statement

### Duplication Issue
The project currently has **TWO** code editor libraries:

1. **Monaco Editor** (VSCode editor)
   - `monaco-editor`: ~300KB
   - `@monaco-editor/react`: ~50KB
   - `vite-plugin-monaco-editor`: Build plugin
   - **Total: ~350KB**

2. **CodeMirror** (Lightweight modular editor)
   - `@codemirror/*` packages: ~80KB total
   - Already integrated and working
   - **Actively used in project**

### Why This is a Problem
- Unnecessary bundle bloat (+350KB)
- Maintenance overhead (two editors to update)
- Confusion about which editor to use
- Slower build times (Monaco webpack processing)

---

## Current State

### Where Monaco is Used

```bash
# Find Monaco usage
grep -rn "monaco" src/

# Expected locations:
# - src/components/CodeEditor.tsx (if exists)
# - vite.config.ts (monaco plugin)
# - package.json (dependencies)
```

### Current Bundle Analysis

```
Total Bundle: ~2.5MB
Monaco Editor: ~350KB (14% of bundle)
CodeMirror: ~80KB (already included)
```

### Build Configuration

```typescript
// vite.config.ts
import monacoEditorPlugin from 'vite-plugin-monaco-editor'

export default defineConfig({
  plugins: [
    react(),
    monacoEditorPlugin() // ← TO BE REMOVED
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco-editor': ['monaco-editor'], // ← TO BE REMOVED
        }
      }
    }
  }
})
```

---

## Target State

### After Removal

```
Total Bundle: ~2.15MB (-14%)
CodeMirror: ~80KB (only editor)
Build Time: -5-10 seconds (no Monaco webpack processing)
```

### CodeMirror Advantages

- ✅ **Lighter**: 80KB vs 350KB
- ✅ **Modular**: Import only what you need
- ✅ **Modern**: Better tree-shaking
- ✅ **Flexible**: Easier to customize
- ✅ **Already integrated**: Working in project

---

## Implementation Steps

### Step 1: Verify Monaco Usage (5 min)

```bash
# Find all Monaco imports
grep -rn "monaco-editor" src/
grep -rn "@monaco-editor/react" src/

# Check if Monaco is actually used
# If only in old/unused files, proceed immediately
```

### Step 2: Replace with CodeMirror (30 min)

**If Monaco is used** (e.g., in `CodeEditor.tsx`):

```typescript
// BEFORE: Monaco Editor
import { Editor } from '@monaco-editor/react'

function CodeEditor({ value, language, onChange }) {
  return (
    <Editor
      value={value}
      language={language}
      onChange={onChange}
      theme="vs-dark"
    />
  )
}
```

```typescript
// AFTER: CodeMirror (already in project!)
import { useCodeMirror } from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { vscodeDark } from '@uiw/codemirror-theme-vscode'

function CodeEditor({ value, language, onChange }) {
  const { setContainer } = useCodeMirror({
    value,
    extensions: [javascript()],
    onChange,
    theme: vscodeDark,
  })

  return <div ref={setContainer} />
}
```

**Note**: You already have `CodeEditorCodeMirror.tsx` - just use that!

### Step 3: Remove Dependencies (5 min)

```bash
npm uninstall monaco-editor @monaco-editor/react vite-plugin-monaco-editor
```

### Step 4: Update Vite Config (10 min)

```typescript
// vite.config.ts - REMOVE Monaco plugin

export default defineConfig({
  plugins: [
    react(),
    // monacoEditorPlugin(), ← REMOVE THIS LINE
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // if (id.includes('monaco-editor')) return 'monaco-editor' ← REMOVE
          if (id.includes('@xterm')) return 'xterm'
          if (id.includes('claude-agent-sdk')) return 'claude-sdk'
          // ... rest unchanged
        }
      }
    }
  }
})
```

### Step 5: Test Build (10 min)

```bash
# Clean build
rm -rf dist node_modules/.vite
npm run build

# Verify bundle size reduction
npm run build:analyze
# Open dist/stats.html and confirm monaco-editor is gone

# Test app functionality
npm run dev
# Test code editing features still work
```

---

## Acceptance Criteria

- [ ] Monaco Editor removed from package.json
- [ ] No Monaco imports in src/ files
- [ ] Vite config cleaned up (no Monaco plugin)
- [ ] Build succeeds without errors
- [ ] Bundle size reduced by ~350KB
- [ ] Code editing features still work (test in dev mode)
- [ ] No console errors related to Monaco
- [ ] Build time reduced by 5-10 seconds

---

## Testing

### Manual Testing Checklist

1. **Code Editor Component**
   - Open file explorer
   - Click on a code file (.ts, .tsx, .js)
   - Verify syntax highlighting works
   - Verify editing works (type, delete, undo)
   - Verify line numbers display

2. **Performance**
   - Measure app startup time
   - Check bundle size in dist/
   - Verify no Monaco-related chunks in build output

3. **No Regressions**
   - Terminal still works
   - Chat still works
   - Git operations still work

### Automated Testing

```bash
# Run existing tests
npm test

# All 37 tests should still pass
# No new errors related to editor
```

---

## Rollback Plan

If issues arise:

```bash
# Reinstall Monaco
npm install monaco-editor @monaco-editor/react vite-plugin-monaco-editor

# Restore vite.config.ts from git
git checkout vite.config.ts

# Restore any modified components
git checkout src/components/CodeEditor.tsx
```

---

## Expected Benefits

### Bundle Size
- **Before**: 2.5MB total, 350KB Monaco
- **After**: 2.15MB total (-14%)
- **Savings**: 350KB uncompressed (~100KB gzipped)

### Build Performance
- **Before**: ~45 seconds
- **After**: ~35-40 seconds (-10-15%)
- **Reason**: No Monaco webpack processing

### Developer Experience
- Faster dev server startup
- Less confusion (single editor library)
- Better tree-shaking in future

---

## Related Tasks

### Unlocks
- Easier to implement lazy loading (no Monaco to worry about)
- Simpler Vite configuration
- Faster CI/CD builds

### Follow-up Tasks
After this is complete:
1. **P1**: Lazy load CodeMirror if not used immediately
2. **P1**: Optimize CodeMirror language imports (load on-demand)
3. **P2**: Consider virtualizing large files in editor

---

## Risk Assessment

### Low Risk 🟢

**Reasons**:
- CodeMirror already working in project
- Monaco likely not heavily used
- Easy rollback if needed
- No impact on core functionality

**Mitigation**:
- Test thoroughly before committing
- Keep git history for easy revert
- Monitor for any editor-related bug reports

---

## References

### Current Files
- `src/components/CodeEditorCodeMirror.tsx` - Already implemented!
- `package.json` - Monaco dependencies
- `vite.config.ts` - Monaco plugin configuration

### Documentation
- CodeMirror docs: https://codemirror.net/
- Vite bundle analysis: `npm run build:analyze`

### Related Issues
- From analysis report: "Monaco + CodeMirror duplicati" (Section 3)
- Bundle optimization priority: P0 (Quick Win #1)

---

## Notes

### Why Monaco Was Added
Likely added early in development, then CodeMirror was chosen as the better option but Monaco was never removed.

### Production Impact
- No user-facing changes (editor UI stays the same)
- Faster app load time (smaller bundle)
- Better user experience

---

**Priority**: P0 Critical 🔴
**Quick Win**: Yes! ⚡
**ROI**: Massive (1h effort for 350KB savings)
**Next Task After This**: Lazy loading heavy components

---

🦆 **Quick Win Achievement**: 14% bundle size reduction in just 1 hour!
