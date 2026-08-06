---
name: bump-version
description: Use whenever the user asks to bump/raise the app version, prepare a release (e.g. "aumenta la versione", "prepara la release 2.1.0", "bump version", "release time"), or update the changelog / "What's new" popup. Bumps apps/web/package.json and writes a matching curated entry in apps/web/src/whatsNew/entries.ts by grouping the commits since the last release. Also use if the user reports the "What's new" dialog isn't showing after an update — a version mismatch between package.json and entries.ts is the most likely cause.
---

# Bump version

Quack's version lives in exactly one place: `apps/web/package.json#version`. Vite mirrors it into
`import.meta.env.APP_VERSION` at build time (see `apps/web/vite.config.ts`), and `branding.ts` reads
that env var. So there is nothing else to edit for the version number itself — just `package.json`.

The part that actually takes judgment is `apps/web/src/whatsNew/entries.ts`: the post-update "What's
new" popup only appears for a release if there's a curated entry there whose `version` string matches
`package.json` **exactly** (see `whatsNew/logic.ts` — `resolveWhatsNewState` does a plain string/semver
compare). Get that wrong — extra zero, wrong format — and the dialog silently never shows for that
release. No error, no warning, it just doesn't appear. Double-check this before finishing.

## Steps

1. **Find the last release.** Run `git tag --sort=-creatordate | head -1` and `git log --oneline
<last-tag>..HEAD` (or, if tags are stale/absent, look at the most recent `version:` entry in
   `entries.ts` and log from around that commit) to see everything that shipped since. Read the actual
   diffs/commit messages, not just titles — you need to know what a feature _does_ to write about it
   well.

2. **Bump `apps/web/package.json#version`.** Decide major/minor/patch based on what shipped (ask the
   user if it's ambiguous — this is a judgment call, not something to guess silently).

3. **Group commits into features, don't list commits.** A release usually has 5-15 commits but should
   read as 3-9 features in the changelog. Merge small related fixes into one entry (e.g. three commits
   fixing edge cases in the same picker become one "X is more reliable" entry). Skip pure chores,
   internal refactors, and test-only commits — the changelog is for users, not a commit log. Look at
   the existing entries in `entries.ts` for the tone: everyday language, feature-first, no internal
   jargon or file names.

4. **Prepend a new entry to `WHATS_NEW_ENTRIES`** in `apps/web/src/whatsNew/entries.ts` (top of the
   array — the array is newest-first even though the UI re-sorts anyway, so keep it tidy for reviewers).
   Each entry:

   ```ts
   {
     version: "2.1.0",       // MUST match package.json exactly
     date: "Aug 12",         // human-readable, whatever format, just stay consistent
     features: [
       {
         id: "stable-kebab-id",       // unique, stable — used as a React key, never reuse
         title: "Short, benefit-first title",
         description: "One plain-language sentence: what changed and why the user cares.",
         details: "Longer technical note shown when expanded — can mention the actual mechanism, " +
           "what it reuses, what it doesn't change. This is where it's fine to sound like an engineer.",
       },
       // 3-9 features total
     ],
   },
   ```

   `image`/`heroImage` fields exist but are optional — skip them unless the user supplies a screenshot.

5. **Verify the version match.** Re-read the `version` field you just wrote against
   `apps/web/package.json` character for character. This is the one step that's silently wrong if
   skipped.

6. **Run the project's required checks** before calling this done: `bun fmt`, `bun lint`, `bun
typecheck` (per the project's `CLAUDE.md` — bundle them into one pass rather than rerunning
   individually).

## Why this exists

This exact workflow was done well once by hand (see commit `327e548b8`, "chore: prepare 2.0.0
release") with no dedicated skill — the only trace of the convention was a comment at the top of
`entries.ts`. This skill just makes that repeatable instead of relying on an agent noticing the
comment.
