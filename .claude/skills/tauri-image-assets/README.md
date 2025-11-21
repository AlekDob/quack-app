# Tauri Image Assets Skill

This skill helps manage image assets in Tauri + Vite projects, preventing broken images in production builds.

## Quick Start

### Check for Missing Images

```bash
python3 .claude/skills/tauri-image-assets/scripts/audit_images.py .
```

### Copy Missing Images

```bash
python3 .claude/skills/tauri-image-assets/scripts/copy_images_to_public.py images/ public/images/
```

### Add Test to Prevent Regressions

```bash
cp .claude/skills/tauri-image-assets/assets/imageAssets.global.test.template.ts src/tests/imageAssets.global.test.ts
npm test -- imageAssets.global.test.ts
```

## Documentation

- `SKILL.md` - Complete skill documentation
- `references/tauri-vite-assets.md` - Detailed explanation of the problem
- `scripts/` - Audit and copy tools
- `assets/` - Test template

## The Problem

In Tauri + Vite projects:
- **Dev mode**: Images work from both `public/` and root `images/`
- **Production**: Only images in `public/` are bundled → broken images!

**Solution**: All images must be in `public/` folder.

## Files in This Skill

```
tauri-image-assets/
├── SKILL.md                              # Main documentation
├── README.md                             # This file
├── scripts/
│   ├── audit_images.py                   # Find missing images
│   └── copy_images_to_public.py          # Copy images to public/
├── references/
│   └── tauri-vite-assets.md              # Detailed guide
└── assets/
    └── imageAssets.global.test.template.ts  # Vitest test
```

## When to Use

- ✅ Images load in dev but not production
- ✅ Setting up new Tauri + Vite project
- ✅ Creating image validation tests
- ✅ Debugging 404 errors for images
- ✅ Migrating images to public folder

## Example Output

```
🔍 IMAGE ASSETS AUDIT
======================================================================
📊 SUMMARY
======================================================================
📄 Files scanned: 10
🖼️  Images in public/: 67
🔗 Unique image references: 11
✅ ALL IMAGES FOUND IN PUBLIC FOLDER!
🎉 Production build should work correctly
```
