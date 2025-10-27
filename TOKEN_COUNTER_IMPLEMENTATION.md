# 🦆 Token Counter Implementation Plan - Quack App

## 📋 Overview

Implementare un indicatore visuale del consumo di token per la sessione corrente di chat con Claude, mostrando progresso verso il limite di 200k token e avvisando l'utente quando è necessario fare `/compact` o `/clear`.

## 🎯 Obiettivi

1. **Visualizzare token usage in tempo reale** - Mostrare token usati vs limite (200k)
2. **Avvisi proattivi** - Warning visivi quando si avvicina al limite
3. **Actionable UI** - Suggerimenti per `/compact` o `/clear` quando necessario
4. **Design minimale** - Integrato nel footer della chat senza ingombrare

## 📁 File Structure

```
src/
├── components/
│   ├── TokenUsageIndicator.tsx          # ✨ NUOVO
│   ├── TokenUsageIndicator.css          # ✨ NUOVO
│   ├── TokenUsageModal.tsx              # ✨ NUOVO
│   ├── TokenUsageModal.css              # ✨ NUOVO
│   ├── ChatView.tsx                     # 📝 MODIFICARE
│   └── ChatView.css                     # 📝 MODIFICARE
├── hooks/
│   └── useClaudeChat.ts                 # 📝 MODIFICARE
└── types.ts                             # 📝 MODIFICARE (se necessario)
```

## 🔧 Implementation Details

### 1. TokenUsageIndicator Component

**File:** `src/components/TokenUsageIndicator.tsx`

```typescript
import { useState } from 'react';
import './TokenUsageIndicator.css';
import TokenUsageModal from './TokenUsageModal';

interface TokenUsageIndicatorProps {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  maxTokens?: number; // Default: 200000
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
  const [showModal, setShowModal] = useState(false);

  // Calculate totals
  const totalTokens = inputTokens + outputTokens;
  const percentage = (totalTokens / maxTokens) * 100;

  // Determine status and color
  const getStatus = () => {
    if (percentage >= 90) return { level: 'critical', color: '#EF4444', label: 'Critical' };
    if (percentage >= 75) return { level: 'warning', color: '#F59E0B', label: 'Warning' };
    if (percentage >= 50) return { level: 'caution', color: '#EAB308', label: 'Caution' };
    return { level: 'normal', color: '#10B981', label: 'Normal' };
  };

  const status = getStatus();

  // Format token count (45.2k, 120k, etc.)
  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
    return tokens.toString();
  };

  return (
    <>
      <div
        className={`token-usage-indicator ${status.level}`}
        onClick={() => setShowModal(true)}
        title="Click for details"
      >
        <div className="token-usage-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span>{formatTokens(totalTokens)} / {formatTokens(maxTokens)}</span>
        </div>
        <div className="token-usage-progress-bar">
          <div
            className="token-usage-progress-fill"
            style={{
              width: `${Math.min(percentage, 100)}%`,
              backgroundColor: status.color,
            }}
          />
        </div>
        {status.level !== 'normal' && (
          <div className="token-usage-badge" style={{ backgroundColor: status.color }}>
            {status.label}
          </div>
        )}
      </div>

      {showModal && (
        <TokenUsageModal
          inputTokens={inputTokens}
          outputTokens={outputTokens}
          cacheCreationTokens={cacheCreationTokens}
          cacheReadTokens={cacheReadTokens}
          maxTokens={maxTokens}
          percentage={percentage}
          status={status}
          onClose={() => setShowModal(false)}
          onCompact={onCompact}
          onClear={onClear}
        />
      )}
    </>
  );
}
```

**File:** `src/components/TokenUsageIndicator.css`

```css
.token-usage-indicator {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 160px;
}

.token-usage-indicator:hover {
  background: var(--bg-tertiary);
  border-color: var(--border-hover);
}

.token-usage-indicator.warning,
.token-usage-indicator.critical {
  animation: pulse-subtle 2s ease-in-out infinite;
}

@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}

.token-usage-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.token-usage-label svg {
  opacity: 0.6;
}

.token-usage-progress-bar {
  width: 100%;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.token-usage-progress-fill {
  height: 100%;
  transition: width 0.3s ease, background-color 0.3s ease;
  border-radius: 2px;
}

.token-usage-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 600;
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Status-specific styles */
.token-usage-indicator.critical {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.05);
}

.token-usage-indicator.warning {
  border-color: rgba(245, 158, 11, 0.3);
  background: rgba(245, 158, 11, 0.05);
}

.token-usage-indicator.caution {
  border-color: rgba(234, 179, 8, 0.3);
  background: rgba(234, 179, 8, 0.05);
}
```

