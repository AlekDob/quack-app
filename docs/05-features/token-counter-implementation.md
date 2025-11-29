# Token Counter Implementation Guide

## 📋 Overview

This document provides a comprehensive implementation guide for adding a **real-time token usage indicator** to the Quack AI chat interface. The indicator will show users how many tokens they've consumed in the current session (out of 200k available) and warn them when they need to compact or clear the conversation.

---

## 🎯 Objectives

1. **Display token usage** next to the chat input in real-time
2. **Visual progress indicator** with color-coded states (green → yellow → orange → red)
3. **Warning system** at 75%, 90%, and 95% thresholds
4. **Interactive tooltip** with detailed breakdown (input/output/cache tokens)
5. **Quick actions** for `/compact` and `/clear` commands when approaching limits

---

## 📊 Current State Analysis

### Existing Token Tracking

The app **already tracks tokens** in several places:

1. **`src/services/claudeSDK.ts`** (lines 76-87):
   ```typescript
   export interface ClaudeSDKStreamEvent {
     type: 'event' | 'complete' | 'error';
     event?: ClaudeEvent;
     error?: string;
     result?: {
       text: string;
       usage: {
         input_tokens: number;
         output_tokens: number;
       };
     };
   }
   ```

2. **`src/hooks/useClaudeChat.ts`** (lines 96-129):
   - Processes streaming events and captures usage data
   - Events contain `usage` data with `input_tokens` and `output_tokens`

3. **`src/components/StreamMessage.tsx`** (lines 281-285, 322-326):
   - Already displays token usage in result messages
   - Shows format: `Tokens: X (Y in, Z out)`

4. **`src/components/UsagePanel.tsx`**:
   - Full-featured usage tracking panel
   - Tracks sessions, daily usage, agent usage
   - Already has helper functions: `formatTokens()` (line 188)

### What's Missing

We need to:
1. **Track cumulative tokens** for the current session in real-time
2. **Display a compact indicator** near the chat input (not just in result messages)
3. **Warn users** before hitting the 200k limit
4. **Provide quick actions** to manage context window

---

## 🏗️ Implementation Plan

### Phase 1: Create Token Usage Indicator Component

**File**: `src/components/TokenUsageIndicator.tsx`

**Features**:
- Compact visual indicator showing `X / 200k tokens`
- Color-coded progress bar based on percentage
- Click to expand tooltip with detailed breakdown
- Pulse animation when approaching limits

**Props**:
```typescript
interface TokenUsageIndicatorProps {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  maxTokens?: number; // default: 200000
  onCompact?: () => void;
  onClear?: () => void;
}
```

**Visual States**:
| Percentage | Color | State | Action Needed |
|------------|-------|-------|---------------|
| 0-50% | Green (`#10B981`) | Safe | None |
| 50-75% | Yellow (`#EAB308`) | Caution | Monitor |
| 75-90% | Orange (`#F59E0B`) | Warning | Consider `/compact` |
| 90-95% | Red (`#EF4444`) | Critical | Use `/compact` now |
| 95-100% | Red pulsing | Danger | Use `/clear` immediately |

**Layout** (collapsed):
```
💬 45.2k / 200k ████████░░░░
```

**Layout** (expanded tooltip):
```
┌─────────────────────────────────┐
│ Token Usage                     │
├─────────────────────────────────┤
│ Input:           42,156 (93%)   │
│ Output:           3,044 (7%)    │
│ Cache Created:      512         │
│ Cache Read:       1,024         │
├─────────────────────────────────┤
│ Total: 45,200 / 200,000 (22.6%) │
├─────────────────────────────────┤
│ [Compact] [Clear]               │
└─────────────────────────────────┘
```

---

### Phase 2: Add Session Token Tracking to useClaudeChat

**File**: `src/hooks/useClaudeChat.ts`

**Changes**:

1. Add state for tracking cumulative tokens:
```typescript
const [sessionTokens, setSessionTokens] = useState({
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
});
```

