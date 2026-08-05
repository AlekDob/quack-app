---
type: feature-doc
project: synara
stack: React / Vite / TypeScript
created: 2026-08-03
startDate: 2026-08-03
endDate:
last_verified: 2026-08-03
status: active
tags: [pending-user-input, composer, elicitation, other-option]
---

## Pending User Input

**Purpose:** Composer UI that collects answers to provider `user-input.requested` questions (single/multi select + free text).
**Stack:** React / TypeScript (apps/web)

### Files

| Type      | Path                                                             | Exports/Purpose                                          |
| --------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| Component | `apps/web/src/components/chat/ComposerPendingUserInputPanel.tsx` | Detached question card; option rows + synthetic Other    |
| Component | `apps/web/src/components/chat/ComposerChoiceRow.tsx`             | Shared numbered choice row                               |
| Component | `apps/web/src/components/ChatView.tsx`                           | Draft state, submit/advance, Other → composer focus      |
| Util      | `apps/web/src/pendingUserInput.ts`                               | Draft normalize, Other selection, progress, answer build |
| Util      | `apps/web/src/session-logic.ts`                                  | `derivePendingUserInputs` from activities/interactions   |
| Util      | `apps/web/src/pendingInteractionDerivation.ts`                   | Pending interaction lifecycle for user-input requests    |
| Test      | `apps/web/src/pendingUserInput.test.ts`                          | Draft/Other/progress unit coverage                       |

### Data Flow

`user-input.requested` activity → `derivePendingUserInputs` → `ComposerPendingUserInputPanel` → draft answers (`preferCustomAnswer` / options / custom text) → `buildPendingUserInputAnswers` → `thread.user-input.respond`

### Key Functions

- `questionProvidesOtherOption(question) → boolean` — skip synthetic Other if provider already sent Other/Altro
- `selectPendingUserInputOtherAnswer(draft) → Draft` — mark Other without submitting a label
- `setPendingUserInputCustomAnswer(draft, text) → Draft` — keep Other mode; clear presets when typing
- `togglePendingUserInputOptionSelection(question, draft, label) → Draft` — preset select; clears Other
- `resolvePendingUserInputAnswer(question, draft) → string \| string[] \| null` — custom wins; empty Other = unanswered
- `derivePendingUserInputProgress(questions, drafts, index) → Progress` — active question + canAdvance/usingCustomAnswer

### State

- `pendingUserInputAnswersByRequestId`: `Record<requestKey, Record<questionId, Draft>>` — per-request drafts (ChatView)
- `preferCustomAnswer`: `boolean` — Other selected; may still have empty `customAnswer` (draft)
- `usingCustomAnswer`: `boolean` — UI treats path as free-text (progress)

### Behavior

- Synthetic **Other** row appended when options exist and none already match `other|altro|something else`
- Selecting Other: no auto-advance; focuses composer; Submit disabled until text typed
- Digit shortcut: next number after last provider option selects Other
- Free-text answer is submitted as the question answer string (never the literal `"Other"`)
