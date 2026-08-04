---
type: recap
project: synara
created: 2026-08-04
last_verified: 2026-08-04
tags: [brand-mark, logo, quack]
---

# Quack brand mark — duck assets

## What changed
- Product mark is the Pinterest-sourced monoline duck (white/black strokes + orange beak).
- UI uses **transparent** cropped PNGs; packaging/Dock/favicons use **solid black-tile** masters.
- `SynaraLogo` is an `<img>` pair (light/dark), not `currentColor` SVG geometry.

## Why
- Hand-traced SVG looked wrong vs the reference; user required the real image.
- Solid black squares showed on dark UI; transparent marks fix that.
- Light UI needs the black-stroke transparent variant.

## Where
- Feature map: `documentation/features/002-brand-mark.md`
- Diary: `documentation/diary/2026-08-04.md`
