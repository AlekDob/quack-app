---
type: feature
project: quack-desktop
created: 2026-07-13
last_verified: 2026-07-14
status: active
related: [054-works-layer.md, 063-surface-view-prefs.md, 065-works-drawer-ux.md, 068-quack-plan-harness.md, 041-mention-file-preview.md]
tags: [works, brain, documentation, open-file, agent-mode, ux]
---

# 070 — Workspace doc open (friendly path resolution)

**Purpose:** Opening documentation paths from chat links, composer **Context docs**, Works **Documentation** refs, or feature drawers must not surface raw OS errors (`Can't open foo.md: No such file`). Resolve bare filenames and partial paths (including nested `documentation/engine/…` layouts), verify existence on disk, route each ref kind to the right surface (story drawer, feature preview drawer, editor tab, or editor tab drawer), and show a clear in-app message when a doc is not created yet.

## Entry points

| Surface | Handler |
|---|---|
| Chat file link click (`AIChatPanel`) | `openWorkspaceDocPath` |
| `ComposerDocsChip` ref row | `openBrainRef` |
| `WorksDocRefsSection` ref row | `openBrainRef` |
| `FeatureDocDrawer` → link in preview | `openWorkspaceDocPath` |
| Missing feature file in drawer | Inline empty state (no toast + close) |

## `openBrainRef` dispatch (by `BrainRef.role` + path)

All composer / Works doc clicks funnel here. Resolution always prefers **disk truth** (`resolveWorkspaceDocTarget`) before opening UI.

| Ref kind | Example path | Opens |
|---|---|---|
| `story` | `works/stories/S-001.md` | **`openStoryDrawer`** when story id is found in works snapshot; else `openWorkspaceDocPath` fallback |
| `primary` (module) | `documentation/features/054-works-layer.md` | **`openFeatureDocDrawer`** after resolve (workspace-relative `featurePath`) |
| `related` / `extra` with `/features/` | `documentation/engine/features/040-foo.md` | **`openFeatureDocDrawer`** (resolved path — not the stale `documentation/features/` guess) |
| `related` / `extra` (diary, decisions, …) | `documentation/engine/diary/2026-07-14.md` | Editor tab, or **tab drawer in Agent Mode** (`openFileInDrawer`) |
| Missing on disk | any | Short warning toast — no stack trace |

**Agent Mode gotcha (fixed 2026-07-14):** In Agent Mode `WorkspaceShell` is unmounted — `openFile` on the main pane creates a tab with no visible host (felt like a crash/freeze). Non-feature docs now use `openFileInDrawer`, which mounts `EditorTabDrawer` + `TabContentHost` inside `AgentModeShell` (same drawer host as subagent transcripts — see `063`).

## API (`workspaceDocOpen.ts`)

| Function | Role |
|---|---|
| `workspaceDocCandidates(wsRoot, raw)` | Build candidate absolute paths from chat link / bare name |
| `resolveWorkspaceDocPath(wsRoot, raw)` | First path that exists on disk (`fs.exists`) |
| `resolveWorkspaceDocTarget(wsId, root, raw)` | *(internal)* Resolved abs + owning workspace + workspace-relative path |
| `openWorkspaceDocPath(wsId, wsRoot, raw)` | Feature drawer or editor / drawer file open; warning if missing |
| `openBrainRef(wsId, wsRoot, ref)` | Dispatch by `BrainRef` kind (table above) |

## Path resolution rules

1. Normalize via `chatFileLinks` (`normalizeFileLinkPath`, `resolveChatFilePath`)
2. Bare filename or `documentation/…` → `normalizeBrainDocPath` → `documentation/features/{NNN}-slug.md` candidate
3. **Engine layout extras** (spaceship-style repos): for `NNN-slug.md` also try `documentation/engine/features/` and `engine/documentation/features/`; diary dates also try `documentation/engine/diary/`
4. Try candidates across **all open workspace roots** (chat may reference another project's docs)
5. Bare `.md` still missing → `search.listFiles` basename walk under `**/documentation/**` (cap **8k** files per root — avoids UI lockups on huge trees)
6. Open in the workspace that owns the resolved absolute path; `activateWorkspace` when needed

**Basename scoring** (when multiple hits): `features/` < `diary/` < other; shorter relative path wins within tier.

## Surfaces opened

| Target | Component / store action |
|---|---|
| Feature doc preview | `openFeatureDocDrawer` → `FeatureDocDrawer.tsx` (portals to nested drawer stack when parent tab drawer is open — `editorDrawerStack.ts`) |
| Story | `openStoryDrawer` → `StoryDrawer.tsx` |
| Editor file (normal layout) | `store.openFile` |
| Editor file (Agent Mode) | `store.openFileInDrawer` → `AgentModeShell` drawer host |

## UX copy

| Case | Copy |
|---|---|
| Missing feature doc in drawer | **“This document hasn't been created yet.”** (drawer stays open) |
| Missing from chat / chip | Short warning toast: `{basename} doesn't exist yet` |

## Key files

| File | Role |
|---|---|
| `src/workspaceDocOpen.ts` | Resolution + open routing |
| `src/components/ComposerDocsChip.tsx` | Hover popover; row click → `openBrainRef` |
| `src/components/works/WorksDocRefsSection.tsx` | Works drawer doc list → `openBrainRef` |
| `src/components/works/FeatureDocDrawer.tsx` | Feature preview + missing state |
| `src/storyDrawer.ts` / `StoryDrawer.tsx` | Story artifact drawer |
| `src/agentMode.ts` | `getAgentMode()` gate for drawer vs tab |
| `src/store.ts` | `openFile`, `openFileInDrawer`, `setActiveWorkspace` |

## Related

- Composer docs chip UX: `068-quack-plan-harness.md`, `054-works-layer.md`
- Tab vs drawer prefs: `063-surface-view-prefs.md`
- Brain ref model: `worksBrainRefs.ts`, `worksBrainRefUi.ts`
- Skill guidance (paths in `refs:`, not pasted bodies): `quack-works` skill

## Verify

1. **Editor layout:** link story + feature + diary in Context docs → each opens correct surface.
2. **Agent Mode:** same three clicks → story drawer, feature preview drawer, file in right tab drawer (no freeze).
3. **Engine paths:** bare `040-foo.md` ref resolves to `documentation/engine/features/040-foo.md` when that file exists.
4. **Cross-workspace:** doc in project B opens in B when clicked from project A chat (active workspace switches).
