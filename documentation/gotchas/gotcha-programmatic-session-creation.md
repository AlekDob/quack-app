---
type: gotcha
project: quack-app
created: 2026-02-24
last_verified: 2026-02-24
tags: [session, automation, agent, sdk]
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
sendMessageForTargetAgent(newSession.id, promptText, {
  workingDirectory: '/path/to/project',
});
```

## Key Details

- `createSession` returns the new session object with its `id`
- `sendMessageForTargetAgent` routes the message to the correct SDK process
- The session appears under the agent in the sidebar automatically
- `status: 'in_progress'` is required so the session shows as active
- `messageCount: 0` is the initial state before the prompt is sent

## Common Mistake

Do NOT try to send the message before `createSession` resolves. The session ID is needed to route the message to the correct agent process.

## Used By

- Automation layer (`handleAutomationFireJob` in App.tsx)
- Could be reused for: scheduled tasks, webhook triggers, CLI commands
