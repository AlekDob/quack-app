---
type: pattern
created: 2026-01-17
---

# Memory Hook AI Extraction with Claude Code CLI Auth

**Problem**: Memory Hook created a new Anthropic() client that required ANTHROPIC_API_KEY env var, which was not available because Quack uses Claude Code CLI authenticated session.

**Solution**: Remove check for API key and let Anthropic SDK automatically use the same authenticated session from Claude Code CLI.

**Key Insight**: @anthropic-ai/sdk (used by Memory Hook) and @anthropic-ai/claude-agent-sdk (used for chat) share the SAME auth mechanism via Claude Code CLI session.

**File Modified**: `src-tauri/node-sdk/memory-prompt-hook.js` (lines 128-141)

**Changes**: Removed check `if (!process.env.ANTHROPIC_API_KEY)` and added comment explaining CLI auth usage.

**Config Change**: `useAiExtraction: true` - RE-ENABLED AI extraction.

**How It Works**: Anthropic SDK automatically searches auth in this order: 1) ANTHROPIC_API_KEY env var, 2) Claude Code CLI session (~/.anthropic/config.json), 3) Error
