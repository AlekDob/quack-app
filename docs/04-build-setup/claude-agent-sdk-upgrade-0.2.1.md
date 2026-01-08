# Claude Agent SDK Upgrade to 0.2.1

**Date:** 2025-01-08
**Previous Version:** 0.1.76
**New Version:** 0.2.1

## Overview

Upgraded the Claude Agent SDK from 0.1.76 to 0.2.1 to take advantage of new features and security fixes.

## Key Changes in SDK 2.x

### New Features

1. **Skill Hot-Reload**
   - Skills created or modified in `~/.claude/skills` or `.claude/skills` are now immediately available without restart
   - Great for rapid development and testing of new skills

2. **Forked Execution Context**
   - Skills and slash commands can run in isolated sub-agent contexts
   - Use `context: fork` in frontmatter to enable sandboxing and parallel execution
   - Better isolation for complex operations

3. **Language Configuration**
   - New `language` setting allows specifying Claude's response language
   - Useful for localized interactions (e.g., Japanese, Italian)

4. **Terminal Compatibility**
   - Shift+Enter now works natively in iTerm2, WezTerm, Ghostty, and Kitty
   - No manual terminal configuration required

5. **Plugin Hooks**
   - Plugins now support `prompt` and `agent` hook types
   - Expanded customization beyond command hooks

### Security Fixes

- **Critical:** Fixed vulnerability where sensitive data (OAuth tokens, API keys, passwords) could accidentally leak into debug logs

### Bug Fixes

- **Session Resumption:** Resolved issues where files and skills weren't discoverable when resuming sessions with `-c` or `--resume` flags
- **Vim Motion Enhancements:** Expanded Vim support with new operators, text objects, and motion repeats

## Upgrade Command

```bash
npm install @anthropic-ai/claude-agent-sdk@0.2.1
```

## Node.js Version Note

After upgrade, npm shows warnings about Node.js version compatibility. Many packages now require Node >= 18.18.0, but current environment uses 18.17.0.

**Recommendation:** Consider upgrading Node.js to v20 LTS:

```bash
nvm install 20
nvm use 20
nvm alias default 20
```

## Verification

```bash
npm list @anthropic-ai/claude-agent-sdk
# Should output: @anthropic-ai/claude-agent-sdk@0.2.1
```

## Related Links

- [Claude Code Changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)
- [Claude Agent SDK npm](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)
