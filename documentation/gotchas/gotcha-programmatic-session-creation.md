---
type: gotcha
project: quack-app
created: 2026-02-24
last_verified: 2026-02-27
tags: [session, automation, agent, sdk, provider, model]
---

# Programmatic Session Creation Pattern

## The Pattern

To programmatically create a session and send a prompt (e.g., from automation, quick actions, or any non-chat trigger):

```ts
// 1. Create the session
const newSession = await createSession({
  title: 'My automated task',
  agentId: targetAgentId,
  projectPath: '/path/to/project',
  projectName: 'my-project',
  status: 'in_progress',
  messageCount: 0,
});

// 2. Send the prompt to trigger the agent
// CRITICAL: Pass model AND provider for non-Anthropic models (Ollama, custom)
sendMessageForTargetAgent(newSession.id, promptText, {
  workingDirectory: '/path/to/project',
  model: job.model,       // e.g. 'kimi-k2.5:cloud'
  provider: job.provider,  // e.g. 'ollama' — WITHOUT this, falls back to global provider
});
```

## Key Details

- `createSession` returns the new session object with its `id`
- `sendMessageForTargetAgent` routes the message to the correct SDK process
- The session appears under the agent in the sidebar automatically
- `status: 'in_progress'` is required so the session shows as active
- `messageCount: 0` is the initial state before the prompt is sent

## Provider Gotcha (2026-02-27)

`sendMessageForTargetAgent` internally calls `getProviderRequestFields()` which reads the **global** provider from `settingsStore`. If the caller needs a different provider (e.g., Ollama model on a job while global is Anthropic), it MUST pass `provider` in the options. Without it, the model ID is resolved via `getModelId()` which only knows Anthropic models, causing a "model not found" error.

See also: `gotcha-automation-job-provider-not-passed.md`

## Common Mistakes

1. Do NOT try to send the message before `createSession` resolves. The session ID is needed to route the message to the correct agent process.
2. Do NOT pass only `model` without `provider` for non-Anthropic models — the model string alone is ambiguous.
3. After `sendMessageForTargetAgent` completes, save `response.session_id` as `claudeSessionId` in the session store for resume support.

## Used By

- Automation layer (`handleAutomationFireJob` + scheduler tick in App.tsx)
- Remote execute handler (App.tsx)
- Could be reused for: scheduled tasks, webhook triggers, CLI commands
