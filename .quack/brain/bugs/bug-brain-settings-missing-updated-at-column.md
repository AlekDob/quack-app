---
type: bug
project: quack-app
created: 2026-01-19
migrated: true
---

# bug-brain-settings-missing-updated-at-column

Bug: Users with old database schema cannot set Second Brain vault path. Error: 'table brain_settings has no column named updated_at'

Root cause: Migration 4 creates brain_settings table with updated_at column, but if the table already exists from an older version, the column is not added

Solution: Added Migration 4.1 that checks if updated_at column exists and adds it with DEFAULT 0 if missing

File: src-tauri/src/brain/db.rs lines 292-297

This ensures backward compatibility for users who installed Quack before this column was added
