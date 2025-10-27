# Discord Post Command

Post development updates to Discord #live-development channel automatically.

## Description

This command allows you to post real-time development updates to the Quack Discord community from within your development workflow. It's the ultimate dogfooding experience - using Quack to build and share Quack's development progress!

## Usage

```bash
/discord "Your message here"
```

## Examples

### 1. Simple Feature Update
```bash
/discord "🎨 Just redesigned the terminal sidebar UI - much cleaner now!"
```

### 2. Bug Fix Announcement
```bash
/discord "🐛 Fixed critical bug in PTY state management - terminals now reconnect properly!"
```

### 3. Daily Progress Summary
```bash
/discord "📊 Today's Progress:
✅ Implemented Discord webhook integration
✅ Fixed 3 PTY bugs
✅ Redesigned Git panel header
🚧 Tomorrow: Terminal performance optimization"
```

### 4. Sneak Peek
```bash
/discord "👀 Sneak peek: Working on saved command snippets feature - one-click access to your favorite commands!"
```

### 5. Transparency Post
```bash
/discord "😅 Spent 3 hours debugging scroll behavior - turns out I needed to track user intent vs auto-scroll separately. Now it works perfectly!"
```

## Implementation

When the user runs `/discord` with a message:

1. **Extract the message** from the command arguments
2. **Format the message** (ensure proper escaping for JSON)
3. **POST to Discord webhook** using curl:
   ```bash
   curl -s -X POST "https://discord.com/api/webhooks/1432322294201581569/KG2eqmKPm6MIYTAAZzKmexICqfTJYtT5MouTVnwSPLSDoxSk-JQwSAEjT4K1BtzXABeZ" \
     -H "Content-Type: application/json" \
     -d "{\"content\": \"$MESSAGE\"}"
   ```
4. **Confirm to user** that the post was successful
5. **Handle errors** gracefully if webhook fails

## Best Practices

### When to Post
- ✅ **After completing** a feature or bug fix
- ✅ **At end of day** for daily summaries
- ✅ **When reaching milestones** (tests passing, build successful)
- ✅ **For sneak peeks** of upcoming features
- ✅ **Transparency moments** (failures, learnings, challenges)

### When NOT to Post
- ❌ **Every small change** - avoid spam
- ❌ **Debug messages** - use logging instead
- ❌ **Work in progress** that's not meaningful yet
- ❌ **Private/sensitive information**

### Message Style Guide
- **Use emoji** for visual interest (🎨🐛🚀📊👀😅✅🚧)
- **Keep it concise** - 1-3 sentences max
- **Be authentic** - share both wins and fails
- **Add context** - explain WHY, not just WHAT
- **Include before/after** when relevant

## Rate Limits

- **Discord limit**: 5 messages per minute per webhook
- **Recommendation**: Max 5-10 posts per day
- **Best practice**: Post only meaningful updates

## Security

⚠️ **IMPORTANT**: The webhook URL is sensitive!
- ✅ Stored in this command file (not in git by default via .gitignore)
- ✅ Only accessible within Quack
- ❌ Never commit to public repositories
- ❌ Never share webhook URL publicly

## Examples in Context

### After Git Commit
```bash
git commit -m "feat: add saved commands" && /discord "✅ Just shipped saved commands feature!"
```

### After Tests Pass
```bash
npm test && /discord "✅ All tests passing! Terminal auto-scroll fix is solid."
```

### End of Day Summary
```bash
/discord "📊 Day $(date +%d/%m):
✅ Fixed 2 critical bugs
✅ Redesigned UI
🚧 Tomorrow: Git integration improvements"
```

## Building in Public Philosophy

This command embodies the "building in public" philosophy:
- **Transparency**: Community sees the real development process
- **Authenticity**: Share both successes and struggles
- **Engagement**: Community feels part of the journey
- **Education**: Others learn from your process
- **Dogfooding**: Using Quack to build Quack!

## Future Enhancements

Potential improvements for this command:
- [ ] Screenshot attachment support
- [ ] Rich embeds with formatted fields
- [ ] Thread creation for discussions
- [ ] Multiple webhook support (different channels)
- [ ] Template presets for common update types
- [ ] Interactive prompts for message composition

## Metadata

- **Version**: 1.0.0
- **Author**: Alek Dobrohotov
- **Created**: October 25, 2025
- **Category**: Community & Communication
- **Webhook**: Discord #live-development channel
