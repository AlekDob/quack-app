---
type: gotcha
project: quack-app
created: 2026-03-08
last_verified: 2026-03-08
tags: [quack-store, marketplace, registry, resource-id]
---

# Marketplace Resource ID Format

## The Gotcha

The resource ID in the installed registry uses the **plugin name** (from `marketplace.json`), NOT the resource's own name. These can differ.

## Example

Plugin `flutter-developer` contains a skill named `flutter-state`. The resource ID is:

- Correct: `flutter-developer--skill--flutter-state`
- Wrong: `flutter-state--skill--flutter-state`

## Why It Matters

If you manually create or modify the registry (`~/.claude/plugins/quack-installed.json`) with the wrong ID format, the store won't match it against the remote resource, and:
- "Installed" badge won't appear
- Update detection fails silently

## How It's Built

In `useMarketplace.ts`, the ID is constructed from the marketplace data:

```
resourceId = `${plugin.name}--${resource.type}--${resource.name}`
```

Where `plugin.name` comes from the plugin's entry in `marketplace.json`, not from the resource metadata itself.

## Prevention

Always check `marketplace.json` for the plugin name when debugging registry issues. Never assume the plugin name matches the resource name.
