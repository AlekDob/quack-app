---
type: gotcha
project: quack-app
created: 2026-02-27
last_verified: 2026-02-27
tags: [automation, provider, ollama, model, bug-fix]
---

# Automation Job Does Not Pass Provider to Session

## Trigger

Creating an automation job with an Ollama model (e.g., `kimi-k2.5:cloud`) and firing it. The session starts with the wrong model (e.g., Opus 4.6) or shows a "model not found" error.

## Root Cause

The `AutomationJob` type originally had `model?: string` but no `provider` field. When the job fired, `sendMessageForTargetAgent` called `getProviderRequestFields()` which reads the **global** provider from `settingsStore.claude.provider`. If the global provider was `anthropic`, it tried to resolve `kimi-k2.5:cloud` as an Anthropic model and failed.

Two independent issues:
1. **`handleAutomationFireJob`** (manual fire) — did not pass `model` or `provider` to `sendMessageForTargetAgent`
2. **Scheduler tick listener** (cron fire) — same missing fields, duplicated code path

## Fix (2026-02-27)

1. Added `provider?: LLMProviderType` to `AutomationJob` interface (`types.ts`)
2. `AutomationJobForm` now saves `provider: jobProvider` alongside `model`
3. `ChatSendOptions` now accepts `provider?: LLMProviderType`
4. `sendMessageForTargetAgent` checks `options.provider`: if non-anthropic, uses model ID directly (no `resolveModel`) and sets provider fields from settings
5. Both fire paths (manual + scheduler) pass `model` and `provider` from the job

## Key Insight

Any feature that programmatically creates sessions (automation, remote execute, webhooks) must pass **both model AND provider**. The model string alone is ambiguous — `kimi-k2.5:cloud` could be Ollama or Custom. Always persist provider alongside model.

## Duplication Warning

The automation fire logic is duplicated in App.tsx:
- `handleAutomationFireJob` (~line 9163) — manual "Fire Now" button
- Scheduler tick listener (~line 9251) — automatic cron fire

Both do: `inject personality → createSession → sendMessageForTargetAgent`. Any fix must be applied to BOTH. Consider extracting a shared `executeAutomationJob()` function.

## Files

- `src/types.ts` — `AutomationJob.provider` field
- `src/hooks/useClaudeChat.ts` — `ChatSendOptions.provider` field
- `src/components/automation/AutomationJobForm.tsx` — saves provider with job
- `src/App.tsx` — both fire paths + `sendMessageForTargetAgent` provider override logic
- `src/services/claudeSDK.ts` — `getProviderRequestFields()` reference