2. Update token tracking in the streaming loop (around line 96-129):
```typescript
for await (const chunk of stream) {
  if (chunk.type === 'event' && chunk.event) {
    const event = chunk.event;
    events.push(event);

    // Track cumulative usage from result events
    if (event.type === 'result' && event.usage) {
      setSessionTokens(prev => ({
        inputTokens: prev.inputTokens + (event.usage?.input_tokens || 0),
        outputTokens: prev.outputTokens + (event.usage?.output_tokens || 0),
        cacheCreationTokens: prev.cacheCreationTokens + (event.usage?.cache_creation_input_tokens || 0),
        cacheReadTokens: prev.cacheReadTokens + (event.usage?.cache_read_input_tokens || 0),
      }));
    }
  }
}
```

3. Reset tokens on clear conversation:
```typescript
const clearConversation = useCallback(() => {
  setMessages([]);
  setSessionTokens({
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  });
  claudeSessionId.current = undefined;
}, []);
```

4. Export session tokens:
```typescript
return {
  messages,
  isLoading,
  sendMessage,
  clearConversation,
  // ... existing exports
  sessionTokens, // 🆕 NEW
};
```

---

### Phase 3: Integrate TokenUsageIndicator into ChatView

**File**: `src/components/ChatView.tsx`

**Changes**:

1. Import the new component:
```typescript
import TokenUsageIndicator from './TokenUsageIndicator';
```

2. Receive sessionTokens from parent:
```typescript
interface ChatViewProps {
  // ... existing props
  sessionTokens?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  };
}
```

3. Add handlers for quick actions:
```typescript
const handleCompact = () => {
  // Trigger /compact command
  handleSend('/compact');
};

const handleClear = () => {
  if (window.confirm('Are you sure you want to clear the conversation? This cannot be undone.')) {
    onClearConversation?.();
  }
};
```

4. Update the footer layout (around line 137-161):
```typescript
<div className="chat-view-footer">
  <div className="chat-view-footer-controls">
    <ChatSettingsMenu ... />

    {/* 🆕 ADD TOKEN USAGE INDICATOR HERE */}
    {sessionTokens && (
      <TokenUsageIndicator
        inputTokens={sessionTokens.inputTokens}
        outputTokens={sessionTokens.outputTokens}
        cacheCreationTokens={sessionTokens.cacheCreationTokens}
        cacheReadTokens={sessionTokens.cacheReadTokens}
        onCompact={handleCompact}
        onClear={handleClear}
      />
    )}

    {messages.length > 0 && onClearConversation && (
      <button className="chat-clear-btn" ... />
    )}
  </div>

  <ChatInput ... />
</div>
```

---

### Phase 4: Update Parent Component (App.tsx or AgentChatTab)

**File**: `src/components/AgentChatTab.tsx` (or wherever ChatView is used)

**Changes**:

Pass sessionTokens from useClaudeChat to ChatView:

```typescript
const {
  messages,
  isLoading,
  sendMessage,
  clearConversation,
  sessionTokens, // 🆕 destructure from hook
} = useClaudeChat();

return (
  <ChatView
    messages={messages}
    isLoading={isLoading}
    onSendMessage={sendMessage}
    onClearConversation={clearConversation}
    sessionTokens={sessionTokens} // 🆕 pass to ChatView
    // ... other props
  />
);
```

---

## 🎨 Component Implementation Details

### TokenUsageIndicator.tsx

