---
name: tauri-image-assets
description: This skill should be used when working with Tauri + Vite projects that have image loading issues in production builds, or when creating tests to prevent broken images. Use this skill when images work in dev mode but fail in production, or when setting up image asset validation tests.
---

# Tauri Image Assets Management

## Overview

This skill provides tools and knowledge for managing image assets in Tauri + Vite projects. It solves the common problem where images load correctly in development mode but fail in production builds.

The skill includes scripts to audit and copy images, test templates for continuous validation, and reference documentation on how Tauri and Vite handle assets differently in dev vs production.

## Core Problem

In Tauri + Vite projects, there's a critical difference between development and production:

- **Dev mode** (`npm run tauri:dev`): Vite serves images from both `public/` and project root
- **Production** (`npm run tauri build`): Vite only bundles `public/` → `dist/` → images outside `public/` don't work

**Solution**: All images referenced in code must exist in the `public/` folder.

## When to Use This Skill

Use this skill when:
- Images load in `npm run tauri:dev` but not in production builds
- Setting up a new Tauri + Vite project with images
- Creating tests to prevent broken images in CI/CD
- Debugging 404 errors for image assets in production
- Migrating images from root directory to public folder
- Need to audit which images are referenced in the codebase

## Workflow

### 1. Diagnose Image Issues

When images don't load in production, use the audit script to identify missing images:

```bash
python3 scripts/audit_images.py /path/to/project
```

The script will:
- Scan all source files for image references (`.ts`, `.tsx`, `.js`, `.jsx`, `.vue`, `.html`)
- Check if each referenced image exists in `public/`
- Report missing images and which files reference them
- Provide summary statistics

**Example output:**
```
🔍 IMAGE ASSETS AUDIT
======================================================================
📊 SUMMARY
======================================================================
📄 Files scanned: 10
🖼️  Images in public/: 66
🔗 Unique image references: 11
❌ Missing images: 3

❌ MISSING IMAGES IN PUBLIC FOLDER:
----------------------------------------------------------------------
📸 /images/logo.png
   Referenced in:
   - src/App.tsx
   - src/components/Header.tsx
```

### 2. Fix Missing Images

Copy missing images from source to public folder using the copy script:

```bash
# Dry run to preview what will be copied
python3 scripts/copy_images_to_public.py images/ public/images/ --dry-run

# Actually copy the images
python3 scripts/copy_images_to_public.py images/ public/images/
```

The script will:
- Find all images in source directory recursively
- Copy to destination maintaining directory structure
- Skip files that already exist and are identical (based on file size)
- Report what was copied and what was skipped

**Common usage patterns:**
```bash
# Copy all images to public
python3 scripts/copy_images_to_public.py images/ public/images/

# Copy specific subdirectory
python3 scripts/copy_images_to_public.py images/avatars/ public/images/avatars/

# Copy backgrounds
python3 scripts/copy_images_to_public.py images/backgrounds/ public/images/backgrounds/
```

### 3. Verify and Rebuild

After copying images, verify everything is fixed:

```bash
# Run audit again - should show 0 missing images
python3 scripts/audit_images.py /path/to/project

# Rebuild production app
npm run tauri build
```

### 4. Create Validation Tests (Optional but Recommended)

To prevent future regressions, create a test that validates all images exist:

1. Copy the test template from `assets/imageAssets.global.test.template.ts`
2. Place it in your test directory (e.g., `src/tests/imageAssets.global.test.ts`)
3. Run tests with your test runner (Vitest, Jest, etc.)

**For Vitest:**
```bash
npm test -- imageAssets.global.test.ts
```

**The test automatically:**
- Scans all source files for image references
- Extracts image paths from code (handles various patterns)
- Verifies each image exists in `public/`
- Generates detailed audit report
- Fails if any images are missing
- Reports statistics (files scanned, images found, references, etc.)

**Example test output:**
```
✓ src/tests/imageAssets.global.test.ts (10 tests) 6ms
  ✓ should find source files with image references
  ✓ should find images in public folder
  ✓ should have all referenced images in public folder
  ✓ should have all duck avatars
  ✓ all public images should start with /

📊 IMAGE AUDIT REPORT
==================================================
📁 Total files scanned: 10
🖼️  Total images in public: 66
🔗 Unique image references in code: 11
```

## Best Practices

1. **Single Source of Truth**: Keep images in `public/` only (don't duplicate in root `images/`)
2. **Consistent Paths**: Always use `/images/...` format (absolute path from root)
3. **Test Early**: Add validation test before first production build
4. **Automate**: Run audit script in CI/CD pipeline
5. **Document**: Add README note about the public folder requirement

## Common Issues and Solutions

### Issue: Images still don't load after copying

**Check:**
- Path format must start with `/` (e.g., `/images/logo.png` not `images/logo.png`)
- File extensions match code exactly (`.png` vs `.jpg`)
- Case sensitivity matches (`Logo.png` vs `logo.png`)
- Files were actually copied (check `public/images/` in file explorer)

### Issue: Too many duplicate images

**Solution:**
- After copying to `public/`, remove images from root `images/` folder
- Or create symlink: `ln -s public/images images` (for backwards compatibility)

### Issue: Import statements don't work

**Note:** Relative imports like `import logo from './logo.png'` are handled by Vite's bundler - these work fine in both dev and production. This skill is specifically for absolute paths used in `src` attributes like `<img src="/images/logo.png" />`.

## Understanding the Problem (Advanced)

For detailed understanding of how Tauri + Vite handle assets, read the reference documentation:

```bash
cat references/tauri-vite-assets.md
```

The reference document explains:
- Why images work in dev but not production (detailed breakdown)
- Directory structure best practices
- Asset protocol for advanced usage (Tauri-specific resources)
- CSP configuration requirements
- Debugging strategies
- Complete migration checklist

## Resources

### scripts/

Executable Python scripts for image management:

- `audit_images.py` - Scan project and find missing images
  - Recursively scans source files
  - Extracts image references with regex patterns
  - Checks if images exist in public folder
  - Generates detailed report with file references

- `copy_images_to_public.py` - Copy images maintaining directory structure
  - Finds all images in source directory
  - Copies to destination preserving structure
  - Skips duplicates (compares file size)
  - Supports dry-run mode for preview

### references/

- `tauri-vite-assets.md` - Comprehensive documentation on asset handling
  - Explains dev vs production differences
  - Provides directory structure examples
  - Covers Tauri asset protocol
  - Includes troubleshooting guide

### assets/

- `imageAssets.global.test.template.ts` - Vitest test template
  - Drop-in test for image validation
  - Scans entire project automatically
  - Generates audit report
  - Integrates with Vitest/Jest

## Initial Setup (New Project)

For new projects, follow these steps to avoid image issues:

1. Store all images directly in `public/images/` from the start
2. Use absolute paths in code: `<img src="/images/logo.png" />`
3. Create image validation test (copy template from `assets/`)
4. Add test to CI/CD pipeline
5. Run test before each production build

## Fixing Existing Project

For existing projects with broken production images:

1. **Audit**: `python3 scripts/audit_images.py .`
2. **Review**: Check the missing images report
3. **Copy**: `python3 scripts/copy_images_to_public.py images/ public/images/`
4. **Verify**: Run audit again - should show ✅ all found
5. **Test**: Create validation test from template
6. **Build**: `npm run tauri build` and test
7. **Cleanup**: Remove duplicate images from root (optional)

## Related Topics

- Vite static asset handling: https://vitejs.dev/guide/assets.html
- Tauri resource bundling: https://v2.tauri.app/reference/
- CI/CD image validation
- Test-driven development for assets
