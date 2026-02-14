---
type: pattern
created: 2026-01-11
---

# Thinking Mode Prompt Control

Pattern for controlling Claude's Extended Thinking mode via prompt parsing BEFORE sending to SDK.

Location: src/hooks/useClaudeChat.ts -- `parseThinkingControl()` function

Supports multilingual patterns: Italian (esci dal thinking, disattiva thinking) and English (stop thinking, disable thinking).

Universal command: `/thinking on|off` works in any language.

Pattern arrays: `DISABLE_THINKING_PATTERNS` and `ENABLE_THINKING_PATTERNS` with regex.

Returns 'auto' to disable thinking, 'think' to enable, or current mode if no pattern matched.

Tests: 31 tests in src/tests/thinkingModeControl.test.ts covering all patterns.
