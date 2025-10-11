# Claude SDK Authentication Guide

*Last Updated: 2025-10-11*
*Author: Mike (Project Manager)*

## Executive Summary

**IMPORTANT DISCOVERY**: The Claude SDK and Claude Code work seamlessly with Claude Max subscriptions without requiring a separate API billing account. This guide documents the authentication methods and troubleshooting steps.

## Authentication Methods

### Method 1: Claude Max Subscription (Recommended for Individual Developers)

**Benefits:**
- ✅ No additional API costs - uses existing Claude Max subscription
- ✅ Confirmed working with Max 5x subscription
- ✅ Automatic session authentication through SDK
- ✅ Seamless integration with Claude Code

**Setup:**
1. Ensure you have an active Claude Max subscription
2. The SDK will automatically detect and use your Max session
3. No API key configuration needed in most cases

**Verification:**
```bash
# Test SDK authentication in text-only mode
claude -p hello
```

### Method 2: Traditional API Keys (Enterprise/Advanced Users)

**When to Use:**
- Enterprise accounts with dedicated API billing
- Teams requiring separate usage tracking
- Advanced users needing specific rate limits

**Setup:**
1. Generate API key from Anthropic dashboard
2. Store securely in app settings
3. App will use `tauri-plugin-store` for encrypted storage

## Troubleshooting Authentication Issues

### Common Problem: API Key Conflicts

**Symptom:** SDK fails to authenticate even with active Claude Max subscription

**Root Cause:** Conflicting `ANTHROPIC_API_KEY` environment variable

**Solution:**
```bash
# Force unset any existing API keys that might conflict
unset ANTHROPIC_API_KEY

# Test SDK authentication again
claude -p hello
```

**Explanation:** Sometimes old API keys in environment variables can interfere with Claude Max session authentication. Unsetting them allows the SDK to use the correct authentication method.

### Authentication Priority in quack-app

The app will check authentication in this order:
1. **Claude Max session** (automatic, preferred)
2. **API key from settings** (if Max not available)
3. **Environment variable** (fallback, not recommended)

## Implementation Notes for Developers

### Frontend (React/TypeScript)

In `src/hooks/useClaudeChat.ts`:
```typescript
// Support both authentication methods
const authenticateClaudeSDK = async () => {
  // First try Claude Max session
  const maxAuth = await checkClaudeMaxSession();
  if (maxAuth.success) {
    return { method: 'max', session: maxAuth.session };
  }

  // Fall back to API key if needed
  const apiKey = await getStoredApiKey();
  if (apiKey) {
    return { method: 'api-key', key: apiKey };
  }

  throw new Error('No authentication method available');
};
```

### Backend (Rust/Tauri)

In `src-tauri/src/claude_sdk/auth.rs`:
```rust
pub async fn authenticate() -> Result<AuthMethod> {
    // Check for Claude Max session first
    if let Ok(session) = check_claude_max_session().await {
        return Ok(AuthMethod::ClaudeMax(session));
    }

    // Fall back to API key
    if let Some(api_key) = get_stored_api_key().await? {
        return Ok(AuthMethod::ApiKey(api_key));
    }

    Err(anyhow!("No authentication method available"))
}
```

### UI Indicators

The app should clearly show which authentication method is active:
- 🔵 "Claude Max" badge when using subscription
- 🔑 "API Key" badge when using traditional authentication
- ⚠️ Warning if neither method is available

## Cost Implications

### Claude Max Users
- **Monthly Cost**: Only your Max subscription ($25-45/month)
- **API Costs**: $0 (included in subscription)
- **Rate Limits**: Based on your Max tier

### API Key Users
- **Monthly Cost**: Pay-as-you-go based on usage
- **API Costs**: Variable based on tokens used
- **Rate Limits**: Based on API tier

## Testing Checklist

- [ ] Test SDK with fresh Claude Max login
- [ ] Test SDK with API key authentication
- [ ] Verify `unset ANTHROPIC_API_KEY` fixes conflicts
- [ ] Confirm UI shows correct auth method
- [ ] Test fallback from Max to API key
- [ ] Verify error messages are clear
- [ ] Test rate limiting for both methods

## Sources & References

- **Community Discovery**: [Reddit r/ClaudeAI Discussion](https://www.reddit.com/r/ClaudeAI/comments/1leigee/claude_sdk_usage_with_claude_max_subscription/)
- **Official Docs**: [Anthropic SDK Documentation](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- **Claude Agent SDK**: [GitHub Repository](https://github.com/anthropics/anthropic-sdk-typescript)

## FAQ

**Q: Do I need both Claude Max and an API key?**
A: No! Claude Max users don't need a separate API key. The SDK works with your Max subscription.

**Q: What if I have both Max and an API key?**
A: The app will prefer Claude Max authentication to save API costs, but you can manually select which to use.

**Q: Will this work with Claude Pro/Team subscriptions?**
A: Yes, the same authentication method works for all Claude subscription tiers.

**Q: What about rate limits with Max authentication?**
A: Rate limits follow your Claude Max tier limits, not API limits.

---

*This guide will be updated as we learn more about SDK authentication methods and best practices.*