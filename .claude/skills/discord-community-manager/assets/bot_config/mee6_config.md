# MEE6 Bot Configuration for Quack Community

This document provides recommended MEE6 configuration settings for the Quack Discord community.

## Auto-Moderation Rules

### 1. Spam Protection

**Rule: Prevent Message Spam**
- Trigger: User sends more than 5 messages in 5 seconds
- Action: Delete messages, timeout 10 minutes
- Alert: Send alert to #mod-log

**Rule: Prevent Duplicate Messages**
- Trigger: User posts same message 3+ times
- Action: Delete duplicates, warn user
- Alert: Send alert to #mod-log

**Rule: Prevent Caps Spam**
- Trigger: Message with 70%+ caps and 15+ characters
- Action: Delete message, warn user
- Alert: None (auto-clean)

### 2. Link Protection

**Rule: Prevent Invite Links**
- Trigger: Message contains Discord invite link
- Except: If user has "Moderator" or "Admin" role
- Action: Delete message, warn user
- Alert: Send to #mod-log

**Rule: Suspicious Links**
- Trigger: Message contains link to suspicious domains
- Blacklist: bit.ly, tinyurl.com (use proper links)
- Action: Delete message, alert moderators
- Alert: Send to #mod-log with @moderator ping

### 3. Content Protection

**Rule: Banned Words**
- Trigger: Message contains banned words/phrases
- List: [Add your banned words - hate speech, slurs, etc.]
- Action: Delete message, timeout 1 hour
- Alert: Send to #mod-log

**Rule: NSFW Content**
- Trigger: Message flagged as NSFW by Discord
- Action: Delete, timeout 24 hours
- Alert: Send to #mod-log with @admin ping

## Welcome Plugin

**Welcome Message Settings:**

**Channel:** #general

**Message Type:** Embed

**Embed Configuration:**
```
Title: Welcome to Quack, {user}! 🦆
Description: We're excited to have you here!
Color: #58B5DF (light blue)
Thumbnail: Server icon
Fields:
  - Name: 🚀 Getting Started
    Value: Check out <#documentation> for guides and <#help> for support!
  - Name: 📢 Stay Updated
    Value: Follow <#announcements> for the latest news
Footer: Member #{membercount} • Happy quacking!
```

**DM New Members:** Yes

**DM Message:**
```
👋 Welcome to the Quack Community!

Thanks for joining! Here's how to get started:

🚀 **Getting Started:**
• Introduce yourself in #general
• Check out our documentation: https://quack-app.com/docs
• Report bugs in #troubleshooting
• Request features in #feature-requests

💡 **Need Help?**
Ask in #help - our community is friendly and responsive!

📚 **Resources:**
• GitHub: https://github.com/yourusername/quack-app
• Tutorials: https://quack-app.com/tutorials

Happy quacking! 🦆
```

**Assign Role on Join:** @Member

## Levels & XP System

**Enable Levels:** Yes

**XP Settings:**
- XP per message: 15-25 (random)
- Cooldown: 60 seconds (prevent spam for XP)
- Announcement channel: #general
- Announcement message: "GG {user}, you just advanced to **{level}**! 🎉"

**Level Roles:**
```
Level 5:  @Active Member
Level 10: @Contributor
Level 20: @Veteran
Level 30: @Legend
```

**Disabled Channels (No XP):**
- #bot-commands
- #rules
- #announcements

