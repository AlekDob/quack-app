# Monaco Editor Syntax Highlighting in Production

**Date:** 2025-01-14
**Status:** Resolved
**Severity:** High

## Problem

Monaco Editor syntax highlighting works in development but **fails in production** (Tauri builds). The editor shows plain white/gray text without any color highlighting.

### Screenshots

**Development (Working):**
- Full syntax highlighting with colors for keywords, strings, comments, etc.
- Bracket colorization working
- Language detection working

**Production (Broken before fix):**
- All text appears white/gray
- No syntax highlighting
- Editor functional but unreadable for code

## Root Cause Analysis

Monaco Editor uses **web workers** for syntax highlighting and language services. The workers handle:
- Tokenization (syntax highlighting)
- Language validation
- IntelliSense/autocomplete

### Why It Failed in Production

1. **Original approach**: Using CDN (`https://cdn.jsdelivr.net/npm/monaco-editor@X.X.X`)
2. **Problem**: Web workers cannot be loaded cross-origin due to CORS restrictions
3. **Result**: Monaco falls back to no syntax highlighting

### Why It Worked in Development

1. Vite serves files with HMR from `localhost`
2. Everything is same-origin
3. Workers load correctly from `node_modules`

## Solution

### 1. Created Worker Setup Module (`src/lib/monacoSetup.ts`)

```typescript
// Import Monaco workers using Vite's ?worker suffix
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Configure MonacoEnvironment with getWorker (NOT getWorkerUrl!)
self.MonacoEnvironment = {
  getWorker(_moduleId: string, label: string): Worker {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  }
};
```

### 2. Updated CodeEditorMonaco.tsx

```typescript
// Import Monaco setup FIRST (configures workers)
import '../lib/monacoSetup';

// Import Monaco instance
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

// Configure loader to use local Monaco (NOT CDN)
loader.config({ monaco });
```

### Key Points

1. **Use `getWorker`, NOT `getWorkerUrl`** - Vite requires returning Worker instances
2. **Use `?worker` suffix** - Tells Vite to bundle workers separately
3. **Use `loader.config({ monaco })`** - Uses local Monaco instead of CDN
4. **Import order matters** - Setup must run before Monaco loads

## Verification

### Build Output

After the fix, the build includes bundled worker files:

```
dist/assets/worker-editor.worker-*.js    (~246kb)
dist/assets/worker-json.worker-*.js      (~374kb)
dist/assets/worker-css.worker-*.js       (~1006kb)
dist/assets/worker-html.worker-*.js      (~677kb)
dist/assets/worker-ts.worker-*.js        (~6847kb)
```

### Test Command

```bash
npm test -- src/tests/monacoSyntaxHighlighting.test.ts
# Expected: 18 tests passing
```

### Manual Testing

```bash
npm run tauri:build
# Open the built app and verify syntax highlighting works
```

## Files Changed

| File | Change |
|------|--------|
| `src/lib/monacoSetup.ts` | NEW - Worker configuration |
| `src/components/CodeEditorMonaco.tsx` | Use local Monaco instead of CDN |
| `src/tests/monacoSyntaxHighlighting.test.ts` | Updated tests |
| `docs/02-bug-fixes/monaco-syntax-highlighting-production.md` | This documentation |

## References

- [Vite Discussion #1791 - Import monaco-editor using Vite](https://github.com/vitejs/vite/discussions/1791)
- [Monaco ESM Integration Guide](https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md)
- [@monaco-editor/react - Use as npm package](https://github.com/suren-atoyan/monaco-react#use-monaco-editor-as-an-npm-package)
- [SvelteKit with Monaco Editor (2024)](https://www.codelantis.com/blog/sveltekit-monaco-editor)

## Bundle Size Impact

The workers add significant size to the bundle:

| Before | After | Difference |
|--------|-------|------------|
| ~5.5MB | ~14.5MB | +9MB (workers) |

This is expected and acceptable because:
1. Workers are loaded on-demand (not all at once)
2. Brotli compression reduces actual download size significantly
3. Syntax highlighting is essential for a code editor

## Future Considerations

1. Consider lazy-loading workers only when specific languages are used
2. Monitor bundle size with `npm run build:analyze`
3. If bundle size becomes an issue, consider code-splitting by language
