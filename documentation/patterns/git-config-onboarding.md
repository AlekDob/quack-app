---
type: pattern
created: 2026-02-09
tags: [git, onboarding, first-run, windows, macos]
---

# Pattern: Git Config Onboarding (First-Run Setup)

## Overview

Sistema di onboarding obbligatorio che verifica e configura `user.name` e `user.email` di Git durante il primo avvio di Quack, sia su macOS che su Windows.

## Architecture

### 1. Backend (Rust)

**File**: `src-tauri/src/git.rs`

Two Tauri commands: `git_get_user_config()` and `git_set_user_config(name, email)` using `git config --global`.

### 2. Frontend State Management

**File**: `src/stores/gitConfigStore.ts`

Zustand store with `hasCompletedOnboarding`, `userConfig`, `isChecking` state. Auto-completes if Git config already set.

### 3. UI Component

**File**: `src/components/settings/GitConfigOnboarding.tsx`

- Form with 2 fields: Full Name and Email Address
- Validation: nome non vuoto, email contiene `@`
- No skip button (mandatory)
- `z-index: 10002` (higher than IDE onboarding)

### 4. Integration

In `src/App.tsx`: `<GitConfigOnboarding />` renders BEFORE `<IDEOnboarding />`.

## User Flow

1. First app launch
2. GitConfigOnboarding overlay appears
3. Checks if user.name and user.email are configured
4. If NO -> shows form (mandatory)
5. User fills name and email
6. Continue -> saves to Git config global
7. Overlay closes -> IDEOnboarding appears next

## Debug Panel Testing

- **Show**: Instant, no restart needed
- **Reset**: Permanent, requires restart
- `manuallyReset` flag prevents auto-complete after reset

## Related Patterns

- `pattern-sequential-onboarding-system.md`
- `pattern-prerequisites-check-onboarding.md`
