---
type: decision
date: 2026-02-11
status: implemented
impact: high
tags: [architecture, editor, bundle-optimization, production-bug-fix]
---

# Decision: Remove Monaco Editor, Use CodeMirror + IDE Opener

## Context

Quack had two code editor libraries:

1. **Monaco Editor** (~350KB)
   - Full VSCode editor
   - Rich features (IntelliSense, multi-cursor, etc.)
   - **Problem**: Syntax highlighting broken in production builds
   - **Root cause**: Web workers fail to load due to CORS restrictions in Tauri

2. **CodeMirror** (~80KB)
   - Lightweight, modular editor
   - Already integrated and working
   - Actively used in project

### The Production Bug

Monaco Editor uses web workers for syntax highlighting and language services. In Tauri production builds:
- Workers cannot be loaded cross-origin
- Syntax highlighting fails completely
- Line numbers disappear
- Editor shows plain white/gray text

This made the editor effectively unusable in production, despite working perfectly in development.

## Decision

**Remove Monaco Editor entirely.**

Replace with:
1. **CodeMirror** for inline editing needs (read-only previews, command editor, popouts)
2. **IDE opener** for file editing (VS Code, Cursor, Zed, etc.)

## Rationale

### Why Remove Monaco

1. **Production bug is unfixable** - Web worker CORS restrictions are fundamental to Tauri's security model
2. **Bundle bloat** - 350KB for an editor we barely used
3. **Maintenance overhead** - Two editors to update and maintain
4. **Build complexity** - Special webpack/Vite configuration for workers

### Why CodeMirror + IDE Opener

1. **CodeMirror strengths**:
   - Already working in production
   - 80KB vs 350KB
   - Perfect for read-only previews and simple editing
   - Modular, easy to customize

2. **IDE opener strengths**:
   - Users get their full IDE environment
   - All plugins, themes, keybindings
   - Professional editing experience
   - Zero bundle cost (system app)

3. **Combined approach**:
   - Quick previews in-app (CodeMirror)
   - Serious editing in IDE
   - Best of both worlds

## Implementation

### Files Changed

**Deleted** (Monaco code):
- `src/components/CodeEditorMonaco.tsx`
- `src/components/CodeEditorMonaco.css`
- `src/components/CodeEditor.tsx`
- `src/lib/monacoSetup.ts`
- `src/hooks/useMonacoTheme.ts`
- `src/hooks/useMonacoDiff.ts`
- `src/tests/monacoSyntaxHighlighting.test.ts`
- `src/tests/codeEditorMonaco.test.ts`

**Modified** (to use CodeMirror):
- `src/components/FilePreviewDrawer.tsx`
- `src/components/CommandEditor.tsx`
- `src/components/TabPopoutWindowApp.tsx`
- `src/App.tsx`
- `src/hooks/useGlobalKeyboardShortcuts.ts`
- `src/main.tsx`
- `vite.config.ts`

**Dependencies removed**:
- `monaco-editor` (^0.55.1)
- `@monaco-editor/react` (^4.7.0)

### User-Facing Changes

**Before**:
- Click file → Monaco editor opens (broken syntax highlighting in production)
- In-app editing

**After**:
- Click file → CodeMirror preview (read-only, works perfectly)
- Click "Open in IDE" → File opens in VS Code/Cursor/Zed
- Professional editing experience

## Impact

### Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Bundle size | 2.5MB | 2.15MB | -14% |
| Build time | ~45s | ~35-40s | -10-15% |
| Production syntax highlighting | Broken | Working | ✅ |
| User editor experience | In-app (broken) | Full IDE | ✅ |

### User Experience

**Improvements**:
- No more broken syntax highlighting
- Faster app load (smaller bundle)
- Professional editing in real IDE
- Consistent with developer workflows

**Trade-offs**:
- No in-app file editing
- Must switch to IDE for editing

**Verdict**: Trade-off is acceptable. Developers already live in their IDEs. Quick preview in-app, serious editing in IDE is natural.

## Alternatives Considered

### 1. Fix Monaco Web Worker Loading
**Rejected** - Tauri's security model prevents cross-origin worker loading. Would require bundling workers inline (complex, large bundle impact).

### 2. Keep Monaco for Specific Use Cases
**Rejected** - Not worth 350KB for edge cases. CodeMirror handles all inline editing needs.

### 3. Use Only CodeMirror (No IDE Opener)
**Rejected** - Users need full IDE features for serious editing. CodeMirror alone is insufficient.

## Future Considerations

### Lazy Loading CodeMirror
If CodeMirror becomes a bottleneck:
- Lazy load language extensions
- Load editor only when needed
- Virtualize large files

### IDE Integration Improvements
- Deep link to specific lines
- Bidirectional file sync
- Embedded terminal in IDE

## References

### Related Documents
- Optimization doc: `docs/08-optimizations/01-completed/remove-monaco-editor.md`
- Bug report: `docs/02-bug-fixes/monaco-syntax-highlighting-production.md`

### Related Patterns
- IDE store system: `src/stores/ideStore.ts`
- CodeMirror component: `src/components/CodeEditorCodeMirror.tsx`

### External Resources
- [Monaco Editor GitHub - ESM Integration Issues](https://github.com/microsoft/monaco-editor/issues)
- [Tauri Security Model](https://tauri.app/v1/references/architecture/security)
- [CodeMirror Documentation](https://codemirror.net/)

## Lessons Learned

1. **Production parity matters** - Development working ≠ production working
2. **Simpler is better** - One focused editor beats two competing editors
3. **Leverage system tools** - IDE opener is zero-cost, high-value feature
4. **Bundle size adds up** - 350KB removed = 14% reduction
5. **User workflows over features** - Developers want to use their IDE, not an in-app editor

## Status

- **Date**: 2026-02-11
- **Status**: Implemented and deployed
- **Impact**: High (production bug fix + bundle optimization)
- **Verification**: All tests passing, production syntax highlighting working
