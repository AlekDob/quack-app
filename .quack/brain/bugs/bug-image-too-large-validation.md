---
type: bug
project: quack-app
created: 2026-01-09
migrated: true
---

# bug-image-too-large-validation

[2026-01-09] Fixed "Image was too large" error from Claude SDK

Root cause: Frontend allowed 15MB files but Claude API only accepts 5MB, and no pixel dimension validation existed

Fix: Changed MAX_FILE_SIZE from 15MB to 5MB in ChatInput.tsx

Added validateImageDimensions() function to check images don't exceed 8000x8000 pixels

Claude API limits: 5MB file size, 8000x8000 max pixels, 1568px recommended for performance

Validation runs on: file attach, paste from clipboard, drag & drop from Finder

Updated error messages to show correct "5MB (Claude API limit)" message
