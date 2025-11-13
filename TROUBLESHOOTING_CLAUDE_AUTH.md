# Troubleshooting: Claude SDK Authentication Error 🦆

## Error Message

If you see this error in Quack:

```
Quack! 🦆 I encountered an error: Node.js SDK script failed with status: exit status: 1
```

## Quick Fix

Quack uses **Claude Code** authentication (your subscription). You need to login once:

### 1. Login with Claude Code

Open your terminal and run:

```bash
claude login
```

This will:
- Open your browser
- Ask you to authenticate with your Claude account
- Save credentials to `~/.claude/.credentials.json`

### 2. Restart Quack

Close Quack completely and reopen it. The error should be gone!

## Verify It's Working

Test that Claude Code is authenticated:

```bash
# Check version
claude --version

# Test a simple query
claude "Say hello"
```

If this works, Quack will work too!

## Still Having Issues?

### Check Credentials File

```bash
# Verify the credentials file exists
ls -la ~/.claude/.credentials.json

# View its contents (should show session_key or access_token)
cat ~/.claude/.credentials.json | jq '.'
```

### Reset Credentials

If credentials are corrupted:

```bash
# Remove old credentials
rm ~/.claude/.credentials.json

# Login again
claude login
```

### macOS Keychain (Mac Only)

Credentials might also be in Keychain:

1. Open "Keychain Access" app
2. Search for "claude"
3. Delete any corrupted entries
4. Run `claude login` again

### Check Logs

For detailed debugging:

```bash
# View Quack logs (macOS)
log show --predicate 'process == "Quack"' --last 5m | grep SDK

# Windows
# Check: %APPDATA%\Quack\logs\
```

## Why This Happens

Quack uses your **Claude Code subscription** for authentication, not a separate API key. This is more convenient because:

- ✅ No need to manage API keys
- ✅ Uses your existing subscription
- ✅ More secure (OAuth tokens)

But it requires you to be logged in with Claude Code.

## Important Notes

- **You only need to login once** with `claude login`
- **No need for ANTHROPIC_API_KEY** - Quack handles this automatically
- **Credentials are stored securely** in `~/.claude/.credentials.json` or macOS Keychain

## Need More Help?

1. **Check you have Claude Code installed:**
   - Download from [claude.ai](https://claude.ai)

2. **Verify you have an active subscription:**
   - Login at [claude.ai](https://claude.ai)
   - Check your account status

3. **Report the issue:**
   - Take a screenshot of the error
   - Include output of `claude --version`
   - Share in Quack Discord or GitHub Issues

---

**Still stuck?** Join the Quack Discord community for help! 🦆
