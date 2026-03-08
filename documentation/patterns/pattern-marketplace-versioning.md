---
type: pattern
project: quack-app
created: 2026-03-08
tags: [quack-store, marketplace, versioning, update, registry]
---

# Marketplace Versioning & Update System

## Overview

Centralized version tracking for installed Quack Store resources. Detects available updates by comparing installed vs remote versions, and provides UI for one-click updates.

## Registry: `~/.claude/plugins/quack-installed.json`

Single JSON file tracking all installed marketplace resources:

```json
{
  "version": 1,
  "resources": {
    "flutter-developer--skill--flutter-state": {
      "version": "1.0.0",
      "installedAt": 1709913600000,
      "scope": "global"
    }
  }
}
```

**Resource ID format**: `${pluginName}--${category}--${resourceName}` (from marketplace.json, NOT from the resource itself).

## Key Files

| File | Purpose |
|------|---------|
| `marketplaceRegistryService.ts` | CRUD for registry JSON (load/save/mark/compare) |
| `useMarketplace.ts` | Hook: registry state, hasUpdate(), updateResource() |
| `StoreItemCard.tsx` | Card UI: Get / Remove / Update buttons |
| `MarketplaceInstallModal.tsx` | Modal: Update button + installed version badge |
| `QuackStoreDrawer.tsx` | Wiring: passes update props through |

## Version Comparison

Simple semver-like comparison: split on ".", compare each segment numerically. No external dependencies.

```typescript
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
```

## Backward Compatibility

Pre-registry installations (before this system existed) are detected via filesystem check and marked as `version: "unknown"`. Resources with version "unknown" never show an update badge — no false positives.

## Full Skill Directory Download

Skills are downloaded via GitHub Contents API (`repos/AlekDob/quack-marketplace/contents/{path}`) recursively, fetching ALL files (agents/, scripts/, references/, assets/). Fallback to SKILL.md-only on 403/429 rate limit.

## UI States

- **Not installed**: "Get" button (blue)
- **Installed, up to date**: "Remove" button (gray) + "Installed" badge (green)
- **Installed, update available**: "Update" button (orange) + "Update vX.Y.Z" badge (orange)

## Update Flow

1. User clicks "Update" → `updateResource()` called
2. Downloads latest files (full directory for skills)
3. Updates registry with new version + timestamp
4. Toast confirms: "Updated to vX.Y.Z!"
