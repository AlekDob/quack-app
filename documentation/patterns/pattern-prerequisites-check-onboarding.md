---
type: pattern
created: 2026-02-09
tags: [onboarding, prerequisites, git, nodejs, claude-cli, windows, macos]
---

# Pattern: Prerequisites Check Onboarding

## Overview

Sistema di verifica prerequisiti che controlla l'installazione di Git, Node.js e Claude CLI prima del primo avvio di Quack. Appare come PRIMO step dell'onboarding (z-index: 10003).

## Architecture

### Ordine Onboarding

```
1. PrerequisitesCheck (z-index: 10003) -> PRIMO
2. GitConfigOnboarding (z-index: 10002) -> SECONDO
3. IDEOnboarding (z-index: 10001) -> TERZO
```

### Backend (Rust)

**File**: `src-tauri/src/prerequisites.rs`

- `check_prerequisites()` -- checks Git, Node.js, Claude CLI
- `install_claude_cli()` -- runs `npm install -g @anthropic-ai/claude-code`

### Frontend

**Store**: `src/stores/prerequisitesStore.ts` -- Zustand with auto-complete if all installed.

**Component**: `src/components/settings/PrerequisitesCheck.tsx` -- auto-check on mount, status icons, download links, install button for Claude CLI, re-check button.

## User Flow

1. First launch -> PrerequisitesCheck appears
2. Auto-checks Git, Node.js, Claude CLI
3. All installed -> auto-complete, skip to GitConfigOnboarding
4. Something missing -> show download links / install buttons
5. User installs manually -> click "Re-check"
6. Click "Continue" (enabled only when all_installed)

## Key Features

- Auto-Install Claude CLI via npm
- Smart Continue button (enabled only when all_installed)
- Re-check button for manual installations
- Cross-platform (macOS + Windows)
- Claude CLI detection: `claude --version` primary, `npm list -g` fallback
