---
type: gotcha
project: quack-app
created: 2026-04-04
last_verified: 2026-04-04
tags: [windows, cross-platform, paths, filesystem]
---

# Windows Path Separators

## The Trap

Code that works perfectly on macOS/Linux silently breaks on Windows because Windows uses backslash (`\`) as the path separator, while macOS/Linux use forward slash (`/`).

The most common failure patterns:

```ts
// WRONG — breaks on Windows ("C:\Users\alek\project" → ["C:\\Users\\alek\\project"])
const parts = filePath.split('/');

// WRONG — localStorage key with backslashes is technically valid but inconsistent
const key = `editor:${projectPath}/documentation/features`;

// WRONG — template-literal path building assumes forward slashes
const docPath = `${projectPath}/documentation/...`;
```

## Why It's Insidious

On macOS and Linux, paths always use `/` so `split('/')` always works. The bug only surfaces on Windows, where paths arrive from Tauri/Rust as `C:\Users\alek\project\file.ts`. No TypeScript error, no runtime exception — just silently wrong behavior (empty breadcrumbs, wrong localStorage keys, file-not-found).

## The Fix

### Frontend path splitting

```ts
// CORRECT — handles both / and \
const parts = filePath.split(/[\\/]/);
```

### Path normalization before template literals or localStorage keys

```ts
import { normalizeToForwardSlash } from '@/utils/platform';

// CORRECT — normalize first, then build or use as key
const normalized = normalizeToForwardSlash(projectPath);
const docPath = `${normalized}/documentation/features`;
const storageKey = `editor:${normalized}`;
```

### Rust `#[cfg]` for platform-specific paths

```rust
// CORRECT — different bundle layouts on macOS vs Windows
#[cfg(target_os = "macos")]
{ base.join("../Resources/node-sdk") }
#[cfg(target_os = "windows")]
{ base.join("resources/node-sdk") }
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
{ base.join("../Resources/node-sdk") }
```

### Rust PATH separator

```rust
// CORRECT — semicolon on Windows, colon on Unix
#[cfg(target_os = "windows")]
{ parts.join(";") }
#[cfg(not(target_os = "windows"))]
{ parts.join(":") }
```

## DRY Utility

`normalizeToForwardSlash()` is the single source of truth in `src/utils/platform.ts`. Import it — do NOT inline `path.replace(/\\/g, '/')` again.

## Affected Files (2026-04-04 audit)

- `src/utils/platform.ts` — `normalizeToForwardSlash()` added
- `src/components/editor/EditorHeader.tsx` — `buildBreadcrumb` uses `split(/[\\/]/)`
- `src/services/featureMapService.ts` — filename extraction uses `split(/[\\/]/)`
- `src-tauri/src/code_intel.rs` — `get_node_sdk_path()` uses `#[cfg]` per OS
- `src-tauri/src/shell_env.rs` — `get_extended_path()` uses `#[cfg]` for separator and Windows tool paths
