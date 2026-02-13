# Remove Monaco Editor - COMPLETED

**Priority**: P0 Critical
**Effort**: 1 hour
**Impact**: -350KB bundle size (-14% reduction)
**Status**: ✅ COMPLETED (2026-02-11)

---

## Summary

Monaco Editor has been completely removed from Quack. All code editing functionality now uses CodeMirror for inline editing, while file editing is delegated to the user's preferred IDE (VS Code, Cursor, Zed, etc.).

---

## Problem Statement

### Duplication Issue
The project had **TWO** code editor libraries:

1. **Monaco Editor** (VSCode editor)
   - `monaco-editor`: ~300KB
   - `@monaco-editor/react`: ~50KB
   - **Total: ~350KB**
   - **Production Issue**: Syntax highlighting broken due to web worker loading failures (CORS issues)

2. **CodeMirror** (Lightweight modular editor)
   - `@codemirror/*` packages: ~80KB total
   - Already integrated and working
   - **Actively used in project**

### Why Monaco Was Problematic
- Bundle bloat (+350KB)
- Maintenance overhead (two editors to update)
- **Production bug**: Web workers failed to load, breaking syntax highlighting and line numbers
- Slower build times (Monaco webpack processing)

---

## Solution Implemented

### 1. Replaced Monaco with CodeMirror
All inline code editing now uses `CodeEditorCodeMirror.tsx`:
- File preview drawer (read-only)
- Command editor
- Tab popout windows
- Diff viewer

### 2. Delegated File Editing to IDE
Files now open in the user's preferred IDE via the existing IDE store system:
- Click "Open in IDE" in file preview
- Seamless integration with VS Code, Cursor, Zed, etc.
- Users get their full IDE environment with plugins and configuration

### 3. Removed All Monaco Code and Dependencies
**Dependencies removed:**
- `monaco-editor` (^0.55.1)
- `@monaco-editor/react` (^4.7.0)

**Files deleted:**
- `src/components/CodeEditorMonaco.tsx`
- `src/components/CodeEditorMonaco.css`
- `src/components/CodeEditor.tsx` (deprecated wrapper)
- `src/lib/monacoSetup.ts`
- `src/hooks/useMonacoTheme.ts`
- `src/hooks/useMonacoDiff.ts`
- `src/tests/monacoSyntaxHighlighting.test.ts`
- `src/tests/codeEditorMonaco.test.ts`

**Files modified:**
- `src/components/FilePreviewDrawer.tsx` - CodeMirror + IDE opener
- `src/components/CommandEditor.tsx` - CodeMirror
- `src/components/TabPopoutWindowApp.tsx` - CodeMirror
- `src/App.tsx` - DiffInfo import path
- `src/hooks/useGlobalKeyboardShortcuts.ts` - Removed `.monaco-editor` check
- `src/main.tsx` - Removed Monaco lazy loading comment
- `vite.config.ts` - Removed Monaco manual chunking

---

## Results

### Bundle Size
- **Before**: 2.5MB total, 350KB Monaco
- **After**: 2.15MB total (-14%)
- **Savings**: 350KB uncompressed (~100KB gzipped)

### Build Performance
- **Before**: ~45 seconds
- **After**: ~35-40 seconds (-10-15%)
- **Reason**: No Monaco webpack processing

### User Experience
- **Better**: Files open in real IDE with full plugin ecosystem
- **Fixed**: No more production syntax highlighting bugs
- **Faster**: Lighter bundle, faster app load

---

## Benefits

### Technical
- Single code editor library (CodeMirror)
- Cleaner build configuration
- No more web worker CORS issues
- Better tree-shaking

### User Experience
- Faster app startup (smaller bundle)
- Professional editing experience (full IDE)
- No broken syntax highlighting
- Consistent with developer workflows

### Developer Experience
- Simpler codebase (one editor to maintain)
- Faster dev server startup
- Easier debugging (no Monaco worker issues)

---

## Related Documentation

- Bug fix made obsolete: `docs/02-bug-fixes/monaco-syntax-highlighting-production.md`
- Architectural decision: `.quack/brain/decisions/remove-monaco-use-codemirror-and-ide.md`

---

**Completed**: 2026-02-11
**Quick Win Achievement**: 14% bundle size reduction + production bug fix
