---
type: pattern
project: quack-app
created: 2026-02-24
last_verified: 2026-02-24
tags: [automation, cron, scheduler, sessions, rust, tauri]
---

# Automation Layer - Scheduled Agent Sessions

Quack's automation system allows users to schedule recurring agent sessions via cron jobs.

## Architecture

```
Rust Scheduler (tokio 30s tick + cron crate)
  --> emits `automation-scheduler-tick` Tauri event
  --> React listener checks all enabled jobs' `nextRunAt`
  --> If a job is due: `handleAutomationFireJob`
    --> creates AgentSession via `createSession()`
    --> sends prompt via `sendMessageForTargetAgent(sessionId, prompt, { workingDirectory })`
    --> session appears under the agent in the sidebar
```

## Storage

- File: `quack-automations.json` (Tauri Store JSON)
- Follows the same pattern as `unifiedAgentStorage.ts`
- Zustand store: `automationStore.ts` with devtools middleware

## Key Types (src/types.ts)

```ts
interface AutomationJob {
  id: string;
  name: string;
  agentId: string;
  projectPath: string;
  cronExpression: string;
  prompt: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AutomationRunHistory {
  id: string;
  jobId: string;
  sessionId: string;
  startedAt: string;
  status: 'running' | 'completed' | 'failed';
}
```

## Rust Side (src-tauri/src/automation.rs)

- Uses `cron = "0.12"` crate for expression parsing
- Tokio interval loop (30s tick) emits event to frontend
- Module-level doc comments use `//!` (Rust convention)
- Timestamps use `chrono::Local` (user's Mac timezone, not UTC)

## Frontend Components

| Component | Purpose |
|-----------|---------|
| `AutomationView` | Main view with job list + history |
| `AutomationJobCard` | Individual job card with enable/disable toggle |
| `AutomationJobForm` | Modal form for creating/editing jobs |
| `CronPresetInput` | Cron expression input with presets (daily, weekday, weekly, monthly) |
| `AutomationHistoryList` | Run history timeline |
| `AutomationTabView` | Tab wrapper (follows `useKanbanTab` pattern) |

## Tab Integration

- Singleton hook: `useAutomationTab` (same pattern as `useKanbanTab`)
- ActionIcons: clock SVG with cyan badge for running job count
- Keyboard shortcut: Cmd+J
- Tab type: `'automation'` in TabBar union

## Files

**New (12):** automation.rs, AutomationView.tsx/.css, AutomationJobCard.tsx, AutomationJobForm.tsx, CronPresetInput.tsx, AutomationHistoryList.tsx, useAutomationTab.ts, automationStorage.ts, cronUtils.ts, automationStore.ts, AutomationTabView.tsx

**Modified (7):** types.ts, TabBar.tsx, ActionIcons.tsx, App.tsx, shortcutsStorage.ts, lib.rs, Cargo.toml
