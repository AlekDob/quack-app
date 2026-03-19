---
type: gotcha
project: quack-app
created: 2026-03-19
last_verified: 2026-03-19
tags: [rust, git, i18n, error-messages]
---
# Git.rs Error Messages Must Be English

## Problem
`src-tauri/src/git.rs` originally had Italian error strings ("Comando git fallito", "Impossibile trovare la directory .git", etc.) mixed with English code. These surfaced in toast notifications and confused non-Italian users.

## Rule
All error messages in Rust backend (`src-tauri/src/`) MUST be in English. The UI layer handles user-facing localization — backend errors are for developers and logs.

## Fixed Strings (2026-03-19)
- `"Comando git fallito"` → `"Git command failed with no output (exit code: X)"`
- `"Il messaggio di commit non può essere vuoto"` → `"Commit message cannot be empty"`
- `"Impossibile determinare la directory corrente"` → `"Failed to determine current directory"`
- `"Impossibile trovare la directory .git"` → `"Could not find .git directory"`
- `"sconosciuto"` → `"unknown"`

## How to Spot
If you see a toast or error log in a non-English language, check the Rust source — it's likely a hardcoded string that escaped review.
