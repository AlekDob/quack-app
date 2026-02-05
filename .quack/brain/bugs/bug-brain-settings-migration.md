---
type: bug
project: quack-app
created: 2026-01-17
migrated: true
---

# bug-brain-settings-migration

[2026-01-17] Fixed brain_settings table schema issue. Database had old schema without updated_at column, causing vault_path save to fail. Solution: Recreated table with correct schema (key, value NOT NULL, updated_at) while preserving all 210 entities. Command: sqlite3 ~/.quack/brain/brain.db with backup/drop/recreate/restore flow.