### 2. TokenUsageModal Component

**File:** `src/components/TokenUsageModal.tsx`

```typescript
import './TokenUsageModal.css';

interface TokenUsageModalProps {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  maxTokens: number;
  percentage: number;
  status: {
    level: string;
    color: string;
    label: string;
  };
  onClose: () => void;
  onCompact?: () => void;
  onClear?: () => void;
}

export default function TokenUsageModal({
  inputTokens,
  outputTokens,
  cacheCreationTokens,
  cacheReadTokens,
  maxTokens,
  percentage,
  status,
  onClose,
  onCompact,
  onClear,
}: TokenUsageModalProps) {
  const totalTokens = inputTokens + outputTokens;
  const remainingTokens = maxTokens - totalTokens;

  const formatTokens = (tokens: number) => {
    return tokens.toLocaleString();
  };

  const getSuggestion = () => {
    if (percentage >= 90) {
      return {
        title: '🚨 Critical: Action Required',
        message: 'You are very close to the token limit. Clear the conversation or use /compact to continue.',
        action: 'clear',
      };
    }
    if (percentage >= 75) {
      return {
        title: '⚠️ Warning: Approaching Limit',
        message: 'Consider using /compact to reduce token usage while preserving context.',
        action: 'compact',
      };
    }
    if (percentage >= 50) {
      return {
        title: '💡 Tip',
        message: 'You\'re halfway to the token limit. Monitor your usage or use /compact when needed.',
        action: null,
      };
    }
    return {
      title: '✅ All Good',
      message: 'You have plenty of tokens remaining for this session.',
      action: null,
    };
  };

  const suggestion = getSuggestion();

  return (
    <div className="token-modal-overlay" onClick={onClose}>
      <div className="token-modal" onClick={(e) => e.stopPropagation()}>
        <div className="token-modal-header">
          <h3>Token Usage Details</h3>
          <button className="token-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="token-modal-content">
          {/* Progress Circle */}
          <div className="token-usage-circle">
            <svg width="120" height="120" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke="var(--bg-tertiary)"
                strokeWidth="8"
              />
              <circle
                cx="60"
                cy="60"
                r="54"
                fill="none"
                stroke={status.color}
                strokeWidth="8"
                strokeDasharray={`${(percentage / 100) * 339.292} 339.292`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
              />
              <text
                x="60"
                y="55"
                textAnchor="middle"
                fontSize="24"
                fontWeight="600"
                fill="var(--text-primary)"
              >
                {percentage.toFixed(1)}%
              </text>
              <text
                x="60"
                y="75"
                textAnchor="middle"
                fontSize="12"
                fill="var(--text-secondary)"
              >
                {status.label}
              </text>
            </svg>
          </div>

          {/* Token Breakdown */}
          <div className="token-breakdown">
            <div className="token-breakdown-item">
              <span className="token-breakdown-label">Total Used</span>
              <span className="token-breakdown-value">{formatTokens(totalTokens)}</span>
            </div>
            <div className="token-breakdown-item">
              <span className="token-breakdown-label">Remaining</span>
              <span className="token-breakdown-value">{formatTokens(remainingTokens)}</span>
            </div>
            <div className="token-breakdown-item">
              <span className="token-breakdown-label">Input Tokens</span>
              <span className="token-breakdown-value">{formatTokens(inputTokens)}</span>
            </div>
            <div className="token-breakdown-item">
              <span className="token-breakdown-label">Output Tokens</span>
              <span className="token-breakdown-value">{formatTokens(outputTokens)}</span>
            </div>
            {(cacheCreationTokens > 0 || cacheReadTokens > 0) && (
              <>
                <div className="token-breakdown-divider" />
                {cacheCreationTokens > 0 && (
                  <div className="token-breakdown-item">
                    <span className="token-breakdown-label">Cache Creation</span>
                    <span className="token-breakdown-value">{formatTokens(cacheCreationTokens)}</span>
                  </div>
                )}
                {cacheReadTokens > 0 && (
                  <div className="token-breakdown-item">
                    <span className="token-breakdown-label">Cache Read</span>
                    <span className="token-breakdown-value">{formatTokens(cacheReadTokens)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Suggestion Card */}
          <div className={`token-suggestion ${status.level}`}>
            <div className="token-suggestion-title">{suggestion.title}</div>
            <div className="token-suggestion-message">{suggestion.message}</div>
            {suggestion.action && (
              <div className="token-suggestion-actions">
                {suggestion.action === 'compact' && onCompact && (
                  <button className="token-action-btn primary" onClick={() => {
                    onCompact();
                    onClose();
                  }}>
                    Run /compact
                  </button>
                )}
                {suggestion.action === 'clear' && onClear && (
                  <button className="token-action-btn danger" onClick={() => {
                    onClear();
                    onClose();
                  }}>
                    Clear Conversation
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="token-info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>Claude sessions have a 200k token context window. Use /compact to preserve context while reducing tokens.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**File:** `src/components/TokenUsageModal.css`

```css
.token-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(4px);
}

