---
name: quack-docs-sync
description: This skill should be used when updating, editing, or synchronizing Quack documentation across repositories. Use when modifying guide content, adding new documentation pages, updating images, or syncing changes between quack-app and quackagency-website via the quack-docs Git submodule.
---

# Quack Docs Sync

## Overview

This skill manages the shared documentation system for Quack, which uses a Git submodule architecture to maintain a single source of truth for documentation across multiple projects.

## Architecture

The documentation lives in a dedicated repository and is included as a Git submodule in consuming projects:

```
quack-docs (GitHub: AlekDob/quack-docs)
├── 01-getting-started/
│   ├── introduction.md
│   ├── installation.md
│   └── first-steps.md
├── 02-core-concepts/
├── 03-advanced-techniques/
├── 04-best-practices/
├── images/
│   └── quack-agent.jpeg
├── _meta.json
└── README.md

Submodule locations:
- quack-app/docs/guide/           → quack-docs
- quackagency-website/docs/guide/ → quack-docs
```

## Workflows

### 1. Editing Documentation Content

To edit existing documentation or add new content:

```bash
# Navigate to the submodule in quack-app
cd /Users/alekdob/Desktop/Dev/Personal/quack-app/docs/guide

# Edit files directly here
# The submodule points to the quack-docs repository

# After editing, commit and push from within the submodule
git add .
git commit -m "docs: description of changes"
git push origin main
```

Then update the parent project to reference the new commit:

```bash
# Back in quack-app root
cd /Users/alekdob/Desktop/Dev/Personal/quack-app
git add docs/guide
git commit -m "docs: update quack-docs submodule"
```

### 2. Syncing Changes to quackagency-website (Vercel Deployment)

After pushing changes to quack-docs, sync to quackagency-website for deployment on quack.build:

```bash
# In quackagency-website
cd /Users/alekdob/Desktop/Dev/Personal/quackagency-website/docs/guide
git pull origin main

# Update parent project reference
cd ../..
git add docs/guide
git commit -m "docs: sync quack-docs submodule"
git push origin main
```

**Important**: The push to `quackagency-website` triggers Vercel deployment. Even though there's a webhook from `quack-docs` to Vercel, **you still need to manually sync the submodule** because:

1. The webhook triggers a Vercel rebuild
2. BUT Vercel builds using the current submodule reference in `quackagency-website`
3. The `vercel.json` configuration does `git submodule update --init` (not `--remote`)
4. This means it uses the **committed** submodule reference, not the latest from quack-docs
5. You must manually pull and commit the new submodule reference for Vercel to see the changes

**Vercel Deploy Hook**: Configured at https://vercel.com/alekdohs-projects/quackagency-website/settings/git
- Name: "Docs Update"
- Webhook from quack-docs repository triggers deployment
- GitHub webhook configured at: https://github.com/AlekDob/quack-docs/settings/hooks

### 3. Adding New Documentation Pages

To add a new page to an existing section:

1. Create the markdown file in the appropriate section folder
2. Update the `_meta.json` in that section to include the new page
3. Follow the commit workflow above

Example `_meta.json` structure:
```json
{
  "title": "Getting Started",
  "pages": ["introduction", "installation", "first-steps"]
}
```

### 4. Adding Images

Store all images in the `images/` folder within quack-docs:

```bash
# Copy image to docs
cp /path/to/new-image.png /Users/alekdob/Desktop/Dev/Personal/quack-app/docs/guide/images/

# Reference in markdown
![Description](/images/new-image.png)
```

### 5. Cloning Projects with Submodules

When cloning a project that uses quack-docs:

```bash
# Clone with submodules
git clone --recurse-submodules <repo-url>

# Or if already cloned without submodules
git submodule update --init --recursive
```

## Complete Workflow: Edit → Deploy to quack.build

**Full process from editing docs to seeing changes live on quack.build:**

```bash
# 1. Edit documentation in quack-app
cd /Users/alekdob/Desktop/Dev/Personal/quack-app/docs/guide
# Edit your markdown files...

# 2. Commit and push to quack-docs
git add .
git commit -m "docs: describe your changes"
git push origin main

# 3. Update quack-app submodule reference
cd /Users/alekdob/Desktop/Dev/Personal/quack-app
git add docs/guide
git commit -m "docs: update quack-docs submodule"
git push origin main

# 4. Sync to quackagency-website and trigger Vercel deploy
cd /Users/alekdob/Desktop/Dev/Personal/quackagency-website/docs/guide
git pull origin main
cd ../..
git add docs/guide
git commit -m "docs: sync quack-docs submodule"
git push origin main

# 5. Wait 30-60 seconds for Vercel to rebuild
# Changes will be live at https://quack.build/docs
```

## Quick Reference Commands

| Action | Command |
|--------|---------|
| Edit docs | `cd quack-app/docs/guide && vim <file>` |
| Commit docs | `git add . && git commit -m "msg" && git push` |
| Update quack-app | `cd ../.. && git add docs/guide && git commit -m "update submodule"` |
| Sync to website | `cd quackagency-website/docs/guide && git pull && cd ../.. && git add docs/guide && git commit -m "sync" && git push` |
| Check submodule status | `git submodule status` |
| Force submodule update | `git submodule update --remote --merge` |

## Repository URLs

- **quack-docs**: https://github.com/AlekDob/quack-docs
- **quack-app**: Local at `/Users/alekdob/Desktop/Dev/Personal/quack-app`
- **quackagency-website**: Local at `/Users/alekdob/Desktop/Dev/Personal/quackagency-website`

## Documentation Structure

Each section follows this pattern:
- `_meta.json` - Section metadata with title and page order
- `*.md` files - Individual documentation pages

Content guidelines:
- Use English for all documentation
- Add `---` separators between major sections for visual clarity
- Include images in the shared `images/` folder
- Keep headings hierarchical (H1 > H2 > H3)
