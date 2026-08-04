---
type: feature-doc
project: synara
stack: React / Vite / TypeScript / Electron
created: 2026-08-04
startDate: 2026-08-04
endDate:
last_verified: 2026-08-04
status: active
tags: [brand-mark, logo, icons, quack, favicon]
---

## Brand Mark
**Purpose:** Quack monoline duck mark used as app icon, favicons, splash, and in-app `SynaraLogo`.
**Stack:** React / Electron / static assets

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `apps/web/src/components/SynaraLogo.tsx` | Theme-aware PNG mark (`dark:` swap) |
| Component | `apps/web/src/components/chat/ChatEmptyStateHero.tsx` | Transcript empty hero logo |
| Component | `apps/web/src/components/ChatView.tsx` | Centered empty-landing logo + heading spacing |
| Component | `apps/web/src/components/SplashScreen.tsx` | Full-screen splash mark |
| Component | `apps/web/src/components/chat/TimelineWorkEntryRow.tsx` | Quack MCP tool glyph via `SynaraLogo` |
| Config | `scripts/lib/brand-assets.ts` | Production/dev icon source paths for packaging |
| Config | `apps/web/src/branding.ts` | Display name / version strings |
| Util | `scripts/check-brand-identity.ts` | Brand identity packaging checks |

### Assets
| Path | Role |
|------|------|
| `apps/web/public/synara.png` | UI dark mark — white + orange, **transparent**, content-cropped |
| `apps/web/public/synara-light.png` | UI light mark — black + orange, **transparent**, content-cropped |
| `apps/web/public/favicon.ico` (+ 16/32, apple-touch) | Browser favicons from solid dark tile |
| `apps/marketing/public/icon.png` (+ favicons) | Marketing / nav icon (solid dark tile) |
| `apps/desktop/resources/icon.png` / `dock-icon.png` / `icon.icns` / `icon.ico` | Desktop app / Dock / Windows icons (solid dark tile) |
| `assets/prod/black-*-1024.png` | Packaging masters (solid dark tile) |
| `assets/prod/quack-q-duck-dark-1024.png` | Solid dark master (black bg) |
| `assets/prod/quack-q-duck-light-1024.png` | Solid light master (white bg) |
| `assets/prod/quack-q-duck-*-transparent-1024.png` | Transparent masters for UI |
| `assets/prod/quack-duck-source.jpg` | Provenance source (Pinterest reference crop) |

### Data Flow
`assets/prod` masters → desktop/web/marketing public icons → `SynaraLogo` (`/synara.png` \| `/synara-light.png` via `.dark`) → empty state / splash / tool rows

### Key Functions
- `SynaraLogo(props) → span` — dual `<img>`; light shown by default, dark under `.dark`
- Empty landing: `size-20` logo + `gap-2` to heading (`What should we work on?`)

### Behavior
- **Do not** recreate the mark as hand-drawn SVG for product chrome — use the raster masters derived from the source duck image
- App/Dock/favicon tiles keep a **solid black** square; in-app marks are **transparent** so they sit on the theme surface
- Light theme → black strokes; dark theme → white strokes; beak stays brand orange (`#E67E22` / `#F48736` range)
- Inline SVG path file `apps/web/src/assets/synaraLogoPath.ts` is legacy / unused by `SynaraLogo`
