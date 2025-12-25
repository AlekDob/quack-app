# AskUserQuestion Tool Integration

**Status:** Implemented
**SDK Version Required:** 0.1.71+
**Date:** 2024-12-24

## Overview

The AskUserQuestion tool enables the Claude agent to ask interactive questions to users during task execution. This creates a bidirectional conversation flow where the agent can gather preferences, clarify ambiguities, or offer implementation choices.

## How It Works

### User Flow

1. User asks agent to do something requiring a decision
2. Agent uses `AskUserQuestion` tool with structured options
3. Widget appears **inline** in the chat with selectable options
4. User selects option(s) or provides custom "Other" response
5. User clicks "Submit Answer"
6. Agent receives response and continues execution

### Technical Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  StreamMessage.tsx                                               │
│   └─ Detects tool_use with name='askuserquestion'               │
│       └─ Renders AskUserQuestionWidget                          │
│                     │                                            │
│                     ▼                                            │
│  AskUserQuestionWidget.tsx                                       │
│   ├─ Displays questions with radio/checkbox options             │
│   ├─ Handles "Other" free text input                            │
│   └─ onSubmit → calls useClaudeChat.answerUserQuestion()        │
│                     │                                            │
│                     ▼                                            │
│  useClaudeChat.ts                                                │
│   └─ answerUserQuestion(toolUseId, answers)                     │
│       ├─ Updates answeredQuestions state                        │
│       └─ Calls sendToolResult()                                 │
│                     │                                            │
│                     ▼                                            │
│  claudeSDK.ts                                                    │
│   └─ sendToolResult(sessionId, toolUseId, result)               │
│       └─ invoke('send_tool_result_to_sdk', {...})               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Tauri IPC
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Rust + Node.js)                    │
├─────────────────────────────────────────────────────────────────┤
│  claude_cli.rs                                                   │
│   └─ send_tool_result_to_sdk()                                  │
│       ├─ Builds tool_result JSON                                │
│       └─ Spawns Node.js with --tool-result flag                 │
│                     │                                            │
│                     ▼                                            │
│  stream-claude.js                                                │
│   └─ Sends tool_result to Claude Agent SDK                      │
│       └─ Conversation resumes with user's answer                │
└─────────────────────────────────────────────────────────────────┘
```

## Files Modified

### New Files

| File | Purpose |
|------|---------|
| `src/components/AskUserQuestionWidget.tsx` | Interactive React component |
| `src/components/AskUserQuestionWidget.css` | Glassmorphism styling |

### Modified Files

| File | Changes |
|------|---------|
| `src/services/claudeSDK.ts` | Added `AskUserQuestion` to allowedTools, added `sendToolResult()` function |
| `src/types.ts` | Added TypeScript types for AskUserQuestion |
| `src/components/StreamMessage.tsx` | Added widget rendering for askuserquestion tool |
| `src/hooks/useClaudeChat.ts` | Added `answerUserQuestion()`, `pendingQuestionIds`, `answeredQuestions` |
| `src-tauri/src/claude_cli.rs` | Added `send_tool_result_to_sdk` command |
| `src-tauri/src/lib.rs` | Registered new Tauri command |

## TypeScript Types

```typescript
// A single option in a question
interface AskUserQuestionOption {
  label: string;       // Display text (1-5 words)
  description: string; // Explanation of this choice
}

// A single question
interface AskUserQuestion {
  question: string;    // Full question text (ends with ?)
  header: string;      // Short label (max 12 chars)
  options: AskUserQuestionOption[]; // 2-4 options
  multiSelect: boolean; // true = checkbox, false = radio
}

// Input from the SDK
interface AskUserQuestionInput {
  questions: AskUserQuestion[]; // 1-4 questions
}

// User's answers
interface AskUserQuestionAnswers {
  [questionHeader: string]: string | string[];
}
```

## Widget Features

### Selection Modes
- **Single Select (radio):** User picks exactly one option
- **Multi Select (checkbox):** User can pick multiple options

### "Other" Option
- Every question automatically includes an "Other" option
- When selected, shows a text input for custom response
- Submitted as `"Other: <user text>"`

### States
- **Pending:** Purple theme, interactive, waiting for user
- **Answered:** Green theme, disabled, shows what was selected

### Styling
- Glassmorphism design consistent with Quack
- Purple accent color (#8b5cf6)
- Slide-in animation on appear
- Responsive layout

## Usage Examples

### Agent Asking About Database Choice

The agent might call:
```json
{
  "type": "tool_use",
  "name": "AskUserQuestion",
  "input": {
    "questions": [{
      "question": "Which database should we use for this project?",
      "header": "Database",
      "options": [
        { "label": "PostgreSQL", "description": "Relational, great for complex queries" },
        { "label": "MongoDB", "description": "Document-based, flexible schema" },
        { "label": "SQLite", "description": "Embedded, zero config, good for prototypes" }
      ],
      "multiSelect": false
    }]
  }
}
```

### Agent Asking About Features to Enable

```json
{
  "type": "tool_use",
  "name": "AskUserQuestion",
  "input": {
    "questions": [{
      "question": "Which features do you want to enable?",
      "header": "Features",
      "options": [
        { "label": "Dark Mode", "description": "Enable dark theme support" },
        { "label": "Analytics", "description": "Track user behavior" },
        { "label": "Notifications", "description": "Real-time user alerts" },
        { "label": "i18n", "description": "Multi-language support" }
      ],
      "multiSelect": true
    }]
  }
}
```

## Configuration

### Enabling the Tool

The tool is enabled by default in `src/services/claudeSDK.ts`:

```typescript
allowedTools: [
  // ... other tools
  'AskUserQuestion', // Interactive questions to user
]
```

### Timeout Behavior

Currently configured with **no timeout** - the agent waits indefinitely for user response. This ensures the user is never rushed and can take their time to make decisions.

## Testing

To test the feature:

1. Start Quack in development mode
2. Ask the agent something that requires a choice:
   - "Help me choose a CSS framework for this project"
   - "What authentication method should we use?"
   - "Which features should I implement first?"
3. The agent should use AskUserQuestion
4. Select options and click "Submit Answer"
5. Verify the agent continues with your choice

## Known Limitations

1. **Backend Persistence:** The Node.js process for handling tool results is spawned fresh each time. For long conversations, consider session persistence improvements.

2. **No Cancel:** Once a question is shown, there's no way to cancel/skip it. The agent will wait for an answer.

3. **Single Question Flow:** While the SDK supports 1-4 questions per call, most agents send one at a time for better UX.

## Future Improvements

- [ ] Add unit tests for AskUserQuestionWidget
- [ ] Add keyboard navigation (Enter to submit, Tab between options)
- [ ] Add optional timeout with default answer
- [ ] Add "Skip" button for non-critical questions
- [ ] Persist pending questions across page refresh
