---
description: Compact conversation history to reduce token usage while preserving context
---

# Compact Conversation History

Intelligently compress older messages in the conversation to reduce token usage while maintaining important context and continuity.

## What This Does

- Summarizes older parts of the conversation
- Keeps recent messages intact for full context
- Reduces token count significantly
- Preserves key decisions, code snippets, and important details
- Maintains conversation flow and coherence

## How It Works

1. **Identifies** older messages that can be compressed
2. **Summarizes** them into concise context blocks
3. **Preserves** critical information like:
   - Key decisions made
   - Code snippets and solutions
   - Important file paths and configurations
   - Ongoing task context
4. **Maintains** full detail for recent messages

## When to Use

Use `/compact` when:
- Conversation token count is getting high (approaching limits)
- You want to continue working but need to reduce context size
- Long back-and-forth discussions need consolidation
- Performance is slowing due to large context
- You want to preserve context while reducing cost

## Benefits

✅ **Lower token usage** = reduced costs
✅ **Faster responses** = less context to process
✅ **Preserved continuity** = keeps important context
✅ **Extended sessions** = can continue working longer

## Example Result

**Before Compact**: 50 messages, 25,000 tokens
**After Compact**: 15 detailed messages + 1 summary, 8,000 tokens

The summary preserves: "User implemented auth system with JWT, fixed 3 TypeScript errors in login.ts, deployed to staging, currently working on email verification feature."

---

🦆 **Quack!** Smart compression without losing the important stuff! Your conversation stays relevant and efficient!
