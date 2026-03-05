---
type: gotcha
project: quack-app
created: 2026-03-05
last_verified: 2026-03-05
tags: [pixijs, csp, webgl, tauri, build, office]
---
# PixiJS black screen in production builds (CSP blocks shader compilation)

## Symptom
Office view renders correctly in `npm run tauri dev` but shows a black/empty canvas in production builds (DMG/NSIS).

## Root Cause
PixiJS v8 uses `new Function()` internally for WebGL shader compilation (`GlShaderSystem`, `GlUniformGroupSystem`, `GlUboSystem`). Tauri's CSP has `script-src 'self'` without `'unsafe-eval'`.

- **Dev mode**: Tauri bypasses CSP entirely, so `new Function()` works fine.
- **Production build**: CSP is enforced. `new Function()` is blocked by missing `'unsafe-eval'` in `script-src`. Shader compilation silently fails, resulting in a black canvas.

## Fix
Import `pixi.js/unsafe-eval` **before** any PixiJS usage:

```typescript
// MUST import before any PixiJS usage
import 'pixi.js/unsafe-eval';
import { Application, extend } from '@pixi/react';
```

Despite the confusing name (inherited from v7's `@pixi/unsafe-eval` package), this module **replaces** all `new Function()` calls with CSP-safe polyfills. It does NOT add unsafe-eval — it removes the need for it.

## What the polyfill patches
- `GlShaderSystem._generateShaderSync` (shader compilation)
- `GlUniformGroupSystem._generateUniformsSync` (uniform binding)
- `GlUboSystem._generateUboSync` (UBO sync, STD40)
- `GpuUboSystem._generateUboSync` (UBO sync, WGSL)
- `AbstractRenderer._unsafeEvalCheck` (safety check bypass)
- `ParticleBuffer.generateParticleUpdate` (particle system)

## Key Lesson
Any library that uses `new Function()` or `eval()` will silently fail in Tauri production builds where CSP enforces `script-src 'self'`. Always test WebGL/GPU rendering in production builds, not just dev mode.

## Files
- `src/components/office/OfficeView.tsx` (import at top)
- `src-tauri/tauri.conf.json` (CSP definition)

## Brain breadcrumb
`// Brain: gotcha-pixi-csp-unsafe-eval`
