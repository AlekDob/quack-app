# Recap: Claude Authentication Recovery

> Scope: Claude authentication recovery in the web chat.

## Summary

When Claude is not logged in, the transcript now shows a focused recovery card. The user can open a terminal in the thread workspace and run the required Claude login command. The old thread error banner and duplicate error message are hidden while this card is active.

## User flow

1. A Claude turn fails with the canonical unauthenticated message.
2. Quack adds a `Sign in to Claude` card at the end of the transcript.
3. The user selects `Sign in to Claude`.
4. Quack opens the terminal drawer and runs `claude auth login --claudeai` in the resolved thread workspace.
5. The card changes to `Opening terminal…`, then `Open login terminal` after the command is accepted.
6. The user dismisses the card after completing login, then retries the turn.

## Implementation

- `apps/web/src/lib/claudeAuthRecovery.ts` owns the command, canonical error text, row key, and provider/error guard.
- `apps/web/src/components/chat/ClaudeAuthRecoveryCard.tsx` renders the idle, opening, open, failed, dismissed, and unavailable states.
- `MessagesTimeline.logic.ts` adds a dedicated row outside collapsed work items. This keeps the action visible without changing ordinary message grouping.
- `ChatView.tsx` owns terminal creation and recovery state. States are keyed by thread and latest turn, so separate failures do not share terminal ids or launch errors.
- A missing thread workspace disables the action and explains why. Terminal-launch errors stay on the card instead of being lost in the transcript.

## Tests

The focused suite covers:

- canonical Claude authentication error matching;
- card opening and open states;
- placement of the recovery row after the transcript.

Command used:

```sh
bun run --cwd apps/web test -- ClaudeAuthRecoveryCard.test.tsx claudeAuthRecovery.test.ts MessagesTimeline.logic.test.ts
```

Result: 3 test files passed, 72 tests passed.
