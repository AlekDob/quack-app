# Action Plan: Fix Claude SDK Authentication 🦆

*Created by: Mike (Project Manager)*
*Date: 2025-10-11*
*Status: Ready for Implementation*

---

## 🎯 Executive Summary

**THE DISCOVERY**: We've been trying to implement custom OAuth when the Claude Code CLI credentials (from `claude login`) can be directly reused for the Agent SDK! This simplifies EVERYTHING.

**Current Situation**:
- ✅ User has already authenticated with `claude login`
- ✅ Claude Code CLI works perfectly
- ✅ `claude_auth.rs` already reads credentials from keychain
- ❌ Custom OAuth in `claude_oauth.rs` is failing (and unnecessary!)
- ❌ Agent SDK expects `access_token` parameter we don't need

**Solution**: Remove OAuth complexity, reuse CLI credentials for Agent SDK.

---

## 📋 Implementation Steps

### Step 1: Remove OAuth Complexity (30 minutes)

**Files to Delete/Disable**:
```bash
# Don't delete yet, just comment out OAuth imports in lib.rs
# We'll delete after confirming everything works
```

**In `src-tauri/src/lib.rs`**:
```rust
// COMMENT OUT these lines:
// mod claude_oauth;
// use claude_oauth::{start_claude_oauth, get_claude_access_token, ...};

// REMOVE these commands from invoke_handler:
// start_claude_oauth,
// get_claude_access_token,
// claude_oauth_logout,
// is_claude_oauth_authenticated,
```

### Step 2: Modify Agent to Use CLI Credentials (45 minutes)

**In `src-tauri/src/claude_agent.rs`**:

```rust
// At the top, add import:
use crate::claude_auth;

// MODIFY the send_message_with_agent function:
#[tauri::command]
pub async fn send_message_with_agent(
    prompt: String,
    images: Option<Vec<ImageAttachment>>,
    options: Option<AgentOptions>,
    // REMOVE THIS PARAMETER:
    // access_token: String,
) -> Result<AgentResponse, String> {
    // ADD: Get credentials from CLI
    let credentials = claude_auth::get_claude_credentials()
        .map_err(|e| format!("Failed to get Claude credentials: {}", e))?
        .ok_or_else(|| "No Claude credentials found. Please run 'claude login' first.".to_string())?;

    // Use the CLI token
    let access_token = credentials.token;

    // Rest of the function stays the same...
    let opts = options.unwrap_or_default();

    // ... existing implementation continues ...

    // When making the API request:
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", access_token) // Now using CLI token
        .header("anthropic-version", "2023-06-01")
        // ... rest stays the same
}
```

### Step 3: Update Frontend to Remove OAuth UI (30 minutes)

**In `src/components/AgentOptionsPanel.tsx`**:

```typescript
// REMOVE OAuth-related state and functions
// REPLACE with CLI auth status check

const AgentOptionsPanel = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        // Check if CLI is authenticated
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            const hasAuth = await invoke<boolean>('check_claude_cli_auth');
            setIsAuthenticated(hasAuth);
        } catch (error) {
            console.error('Failed to check auth:', error);
        }
    };

    // In the render:
    return (
        <div className="agent-options">
            {!isAuthenticated ? (
                <div className="auth-warning">
                    <p>⚠️ Claude CLI not authenticated</p>
                    <p>Please run <code>claude login</code> in terminal first</p>
                    <button onClick={checkAuthStatus}>Check Again</button>
                </div>
            ) : (
                <div className="auth-success">
                    <p>✅ Using Claude CLI credentials</p>
                    {/* Rest of the options panel */}
                </div>
            )}
        </div>
    );
};
```

### Step 4: Update useClaudeChat Hook (20 minutes)

**In `src/hooks/useClaudeChat.ts`**:

```typescript
// REMOVE access_token from the invoke call
const sendMessageWithAgent = async (
    prompt: string,
    images?: ImageAttachment[],
    options?: AgentOptions
) => {
    try {
        // No need to get access_token anymore!
        const response = await invoke<AgentResponse>('send_message_with_agent', {
            prompt,
            images,
            options
            // REMOVE: access_token
        });

        return response;
    } catch (error) {
        console.error('Agent error:', error);
        throw error;
    }
};
```

### Step 5: Test the Integration (15 minutes)

**Testing Checklist**:
1. [ ] Run `cargo build` in `src-tauri/` - should compile without errors
2. [ ] Run `npm run tauri:dev` - app should start
3. [ ] Check Agent Options panel - should show "Using Claude CLI credentials"
4. [ ] Send a test message - should get response using CLI auth
5. [ ] Try with images - multimodal should work
6. [ ] Check error handling - should show helpful message if not logged in

### Step 6: Cleanup (10 minutes)

**Once everything works**:
1. Delete `src-tauri/src/claude_oauth.rs`
2. Remove OAuth-related dependencies from `Cargo.toml` if any
3. Clean up any OAuth-related UI components
4. Update documentation

---

## 🔧 Code Changes Summary

### Rust Changes

**`src-tauri/src/claude_agent.rs`**:
- Remove `access_token` parameter from `send_message_with_agent`
- Add `claude_auth::get_claude_credentials()` call
- Use CLI token for API authentication

**`src-tauri/src/lib.rs`**:
- Remove `mod claude_oauth;`
- Remove OAuth-related commands from `invoke_handler`

### TypeScript Changes

**`src/hooks/useClaudeChat.ts`**:
- Remove `access_token` from invoke parameters
- Simplify authentication flow

**`src/components/AgentOptionsPanel.tsx`**:
- Remove OAuth UI components
- Add CLI authentication status display
- Show helpful instructions if not authenticated

---

## ⚠️ Potential Issues & Solutions

### Issue 1: API Key Format
**Problem**: CLI token might be in different format than expected
**Solution**: The token from `claude login` is already in the correct format for the Anthropic API

### Issue 2: Token Expiration
**Problem**: CLI tokens might expire
**Solution**: User can run `claude login` again to refresh

### Issue 3: Different Auth Types
**Problem**: Some users might have API keys, others have OAuth tokens
**Solution**: `claude_auth.rs` already handles both via `AuthType` enum

---

## 🎉 Benefits of This Approach

1. **Simplicity**: Remove 400+ lines of OAuth code
2. **Reliability**: Reuse battle-tested CLI authentication
3. **User Experience**: Users only authenticate once with `claude login`
4. **Maintenance**: Less code = fewer bugs
5. **Compatibility**: Works with Claude Max subscriptions!

---

## 📝 Final Notes

This is a MUCH simpler solution than custom OAuth. We're leveraging the fact that:
- Claude Code CLI already handles authentication perfectly
- The credentials are stored securely in the system keychain
- The Agent SDK can use the same tokens
- Users already know how to use `claude login`

**Time Estimate**: ~2 hours total
**Risk Level**: Low (we're simplifying, not adding complexity)
**Rollback Plan**: Git revert if issues arise (but unlikely)

---

*"Sometimes the best solution is to delete code, not write more!" - Mike*

Ready to implement! 🚀