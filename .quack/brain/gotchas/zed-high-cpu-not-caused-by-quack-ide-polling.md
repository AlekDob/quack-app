---
type: gotcha
project: quack-app
created: 2026-02-13
tags: [zed, ide-integration, performance, debugging]
verified: true
---

# Zed high CPU not caused by Quack IDE polling

## Problem

User reported Zed using 132% CPU when opened via Quack, suspected Quack's IDE integration was causing it.

## Investigation

Verified Quack is **NOT the culprit**. Evidence:

1. **No persistent IDE connection**: `~/.claude/ide/` is empty (no WebSocket lock files for Zed), so `useExternalIdeContext` polling (every 3s) just does `readdir` and returns `None` (cost: ~0% CPU)

2. **One-shot interactions only**: Quack only interacts via:
   - `open -a Zed` (launch)
   - `zed <file:line>` (open file)
   - No persistent loops or background processes

3. **Real cause**: Zed's language servers (rust-analyzer, typescript-language-server) indexing large codebases like quack-app (Rust + TypeScript + node_modules)

## Solution

**Recommendation**: Add the following to Zed's file watcher exclusions:
- `node_modules/`
- `target/`
- `dist/`
- `.quack/`
- `src-tauri/target/`

**Debug verification**: Check Activity Monitor for `rust-analyzer` or `typescript-language-server` subprocess during high CPU events.

## Context

This is important because:
1. Users may blame Quack for IDE performance issues when Quack's IDE integration is minimal by design
2. The `useExternalIdeContext` polling is deliberately lightweight (just directory reads)
3. Modern IDEs run heavy indexing operations that dominate CPU usage compared to Quack's interactions

## Related Files

- `src-tauri/src/ide_integration.rs` - IDE open/focus operations (one-shot commands)
- `src/stores/ideStore.ts` - Frontend IDE state management
- `src/hooks/useExternalIdeContext.ts` - 3-second polling (only reads `~/.claude/ide/`)
