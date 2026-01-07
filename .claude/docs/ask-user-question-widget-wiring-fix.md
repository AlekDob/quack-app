# AskUserQuestion Widget Wiring Fix

**Date**: 2025-01-05
**Issue**: AskUserQuestion tool showing as raw JSON instead of interactive widget
**Status**: Fixed

## Problem

The `AskUserQuestion` tool was displaying as raw JSON in a grey box instead of as an interactive widget with clickable options. The agent would then duplicate the questions in readable format.

**Root Cause**: The widget component (`AskUserQuestionWidget.tsx`) and its CSS (`AskUserQuestionWidget.css`) were already fully implemented and styled, but the **wiring was incomplete** - the necessary props were not being passed through the component hierarchy from `App.tsx` to `StreamMessage.tsx`.

## Solution

The fix involved passing three props through the component chain:

1. `onUserQuestionAnswer` - Callback to submit answers
2. `pendingQuestionIds` - Set of tool IDs with pending questions
3. `answeredQuestions` - Map of already answered questions

### Files Modified

1. **`src/App.tsx`**
   - Added `AskUserQuestionAnswers` type import
   - Added state for tracking pending/answered questions per agent:
     ```typescript
     const [pendingQuestionIdsMap, setPendingQuestionIdsMap] = useState<Map<string, Set<string>>>(new Map());
     const [answeredQuestionsMap, setAnsweredQuestionsMap] = useState<Map<string, Map<string, AskUserQuestionAnswers>>>(new Map());
     ```
   - Created `answerUserQuestionForAgent` callback that:
     - Validates active session
     - Updates UI state immediately for feedback
     - Formats answers as tool result
     - Calls `sendToolResult` via dynamic import
     - Handles errors with rollback
   - Passed props to `<ChatView />`:
     ```tsx
     onUserQuestionAnswer={answerUserQuestionForAgent}
     pendingQuestionIds={pendingQuestionIdsMap.get(activeId) || new Set()}
     answeredQuestions={answeredQuestionsMap.get(activeId) || new Map()}
     ```

2. **`src/components/ChatView.tsx`**
   - Added `AskUserQuestionAnswers` import
   - Added props to interface and destructuring:
     ```typescript
     onUserQuestionAnswer?: (toolUseId: string, answers: AskUserQuestionAnswers) => void;
     pendingQuestionIds?: Set<string>;
     answeredQuestions?: Map<string, AskUserQuestionAnswers>;
     ```
   - Passed props to `<MessageList />`

3. **`src/components/MessageList.tsx`**
   - Added `AskUserQuestionAnswers` import
   - Added props to interface and function parameters
   - Passed props to `<ChatMessage />`

4. **`src/components/ChatMessage.tsx`**
   - Added `AskUserQuestionAnswers` import
   - Added props to interface and function parameters
   - Passed props to `<StreamMessage />`:
     ```tsx
     onUserQuestionAnswer={onUserQuestionAnswer}
     pendingQuestionIds={pendingQuestionIds}
     answeredQuestions={answeredQuestions}
     ```

### Component Hierarchy

```
App.tsx (state + answerUserQuestionForAgent)
  └─> ChatView.tsx (passes props)
        └─> MessageList.tsx (passes props)
              └─> ChatMessage.tsx (passes props)
                    └─> StreamMessage.tsx (renders widget)
                          └─> AskUserQuestionWidget.tsx (interactive UI)
```

### Backend Integration

The `sendToolResult` function in `src/services/claudeSDK.ts` (already existing) is used to send the formatted answer back to the Claude SDK:

```typescript
await sendToolResult(sessionId, toolUseId, formattedAnswer, workingDirectory);
```

## Testing

- Build passes: `npm run build` ✅
- No new test failures introduced
- Existing tests pass (56 passed, some pre-existing failures unrelated to this change)

## Widget Features (Already Implemented)

The `AskUserQuestionWidget` component includes:
- Glassmorphism dark theme design
- Radio buttons (single select) / Checkboxes (multi select)
- "Other" option with text input
- Visual feedback for selected options
- Disabled state when answered
- "Answered" badge display
- Keyboard accessible
- Smooth animations

## Usage

Claude can now use the `AskUserQuestion` tool and users will see an interactive widget where they can click options and submit answers directly, instead of raw JSON.

```typescript
// Example tool call from Claude
{
  type: 'tool_use',
  name: 'AskUserQuestion',
  input: {
    questions: [{
      question: "Which database should I use?",
      header: "Database",
      options: [
        { label: "PostgreSQL", description: "Relational, ACID-compliant" },
        { label: "MongoDB", description: "Document-based" }
      ],
      multiSelect: false
    }]
  }
}
```