**XP Multiplier Roles:**
- @Beta Tester: 1.5x
- @Early Adopter: 1.3x
- @Moderator: 0x (don't need XP)
- @Admin: 0x (don't need XP)

## Custom Commands

### !docs
**Response:**
```
📚 **Quack Documentation**

Find guides, tutorials, and API docs at:
https://quack-app.com/docs

Quick links:
• Installation: https://quack-app.com/docs/installation
• Getting Started: https://quack-app.com/docs/getting-started
• Troubleshooting: https://quack-app.com/docs/troubleshooting

Need specific help? Ask in <#help>! 🦆
```

### !beta
**Response:**
```
🧪 **Beta Testing Program**

Interested in testing new features early?

**How to Join:**
1. Fill out the application: [link to form]
2. Wait for approval (1-3 days)
3. Get @Beta Tester role and access to <#beta-announcements>

**What We Look For:**
• Technical background
• Commitment to detailed feedback
• Diverse use cases

Apply now: [link]
```

### !showcase
**Response:**
```
🌟 **Share Your Project**

Built something cool with Quack? We'd love to see it!

**How to Share:**
1. Post in <#showcase> with:
   • Screenshots/video
   • Brief description
   • What makes it interesting
   • (Optional) GitHub link

2. We may feature your project in:
   • Weekly community updates
   • Social media
   • Official blog

**Featured Projects:**
Check out past showcases: https://quack-app.com/showcase

Share away! 🦆
```

### !rules
**Response:**
```
📜 **Community Rules**

Please follow our community guidelines:

1. ✅ Be respectful and kind
2. 📝 Stay on topic in channels
3. 🚫 No spam or self-promotion
4. 🌍 Use English in main channels
5. 🔒 Respect privacy & confidentiality
6. ⚖️ Follow Discord ToS
7. 👂 Listen to moderators

Full rules: <#rules>

Questions? Ask a @Moderator! 🦆
```

### !bug
**Response:**
```
🐛 **Report a Bug**

Found a bug? Help us fix it!

**How to Report:**
1. Go to <#troubleshooting>
2. Include:
   • OS and Quack version
   • Steps to reproduce
   • Expected vs actual behavior
   • Screenshots or error messages

**Template:**
\`\`\`
**OS:** macOS 14.2 (or Windows/Linux version)
**Quack Version:** v1.2.3 (Help > About)
**Issue:** [Brief description]
**Steps:**
1. [Step 1]
2. [Step 2]
3. [Step 3]
**Expected:** [What should happen]
**Actual:** [What actually happens]
**Logs:** [Paste relevant error messages]
\`\`\`

Thanks for helping improve Quack! 🦆
```

### !feature
**Response:**
```
💡 **Request a Feature**

Have an idea to make Quack better?

**How to Request:**
1. Post in <#feature-requests>
2. Describe:
   • What you want
   • Why you need it
   • Your use case
   • How often you'd use it

**What Happens Next:**
• We review all requests
• Community can upvote (👍 reaction)
• Popular requests get prioritized
• You'll get updates on status

**See Roadmap:** <#roadmap>

We love community-driven development! 🦆
```

### !contribute
**Response:**
```
🤝 **Contribute to Quack**

Want to contribute? We'd love your help!

**Ways to Contribute:**
• Report bugs in <#troubleshooting>
• Suggest features in <#feature-requests>
• Help others in <#help>
• Share projects in <#showcase>
• Write tutorials for <#tutorials>
• Join beta testing: !beta

**Code Contributions:**
• GitHub: https://github.com/yourusername/quack-app
• Check open issues
• Read CONTRIBUTING.md
• Submit PRs

**Recognition:**
• Active contributors get @Contributor role
• Featured in community highlights
• Early access to new features

Thank you! 🦆
```

## Reaction Roles (Carl-bot Integration)

If using Carl-bot for reaction roles, create this in #roles channel:

**Self-Assign Roles:**
```
React to get roles:

🧪 - @Beta Tester (apply first: !beta)
📢 - @Announcements Ping (get notified of big news)
🎓 - @Tutorial Notifications (new tutorials)
🦆 - @Community Events (AMAs, office hours)
```

## Logging Configuration

**Log Channel:** #mod-log (private, mods only)

**Events to Log:**
- Message deletions (with content)
- Message edits (show before/after)
- Timeouts/bans
- Role changes
- Member joins/leaves
- Channel creations/deletions
- Username changes

**Format:** Embed with timestamp, user, action, reason (if applicable)

## Auto-Responder

**Trigger: "how to install" or "installation"**
Response: Links to installation docs with quick command

**Trigger: "getting started"**
Response: Links to getting started guide

**Trigger: "quack code"**
Response: Explanation of Quack vs Claude Code integration

## Reminders

**Weekly Reminders:**

**Monday 9am ET:**
```
📊 **Weekly Check-in**

Let's start the week strong! What are you working on this week with Quack?

Share in #general! 🦆
```

**Friday 5pm ET:**
```
🎉 **It's Friday!**

What did you build with Quack this week? Share your wins in #showcase!

Have a great weekend! 🦆
```

## Additional Notes

- Review automod rules monthly and adjust based on community behavior
- Update custom commands when documentation URLs change
- Adjust XP multipliers based on community feedback
- Monitor #mod-log daily for any issues
- Keep welcome message fresh (update stats, links)

---

**Setup Instructions:**

1. Invite MEE6 to server: https://mee6.xyz/
2. Go to dashboard: https://mee6.xyz/dashboard/{serverid}
3. Configure each plugin following settings above
4. Test all commands and triggers
5. Enable logging and monitor for first week
6. Adjust based on community size and behavior

**Configuration Export:**
Export your MEE6 config regularly as backup. MEE6 Premium offers config import/export.