.token-modal {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.token-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-color);
}

.token-modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.token-modal-close {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
}

.token-modal-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.token-modal-content {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.token-usage-circle {
  display: flex;
  justify-content: center;
  align-items: center;
}

.token-breakdown {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.token-breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.token-breakdown-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.token-breakdown-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
}

.token-breakdown-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

.token-suggestion {
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.token-suggestion.critical {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}

.token-suggestion.warning {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
}

.token-suggestion.caution {
  background: rgba(234, 179, 8, 0.1);
  border-color: rgba(234, 179, 8, 0.3);
}

.token-suggestion-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.token-suggestion-message {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
}

.token-suggestion-actions {
  display: flex;
  gap: 8px;
}

.token-action-btn {
  flex: 1;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.token-action-btn.primary {
  background: var(--accent-color);
  color: white;
}

.token-action-btn.primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.token-action-btn.danger {
  background: #EF4444;
  color: white;
}

.token-action-btn.danger:hover {
  background: #DC2626;
  transform: translateY(-1px);
}

.token-info {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.token-info svg {
  flex-shrink: 0;
  margin-top: 2px;
  opacity: 0.6;
}
```

### 3. Modify useClaudeChat Hook

**File:** `src/hooks/useClaudeChat.ts`

Aggiungere tracking cumulativo dei token:

```typescript
// Add to state variables (around line 20)
const [sessionTokens, setSessionTokens] = useState({
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
});

// In the streaming loop (around line 96-128), update tokens:
for await (const chunk of stream) {
  if (chunk.type === 'event' && chunk.event) {
    const event = chunk.event;
    events.push(event);

    // ... existing code ...

    // 🆕 Track cumulative tokens from result events
    if (event.type === 'result' && event.usage) {
      setSessionTokens(prev => ({
        inputTokens: prev.inputTokens + event.usage.input_tokens,
        outputTokens: prev.outputTokens + event.usage.output_tokens,
        cacheCreationTokens: prev.cacheCreationTokens + (event.usage.cache_creation_input_tokens || 0),
        cacheReadTokens: prev.cacheReadTokens + (event.usage.cache_read_input_tokens || 0),
      }));
    }
  }
}

// In clearConversation function (around line 200), reset tokens:
const clearConversation = useCallback(() => {
  setMessages([]);
  setError(null);
  claudeSessionId.current = undefined;
  // 🆕 Reset session tokens
  setSessionTokens({
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  });
}, []);

// Return sessionTokens in the hook return (around line 240):
return {
  messages,
  isLoading,
  isConfigured,
  error,
  initialize,
  sendMessage,
  clearConversation,
  abortStream,
  lastPrompt: lastPromptRef.current,
  // 🆕 Expose session tokens
  sessionTokens,
};
```

### 4. Integrate into ChatView

**File:** `src/components/ChatView.tsx`

```typescript
// Import TokenUsageIndicator (around line 4)
import TokenUsageIndicator from './TokenUsageIndicator';

// Add to props interface (around line 42)
interface ChatViewProps {
  // ... existing props ...
  sessionTokens?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  };
}

// Add to component props destructuring (around line 75)
export default function ChatView({
  // ... existing props ...
  sessionTokens = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 },
}: ChatViewProps) {

// Update footer rendering (around line 137-161)
<div className="chat-view-footer">
  <div className="chat-view-footer-controls">
    <ChatSettingsMenu ... />

    {/* 🆕 Add Token Usage Indicator */}
    <TokenUsageIndicator
      inputTokens={sessionTokens.inputTokens}
      outputTokens={sessionTokens.outputTokens}
      cacheCreationTokens={sessionTokens.cacheCreationTokens}
      cacheReadTokens={sessionTokens.cacheReadTokens}
      onCompact={() => {
        // TODO: Implement /compact command trigger
        console.log('Compact requested');
      }}
      onClear={onClearConversation}
    />

    {messages.length > 0 && onClearConversation && (
      <button className="chat-clear-btn" ... />
    )}
  </div>
  <ChatInput ... />
</div>
```

**File:** `src/components/ChatView.css`

```css
/* Update footer controls layout (around line 20) */
.chat-view-footer-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-color);
}
```

### 5. Connect in Main App

**File:** `src/App.tsx` (wherever ChatView is used)

Pass sessionTokens from useClaudeChat:

```typescript
const { messages, isLoading, sendMessage, clearConversation, sessionTokens } = useClaudeChat();

// In ChatView component:
<ChatView
  // ... existing props ...
  sessionTokens={sessionTokens}
/>
```

## 🎨 Visual Design Specs

### Color States
- **Normal (0-50%)**: Green `#10B981`
- **Caution (50-75%)**: Yellow `#EAB308`
- **Warning (75-90%)**: Orange `#F59E0B`
- **Critical (90-100%)**: Red `#EF4444` + pulsing animation

### Progress Bar
- Height: 4px
- Border radius: 2px
- Smooth transitions on color/width changes

### Modal
- Max width: 500px
- Backdrop blur: 4px
- Circular progress indicator (SVG)
- Quick action buttons for /compact and /clear

## 🧪 Testing Checklist

- [ ] Token counter updates in real-time during streaming
- [ ] Progress bar shows correct percentage
- [ ] Color changes at correct thresholds (50%, 75%, 90%)
- [ ] Modal opens on click with detailed breakdown
- [ ] /compact and /clear buttons work correctly
- [ ] Counter resets when clearing conversation
- [ ] Tooltip shows on hover
- [ ] Responsive design on small screens
- [ ] Pulse animation on warning/critical states
- [ ] Cache tokens display when present

## 📝 Implementation Notes

### Token Calculation Logic
```typescript
// Total tokens = input + output (for context limit)
const totalTokens = inputTokens + outputTokens;

// Cache tokens are tracked separately but affect billing
const cacheTokens = cacheCreationTokens + cacheReadTokens;
```

### Context Window vs Billing
- **Context window**: 200k tokens (input + output)
- **Billing**: Separate rates for input/output/cache tokens
- Our counter focuses on context window limit

### /compact Command
The `/compact` command should:
1. Preserve key context and code
2. Reduce token usage by ~30-50%
3. Maintain conversation coherence

Implementation is handled by existing slash command system.

### Edge Cases
1. **Session resume**: Token counter should persist across sessions
2. **Multiple sessions**: Each chat should have independent counters
3. **Streaming interruption**: Partial token counts should still update
4. **Cache tokens**: Show in modal but don't count toward 200k limit

## 🚀 Deployment Steps

1. Create all new files (`TokenUsageIndicator.tsx`, `TokenUsageModal.tsx`, CSS files)
2. Modify `useClaudeChat.ts` to track session tokens
3. Update `ChatView.tsx` to include TokenUsageIndicator
4. Update `ChatView.css` for layout adjustments
5. Test thoroughly with different token usage levels
6. Verify /compact and /clear integrations work
7. Deploy and monitor user feedback

## 🦆 Quack Notes

- Keep UI minimal and non-intrusive
- Use consistent color scheme with rest of app
- Ensure accessibility (ARIA labels, keyboard navigation)
- Add smooth animations for better UX
- Consider adding localStorage persistence for token history

---

**Generated by Jack 🦆 - Quack Agency**
*For implementation questions, just quack!*
