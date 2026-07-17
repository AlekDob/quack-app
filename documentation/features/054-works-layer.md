---
type: feature
project: quack-desktop
created: 2026-07-12
last_verified: 2026-07-17
status: active
related: [063-surface-view-prefs.md, 065-works-drawer-ux.md, 066-works-cycles-stories.md, 068-quack-plan-harness.md, 083-composer-feature-link.md]
tags: [features, feature-docs, works, markdown, drawer, composer, inject, timeline, monaco]
---

# 054 — Features layer (md-first)

**Purpose:** Product component map as `documentation/features/NNN-slug.md` — catalog + timeline + drawer + optional composer link. Replaces the Plane-style Works board (W/S/cycles/kanban) in the UI. Legacy `works/` on disk is soft-sunset (ignored by Features pane).

**Perf / token budget:** No FS watch at boot; no works/feature cache subscribe on the chat panel; composer reads `featureId` + `featureLabel` on the chat descriptor only; feature list loads on pane/pill/`@` open; inject default **off**; when on, outline once then pointer (`featureTurnContext` + `manifestForTurn`).

## Storage (source of truth)

| Path | Role |
|---|---|
| `{workspace}/documentation/features/NNN-slug.md` | Feature doc — Purpose, Files tables, Tasks checklist, Plan, Notes, Comments |
| Frontmatter `status` | `draft` \| `active` \| `done` \| `archived` |
| Frontmatter `startDate` / `endDate` | Timeline Gantt range (ISO); `created` fallback for start |
| `{workspace}/works/*` | **Legacy** — not shown in Features UI |

### Feature `.md` (discipline)

| Section | Inject? |
|---|---|
| Purpose (1 sentence) | Outline only |
| Tasks `- [ ]` (open) | Outline (max ~5) |
| Plan / Notes / Comments | Never — Read on demand |

## UI

| Surface | Behaviour |
|---|---|
| Activity bar / Open Features | `works:{wsId}` tab key (legacy id); label **Features** |
| `WorksPane` | Compact toolbar search + List / Timeline toggle + Add feature |
| `WorksFeaturesCatalog` | Lazy `listFeatures`; fuzzy filter on title/slug |
| `FeaturesTimelineView` | Week Gantt; drag bars write `startDate`/`endDate` |
| `FeatureDocDrawer` | Preview: tasks, md body, comments. **Edit:** full-height `SimpleMonacoEditor`; status/start/end always editable (native date picker); meta patches draft while editing |
| Composer link | See **`083-composer-feature-link.md`** |

## FeatureDocDrawer (edit mode)

| Piece | Detail |
|---|---|
| Toggle | Hero ✓ / edit icon — save draft to disk, return to preview |
| Body | `work-feature-body--editing` flex column; Monaco fills remainder (`work-feature-monaco`) |
| Meta while editing | `liveMd = editing ? draft : content`; status/select + date inputs patch via `setFeatureStatusInMd` / `setFeatureFrontmatterField` then `persist` |
| Open in editor | Tab in main IDE (`openFile`) — closes drawer |

## Chat linkage

| Field | Meaning |
|---|---|
| `AIChatDescriptor.featureId` | Slug e.g. `054-works-layer` |
| `AIChatDescriptor.featureLabel` | Cached label (hub tooltip, inject) |

Inject: `getFeatureInjectEnabled` (default false) → `buildFeatureTurnContext`.

## Key files

| Concern | File |
|---|---|
| Catalog / md helpers | `src/featureCatalog.ts` |
| Inject ladder | `src/featureTurnContext.ts` |
| Pane + timeline | `src/components/works/WorksPane.tsx`, `FeaturesTimelineView.tsx` |
| Drawer | `src/components/works/FeatureDocDrawer.tsx` |
| Composer link | `083` — `ComposerFeaturePill.tsx`, `composerInputHighlight.ts` |
| Plan → feature | `src/planFeatureMerge.ts` |

## Related

- `068-quack-plan-harness.md` — plan merge prefers linked feature when `featureId` set
- `066` — cycles/stories (legacy board; UI retired)
- feature-creator skill — create path for new `NNN-slug.md`