```typescript
import { useState, useMemo } from 'react';
import './TokenUsageIndicator.css';

interface TokenUsageIndicatorProps {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  maxTokens?: number;
  onCompact?: () => void;
  onClear?: () => void;
}

export default function TokenUsageIndicator({
  inputTokens,
  outputTokens,
  cacheCreationTokens = 0,
  cacheReadTokens = 0,
  maxTokens = 200000,
  onCompact,
  onClear,
}: TokenUsageIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const totalTokens = inputTokens + outputTokens;
  const percentage = (totalTokens / maxTokens) * 100;

  // Determine color state
  const state = useMemo(() => {
    if (percentage >= 95) return 'danger';
    if (percentage >= 90) return 'critical';
    if (percentage >= 75) return 'warning';
    if (percentage >= 50) return 'caution';
    return 'safe';
  }, [percentage]);

  // Format tokens with K/M suffix
  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
    return tokens.toString();
  };

  return (
    <div
      className={`token-usage-indicator ${state}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Compact Display */}
      <div className="token-usage-compact">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="token-usage-text">
          {formatTokens(totalTokens)} / {formatTokens(maxTokens)}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="token-usage-progress">
        <div
          className="token-usage-fill"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="token-usage-tooltip">
          <div className="token-usage-tooltip-header">
            <h4>Token Usage</h4>
            <span className="token-usage-percentage">{percentage.toFixed(1)}%</span>
          </div>

          <div className="token-usage-breakdown">
            <div className="token-usage-row">
              <span className="token-usage-label">Input:</span>
              <span className="token-usage-value">
                {inputTokens.toLocaleString()}
                <span className="token-usage-percent">
                  ({((inputTokens / totalTokens) * 100).toFixed(0)}%)
                </span>
              </span>
            </div>
            <div className="token-usage-row">
              <span className="token-usage-label">Output:</span>
              <span className="token-usage-value">
                {outputTokens.toLocaleString()}
                <span className="token-usage-percent">
                  ({((outputTokens / totalTokens) * 100).toFixed(0)}%)
                </span>
              </span>
            </div>
            {cacheCreationTokens > 0 && (
              <div className="token-usage-row cache">
                <span className="token-usage-label">Cache Created:</span>
                <span className="token-usage-value">{cacheCreationTokens.toLocaleString()}</span>
              </div>
            )}
            {cacheReadTokens > 0 && (
              <div className="token-usage-row cache">
                <span className="token-usage-label">Cache Read:</span>
                <span className="token-usage-value">{cacheReadTokens.toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="token-usage-total">
            <strong>Total:</strong> {totalTokens.toLocaleString()} / {maxTokens.toLocaleString()}
          </div>

          {/* Warning Messages */}
          {percentage >= 75 && percentage < 90 && (
            <div className="token-usage-warning">
              ⚠️ Consider using <code>/compact</code> to reduce context
            </div>
          )}
          {percentage >= 90 && percentage < 95 && (
            <div className="token-usage-critical">
              🚨 Context window filling up! Use <code>/compact</code> soon
            </div>
          )}
          {percentage >= 95 && (
            <div className="token-usage-danger">
              🔴 Critical! Use <code>/clear</code> or <code>/compact</code> immediately
            </div>
          )}

          {/* Quick Actions */}
          {percentage >= 75 && (
            <div className="token-usage-actions">
              {onCompact && (
                <button
                  className="token-usage-btn compact"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCompact();
                  }}
                >
                  Compact
                </button>
              )}
              {onClear && (
                <button
                  className="token-usage-btn clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClear();
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

### TokenUsageIndicator.css

```css
/* Token Usage Indicator */
.token-usage-indicator {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  cursor: help;
  transition: all 0.2s ease;
  min-width: 140px;
}

.token-usage-indicator:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Compact Display */
.token-usage-compact {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.token-usage-compact svg {
  opacity: 0.7;
}

.token-usage-text {
  font-variant-numeric: tabular-nums;
}

/* Progress Bar */
.token-usage-progress {
  height: 3px;
  background: var(--color-background);
  border-radius: 2px;
  overflow: hidden;
}

.token-usage-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
  border-radius: 2px;
}

/* State Colors */
.token-usage-indicator.safe .token-usage-fill {
  background: #10B981; /* green */
}

.token-usage-indicator.caution .token-usage-fill {
  background: #EAB308; /* yellow */
}

.token-usage-indicator.warning .token-usage-fill {
  background: #F59E0B; /* orange */
}

.token-usage-indicator.critical .token-usage-fill {
  background: #EF4444; /* red */
}

.token-usage-indicator.danger .token-usage-fill {
  background: #EF4444;
  animation: pulse-danger 1.5s ease-in-out infinite;
}

@keyframes pulse-danger {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

/* Tooltip */
.token-usage-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 280px;
  font-size: 13px;
  animation: tooltip-fade-in 0.2s ease;
}

@keyframes tooltip-fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.token-usage-tooltip-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--color-border);
}

.token-usage-tooltip-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.token-usage-percentage {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--color-background);
  color: var(--color-text-secondary);
}

/* Breakdown */
.token-usage-breakdown {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.token-usage-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.token-usage-row.cache {
  opacity: 0.7;
  font-size: 11px;
}

.token-usage-label {
  color: var(--color-text-secondary);
}

.token-usage-value {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: var(--color-text);
}

.token-usage-percent {
  margin-left: 4px;
  font-size: 11px;
  color: var(--color-text-secondary);
}

/* Total */
.token-usage-total {
  padding: 8px;
  background: var(--color-background);
  border-radius: 4px;
  font-size: 12px;
  text-align: center;
  margin-bottom: 8px;
}

/* Warning Messages */
.token-usage-warning,
.token-usage-critical,
.token-usage-danger {
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  margin-bottom: 8px;
}

.token-usage-warning {
  background: rgba(234, 179, 8, 0.1);
  color: #EAB308;
  border: 1px solid rgba(234, 179, 8, 0.3);
}

.token-usage-critical {
  background: rgba(245, 158, 11, 0.1);
  color: #F59E0B;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.token-usage-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #EF4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
  font-weight: 600;
}

.token-usage-warning code,
.token-usage-critical code,
.token-usage-danger code {
  padding: 2px 4px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
  font-family: monospace;
  font-size: 11px;
}

/* Quick Actions */
.token-usage-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.token-usage-btn {
  flex: 1;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.token-usage-btn.compact {
  background: #F59E0B;
  color: white;
}

.token-usage-btn.compact:hover {
  background: #D97706;
}

.token-usage-btn.clear {
  background: #EF4444;
  color: white;
}

.token-usage-btn.clear:hover {
  background: #DC2626;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .token-usage-indicator {
    min-width: 120px;
  }

  .token-usage-tooltip {
    min-width: 240px;
    left: auto;
    right: 0;
  }
}
```

---

## 🔄 Integration with Existing `/compact` and `/clear`

### Slash Commands

The app already has slash command support via `src/hooks/useSlashCommands.ts`.

When the user clicks "Compact" or "Clear" buttons:

1. **Compact**: Send `/compact` command to Claude
   ```typescript
   const handleCompact = () => {
     handleSend('/compact');
   };
   ```

2. **Clear**: Call the existing `onClearConversation` handler
   ```typescript
   const handleClear = () => {
     if (window.confirm('Clear conversation? This cannot be undone.')) {
       onClearConversation?.();
     }
   };
   ```

---

## 📝 Implementation Checklist

### Step 1: Create Component Files
- [ ] Create `src/components/TokenUsageIndicator.tsx`
- [ ] Create `src/components/TokenUsageIndicator.css`

### Step 2: Update useClaudeChat Hook
- [ ] Add `sessionTokens` state
- [ ] Track cumulative tokens in streaming loop
- [ ] Reset tokens on `clearConversation`
- [ ] Export `sessionTokens` in return object

### Step 3: Update ChatView
- [ ] Import `TokenUsageIndicator`
- [ ] Add `sessionTokens` to props interface
- [ ] Create `handleCompact` and `handleClear` handlers
- [ ] Add component to footer layout
- [ ] Update CSS for new footer layout

### Step 4: Update Parent Component
- [ ] Pass `sessionTokens` from hook to ChatView
- [ ] Test data flow

### Step 5: Testing
- [ ] Test with small messages (< 10k tokens)
- [ ] Test with medium messages (50k-100k tokens)
- [ ] Test approaching limit (> 150k tokens)
- [ ] Test compact functionality
- [ ] Test clear functionality
- [ ] Test tooltip interaction
- [ ] Test responsive layout

### Step 6: Polish
- [ ] Add smooth animations
- [ ] Test dark mode compatibility
- [ ] Test mobile responsiveness
- [ ] Add accessibility attributes (aria-labels)
- [ ] Test keyboard navigation

---

## 🧪 Testing Scenarios

### Scenario 1: Normal Usage (0-50%)
- **Input**: Send 10 short messages
- **Expected**: Green progress bar, no warnings
- **Tokens**: ~5k-20k

### Scenario 2: Medium Usage (50-75%)
- **Input**: Send long code file or multiple context-heavy messages
- **Expected**: Yellow progress bar, "Caution" state
- **Tokens**: ~100k-150k

### Scenario 3: High Usage (75-90%)
- **Input**: Continue conversation with heavy context
- **Expected**: Orange progress bar, warning message suggesting `/compact`
- **Tokens**: ~150k-180k

### Scenario 4: Critical Usage (90-95%)
- **Input**: Near context limit
- **Expected**: Red progress bar, critical warning, suggest `/compact` ASAP
- **Tokens**: ~180k-190k

### Scenario 5: Danger Zone (95-100%)
- **Input**: Very close to limit
- **Expected**: Pulsing red progress bar, urgent warning, show both compact and clear buttons
- **Tokens**: ~190k-200k

### Scenario 6: Compact Action
- **Input**: Click "Compact" button at 85%
- **Expected**: Execute `/compact` command, tokens should reduce

### Scenario 7: Clear Action
- **Input**: Click "Clear" button
- **Expected**: Confirmation dialog → clear conversation → tokens reset to 0

---

## 📚 Reference Documentation

### Claude API Documentation
- [Token Counting API](https://docs.claude.com/en/docs/build-with-claude/token-counting)
- [Rate Limits](https://docs.claude.com/en/api/rate-limits)
- [Agent SDK Overview](https://docs.claude.com/en/api/agent-sdk/overview)

### Existing Code References
- `src/components/UsagePanel.tsx` - Full usage tracking implementation
- `src/components/StreamMessage.tsx` - Token display in messages
- `src/services/claudeSDK.ts` - Token data from API
- `src/hooks/useClaudeChat.ts` - Chat state management

### Token Limits
- **Claude Sonnet 4.5**: 200,000 token context window
- **Claude Opus 4.5**: 200,000 token context window
- **Claude Haiku**: 200,000 token context window

---

## 🎨 Design Specifications

### Colors (Light Mode)
| State | Color | Hex |
|-------|-------|-----|
| Safe | Green | `#10B981` |
| Caution | Yellow | `#EAB308` |
| Warning | Orange | `#F59E0B` |
| Critical | Red | `#EF4444` |

### Spacing
- Indicator padding: `6px 10px`
- Gap between elements: `4px-6px`
- Tooltip padding: `12px`
- Border radius: `6px` (container), `4px` (buttons)

### Typography
- Main text: `12px`, weight `500`
- Tooltip header: `14px`, weight `600`
- Breakdown rows: `12px`
- Cache info: `11px`

### Animation
- Progress bar transition: `0.3s ease`
- Tooltip fade-in: `0.2s ease`
- Danger pulse: `1.5s ease-in-out infinite`

---

## 🚀 Future Enhancements

1. **Predictive Analytics**
   - Estimate tokens remaining based on message length
   - Show "X messages left" prediction

2. **Auto-Compact**
   - Automatically compact when reaching 90%
   - User setting to enable/disable

3. **Token History Graph**
   - Mini sparkline showing token usage over time
   - Visual trend analysis

4. **Smart Warnings**
   - Context-aware suggestions (e.g., "Long file detected, consider chunking")
   - Per-message token cost preview before sending

5. **Token Budget**
   - Set custom limits (e.g., alert at 150k instead of 180k)
   - Budget mode for cost control

---

## ❓ FAQ

### Q: Why 200k tokens?
**A**: Claude's context window is 200,000 tokens for all current models (Sonnet 4.5, Opus 4.5, Haiku).

### Q: Are cache tokens counted toward the limit?
**A**: Cache read tokens don't count toward input limits, but we track them for visibility. Cache creation tokens DO count.

### Q: What does `/compact` do?
**A**: The `/compact` command (from Claude Code) reduces the conversation context by summarizing or removing old messages while preserving important information.

### Q: Can I customize the thresholds?
**A**: Yes! The component accepts a `maxTokens` prop (default 200k), and you can adjust warning thresholds in the component logic.

### Q: What happens if I exceed 200k?
**A**: The API will return an error. The UI should prevent this by showing urgent warnings before reaching the limit.

### Q: Does this work with subagents?
**A**: Token tracking is per-session. Each subagent conversation would have its own token counter if implemented separately.

---

## 📞 Support & Questions

If you encounter issues during implementation:

1. Check the existing `UsagePanel.tsx` for reference implementation
2. Review Claude SDK documentation for token tracking
3. Test with small data sets first
4. Use browser DevTools to inspect event flow
5. Check console logs for token data in streaming events

---

## ✅ Success Criteria

The implementation is successful when:

1. ✅ Token counter appears near chat input
2. ✅ Updates in real-time during streaming
3. ✅ Shows accurate cumulative totals
4. ✅ Color-codes based on usage percentage
5. ✅ Tooltip displays detailed breakdown
6. ✅ Warnings appear at correct thresholds
7. ✅ Compact/Clear buttons work correctly
8. ✅ Resets to 0 after clearing conversation
9. ✅ Works on mobile and desktop
10. ✅ Accessible via keyboard navigation

---

## 🦆 Final Notes

This implementation provides a **non-intrusive, always-visible** token usage indicator that helps users:

- **Avoid hitting context limits** unexpectedly
- **Make informed decisions** about when to compact or clear
- **Understand token consumption** patterns in their conversations
- **Take quick action** with one-click compact/clear buttons

The design follows Quack's existing UI patterns and integrates seamlessly with the current chat interface.

**Quack quack! Good luck with the implementation! 🚀**

---

## 🔧 Overhead Calculation Fix (2025-01-27)

### The Problem

The original implementation used `cache_creation_input_tokens` from the Claude SDK as a proxy for "overhead" (system prompt, tools, MCP, memory). This was **incorrect** because:

- `cache_creation_input_tokens` includes **ALL tokens being cached** - system + tools + memory + **previous conversation messages**
- This value grows with every message, not just the overhead
- It caused the "Overhead" display to show values like 76k+ instead of the actual ~38k

### The Fix

We now use **fixed overhead estimates** based on typical Claude CLI `/context` output:

```typescript
const FIXED_OVERHEAD = {
  systemPrompt: 4200,    // System prompt, instructions
  systemTools: 17500,    // Built-in tool definitions (read, write, bash, etc.)
  mcpTools: 5800,        // MCP tool definitions
  memoryFiles: 10500,    // Memory MCP context, CLAUDE.md, project context
  get total() { return this.systemPrompt + this.systemTools + this.mcpTools + this.memoryFiles; }
};
// Total: ~38k tokens
```

### Why Fixed Values?

The Claude SDK **does not provide** a direct breakdown like `/context` does. The only way to get accurate overhead values would be to:

1. Parse the first message's system prompt (not available via SDK)
2. Count tool definitions (not exposed)
3. Measure MCP context (not exposed)

Using fixed estimates based on real `/context` output is the most reliable approach:

**Claude CLI `/context` shows:**
```
System prompt: 4.2k tokens (2.1%)
System tools: 17.5k tokens (8.8%)
MCP tools: 5.8k tokens (2.9%)
Memory files: 10.5k tokens (5.3%)
Messages: 606 tokens (0.3%)
```

### Files Modified

- `src/components/TokenUsageModal.tsx` - Uses `FIXED_OVERHEAD` constant
- `src/components/TokenUsageIndicator.tsx` - Uses `FIXED_OVERHEAD = 38000`

### Note

The overhead may vary slightly based on:
- Number of MCP servers connected
- Size of CLAUDE.md files
- Number of skills/agents configured

If you have a significantly different configuration, you can adjust the `FIXED_OVERHEAD` values. Check your actual overhead using `claude /context` in CLI.

---

*Last updated: 2025-01-27*
*Author: Jack, Quack Agency CEO 🦆*
*Version: 1.1*
