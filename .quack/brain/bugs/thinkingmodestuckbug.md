---
type: bug_fix
project: quack-app
created: 2026-01-08
migrated: true
---

# thinking_mode_stuck_bug

BUG: Thinking mode stuck in collapsed state when using 'Ultra Think' or other thinking modes

ROOT CAUSE: ThinkingBlock uses local useState(isExpanded) without parent sync - no callback mechanism to notify parent when user clicks expand/collapse

PROBLEM 1: ThinkingBlock line 10 has local state: const [isExpanded, setIsExpanded] = useState(defaultExpanded) - not controlled by parent

PROBLEM 2: ChatMessage line 428 renders ThinkingBlock with NO callback prop - isolated component that cannot notify parent of state changes

PROBLEM 3: ChatView Tab key handler (lines 466-476) cycles thinking mode but does NOT reset ThinkingBlock expanded state

ISSUE: defaultExpanded prop in ThinkingBlock never updates after first render - remains stuck at initial value

When user presses Tab to cycle thinking mode, the thinking mode changes but ThinkingBlock stays collapsed

Manual sync broken because ThinkingBlock state is orphaned from ChatContext

FIX: ThinkingBlock needs to be controlled component - moved from local state to parent (ChatMessage/ChatView) with onExpandedChange callback

FIX: Save expanded state in ChatContext alongside message metadata

FIX: Reset expanded=true when thinking mode changes or new thinking message arrives
