# Post to Discord Command

Post development updates to the Quack Discord community with proper formatting, emoji support, and image attachments.

## Description

This command posts updates to the Quack Discord #live-development channel using the `discord-community-manager` skill. It handles JSON escaping, emoji encoding, and image attachments automatically.

## Usage

```bash
/post-to-discord "Your message here"
/post-to-discord "Your message here" --image /path/to/screenshot.png
```

## How It Works

When you run `/post-to-discord`, Claude will:

1. **Use the discord-community-manager skill** to access posting best practices
2. **Run the post_to_discord.py script** with proper JSON escaping
3. **Handle emoji automatically** (UTF-8 encoding)
4. **Attach images** if provided (multipart/form-data format)
5. **Confirm success** or report errors

The command leverages the skill located at `.claude/skills/discord-community-manager/` which includes:
- Message templates and style guides
- Emoji usage guidelines
- Hashtag strategies
- Image best practices

## Examples

### Simple Text Post
```bash
/post-to-discord "🚀 Just shipped clickable Session IDs! Check it out in the Sessions panel 🦆"
```

### Post with Image
```bash
/post-to-discord "✨ New feature: Advanced code search in file editor!" --image ~/Desktop/screenshot.png
```

### Feature Announcement (using template)
```bash
/post-to-discord "🚀 New Feature: Clickable Session IDs

We just shipped a major UX improvement for session management!

**What's new:**
✅ Session IDs visible in Sessions panel
✅ Clickable Session IDs in chat messages
✅ Smart UI hides Resume button for active sessions

**Why this matters:**
- Faster session navigation
- Better session visibility
- One-click access to details

Check out the screenshot! 🦆

#QuackApp #SessionManagement #UXImprovement" --image ~/Desktop/feature-screenshot.png
```

### Bug Fix Announcement
```bash
/post-to-discord "🐛 Bug Fix: Reset Agent from sidebar

Fixed: Major bug with Reset Agent from the right-side agents panel

Impact:
- All users can now reliably reset agents
- No more stuck sessions

Thanks for reporting this! 🦆

#QuackApp #BugFix"
```

### Daily Dev Update
```bash
/post-to-discord "📊 Dev Update - $(date +%B\ %d)

Today's progress:
✅ Fixed Session ID click handler
✅ Updated Discord posting skill
🚧 Working on: Terminal performance optimization

Building in public, day by day! 🦆

#QuackApp #BuildInPublic"
```

## Message Templates

The skill provides pre-formatted templates for common post types:
- Feature announcements
- Bug fix announcements
- Daily dev updates
- Community milestones
- Beta testing calls
- Event announcements
- Tutorial shares
- Community showcases

Access templates at: `.claude/skills/discord-community-manager/references/post_templates.md`

## Best Practices

### Content Guidelines
- ✅ Use emoji for visual interest (🦆✅🚧🐛🚀💡🎉📊👀)
- ✅ Include 2-4 hashtags (#QuackApp always + 2-3 specific tags)
- ✅ Keep messages focused and scannable
- ✅ Add context (WHY, not just WHAT)
- ✅ Include screenshots when relevant

### When to Post
- ✅ After completing features or bug fixes
- ✅ Daily/weekly progress summaries
- ✅ Reaching milestones
- ✅ Sneak peeks of upcoming features
- ✅ Transparency moments (learnings, challenges)

### When NOT to Post
- ❌ Every small change (avoid spam)
- ❌ Debug messages or logs
- ❌ Incomplete work in progress
- ❌ Private/sensitive information

## Image Guidelines

- **Format**: PNG for UI screenshots, JPG for photos
- **Resolution**: 1920x1080 or 16:9 aspect ratio recommended
- **Size**: Under 8MB for fast loading
- **Content**: Show features in action, not static UI
- **Annotations**: Use arrows/highlights to draw attention

## Common Emoji for Quack

- 🦆 Brand emoji (use frequently!)
- 🚀 New features/launches
- 🐛 Bug fixes
- ✅ Completed items
- 🚧 Work in progress
- 💡 Ideas/suggestions
- 🎉 Celebrations/milestones
- 📊 Metrics/data/updates
- 👀 Sneak peeks
- ✨ Highlights/showcases

## Hashtag Strategy

Always include 2-4 hashtags:
- `#QuackApp` (always include)
- `#FeatureName` (specific feature)
- `#Category` (BuildInPublic, BugFix, UXImprovement, etc.)
- `#Tech` (if relevant: Claude, Tauri, React, etc.)

## Direct Script Usage

You can also use the Python script directly:

```bash
# Navigate to skill directory
cd .claude/skills/discord-community-manager

# Post simple message
python3 scripts/post_to_discord.py "Your message here 🦆"

# Post with image
python3 scripts/post_to_discord.py "Feature announcement!" --image ~/Desktop/screenshot.png

# Post from file
python3 scripts/post_to_discord.py --file update.txt --image demo.png
```

## Implementation Details

The command uses:
- **Skill**: `.claude/skills/discord-community-manager/`
- **Script**: `scripts/post_to_discord.py` (Python 3)
- **Templates**: `references/post_templates.md`
- **Webhook**: Discord #live-development channel

The script handles:
- JSON escaping and validation
- UTF-8 emoji encoding
- Multipart/form-data for images
- Error handling and reporting

## Troubleshooting

### "Failed to load resource" error
- The Discord webhook may have issues with emoji in JSON strings
- Solution: The script automatically handles UTF-8 encoding

### Image not attaching
- Check file path is correct and accessible
- Ensure image is under 25MB (Discord limit)
- Verify image format is supported (PNG, JPG, GIF, WebM)

### JSON parsing errors
- The script handles escaping automatically
- If manually using curl, ensure proper quote escaping

## Building in Public Philosophy

This command embodies "building in public":
- **Transparency**: Share real development process
- **Authenticity**: Show both wins and struggles
- **Engagement**: Community feels part of the journey
- **Education**: Others learn from your process
- **Dogfooding**: Using Quack to build Quack!

## Related Resources

- Discord Skill: `.claude/skills/discord-community-manager/SKILL.md`
- Post Templates: `.claude/skills/discord-community-manager/references/post_templates.md`
- Python Script: `.claude/skills/discord-community-manager/scripts/post_to_discord.py`

---

**Version**: 2.0.0 (Now using discord-community-manager skill)
**Author**: Alek Dobrohotov
**Category**: Community & Communication
