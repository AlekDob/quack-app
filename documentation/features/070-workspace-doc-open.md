---
type: feature
project: quack-desktop
created: 2026-07-13
last_verified: 2026-07-13
status: active
related: [054-works-layer.md, 065-works-drawer-ux.md, 068-quack-plan-harness.md, 041-mention-file-preview.md]
tags: [works, brain, documentation, open-file, ux]
---

# 070 — Workspace doc open (friendly path resolution)

**Purpose:** Opening documentation paths from chat links, composer context chips, Works **Documentation** refs, or feature drawers must not surface raw OS errors (`Can't open foo.md: No such file`). Resolve bare filenames and partial paths under `documentation/features/`, verify existence, and show a clear in-app message when a doc is not created yet.

## Entry points

| Surface | Before | After |
|---|---|---|
| Chat file link click | `openFile` on resolved path → OS toast on miss | `openWorkspaceDocPath` → warning or feature drawer |
| `ComposerDocsChip` ref row | `openBrainDoc` direct | `openBrainRef` |
| `WorksDocRefsSection` | Same | `openBrainRef` |
| `FeatureDocDrawer` missing file | Toast + close | Inline “not created yet” empty state |

## API (`workspaceDocOpen.ts`)

| Function | Role |
|---|---|
| `workspaceDocCandidates(wsRoot, raw)` | Build candidate absolute paths from chat link / bare name |
| `resolveWorkspaceDocPath(wsRoot, raw)` | First path that exists on disk (`fs.exists`) |
| `openWorkspaceDocPath(wsId, wsRoot, raw)` | Open editor tab or feature drawer; warning if missing |
| `openBrainRef(wsId, wsRoot, ref)` | Dispatch by `BrainRef` kind (feature doc drawer vs editor) |

**Resolution rules:**

1. Normalize via `chatFileLinks` (`resolveChatFilePath`)
2. Bare filename or `documentation/…` → `normalizeBrainDocPath` → `documentation/features/{NNN}-slug.md` candidates
3. Skip cross-root bleed; never open paths outside workspace

## UX copy

Missing feature doc: **“This feature doc hasn't been created yet.”** (drawer stays open with hint). Chat / chip: short warning toast, no stack trace.

## Related

- Brain ref model: `worksBrainRefs.ts`, `worksBrainRefUi.ts` (group labels for UI)
- Feature preview drawer: `FeatureDocDrawer.tsx`
- Skill guidance (paths in `refs:`, not pasted bodies): `quack-works` v9
