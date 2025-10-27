---
name: discord-community-manager
description: Expert Discord community manager and moderator for technical developer communities. Use this skill when managing Discord servers, planning community structure, creating engagement strategies, handling moderation, organizing beta testing programs, or coordinating early adopter communities. Specializes in developer-focused communities with technical users, feature requests, bug reports, and product feedback workflows.
---

# Discord Community Manager

## Overview

This skill provides comprehensive guidance for managing and growing a Discord-based developer community. It covers server architecture, channel organization, moderation strategies, engagement tactics, beta testing coordination, and community growth. Designed specifically for technical communities with early adopters, beta testers, and active contributors who provide product feedback and feature requests.

## Core Capabilities

### 1. Server Structure & Channel Architecture

Design Discord server structures optimized for developer communities with clear information hierarchy and intuitive navigation.

**Channel Categories (Recommended Structure):**

```
📢 ANNOUNCEMENTS
├─ #announcements (read-only, admin-only posts)
├─ #changelog (product updates, new features)
└─ #roadmap (upcoming features, planned improvements)

💬 COMMUNITY
├─ #general (general discussion, introductions)
├─ #showcase (user projects, success stories)
└─ #off-topic (casual conversation)

🛠️ SUPPORT
├─ #help (general support questions)
├─ #troubleshooting (bug reports, technical issues)
└─ #feature-requests (suggestions, ideas)

🧪 BETA TESTING
├─ #beta-announcements (beta releases, testing calls)
├─ #beta-feedback (structured feedback from testers)
└─ #beta-bugs (beta-specific bug reports)

📚 RESOURCES
├─ #documentation (links to docs, guides)
├─ #tutorials (community tutorials, walkthroughs)
└─ #faq (frequently asked questions)

🎯 META
├─ #rules (server rules, code of conduct)
└─ #feedback (feedback about the community itself)
```

**Channel Configuration Best Practices:**

- **Announcement channels**: Read-only for members, posting restricted to admins/moderators
- **Support channels**: Enable threading to keep conversations organized
- **Showcase channel**: Encourage media uploads, create weekly highlights
- **Beta testing**: Separate from main support to avoid confusion
- **Use channel topics**: Every channel should have a clear description visible at the top

**Role Structure:**

```
🦆 Admin (full permissions)
🛠️ Moderator (moderation permissions, no server settings)
⭐ Beta Tester (access to beta channels)
🌟 Early Adopter (special recognition role)
👨‍💻 Active Contributor (engaged community members)
👤 Member (default role)
```

### 2. Community Growth Strategy

**Early Adopter Onboarding:**

Create a welcoming first experience for early adopters:

1. **Welcome Message Template:**
```
👋 Welcome to the Quack Community, @username!

We're excited to have you here! Quack is a multi-agentic desktop environment built on the Claude Agent SDK.

🚀 Getting Started:
• Check out <#documentation> for installation guides
• Introduce yourself in <#general>
• Share your projects in <#showcase>
• Report bugs in <#troubleshooting>
• Request features in <#feature-requests>

Questions? Ask in <#help> - our community is here to help!

Happy quacking! 🦆
```

2. **Onboarding Flow:**
   - Auto-assign "Member" role on join
   - Welcome message in #general with @mention
   - Pin introduction template in #general
   - Create introduction thread weekly for new members

3. **Beta Tester Program:**
   - Application form for beta access (Google Forms/TypeForm)
   - Criteria: technical background, commitment to feedback, use case diversity
   - Grant "Beta Tester" role manually after review
   - Send DM with beta testing guidelines and expectations

**Growth Tactics:**

- **Content Marketing**: Share valuable content in #tutorials and #documentation
- **Community Highlights**: Weekly showcase of interesting use cases or projects
- **Social Proof**: Encourage users to share their experiences on social media (X, LinkedIn)
- **Developer Relations**: Engage with users like Kalani who express interest publicly
- **Cross-Promotion**: Collaborate with related communities (Claude, Tauri, developer tools)

### 3. Engagement & Activity Management

**Engagement Strategies:**

1. **Regular Touchpoints:**
   - Daily: Monitor #help and #troubleshooting, respond within 4 hours
   - Weekly: Post in #changelog with updates (even small ones)
   - Bi-weekly: Feature a community member in #showcase
   - Monthly: Review and update #roadmap with community input

2. **Discussion Prompts:**
   - "What are you building with Quack this week?"
   - "Share your most interesting use case"
   - "What feature would make your workflow 10x better?"
   - "How are you using AI agents in your projects?"

3. **Recognition Program:**
   - Award "Active Contributor" role to engaged members
   - Feature community contributions in #announcements
   - Create monthly "Community MVP" recognition
   - Thank users publicly for bug reports and feedback

4. **Response Templates:**

**Bug Report Response:**
```
Thanks for reporting this, @username! 🐛

I've noted this issue. Can you provide:
• Your OS and Quack version
• Steps to reproduce
• Expected vs actual behavior
• Any error messages or logs

This helps us fix it faster! 🦆
```

**Feature Request Response:**
```
Great suggestion, @username! 💡

I've added this to our feature request backlog.

To help prioritize:
• What's your primary use case?
• How often would you use this?
• Any workarounds you're currently using?

We love community-driven development! 🦆
```

**General Support Response:**
```
Happy to help, @username! 🛠️

[Provide specific answer/solution]

Let me know if this resolves your issue or if you need more help!

Also, check out <#documentation> for more guides. 🦆
```

### 4. Moderation & Community Health

**Moderation Philosophy:**

- **Be welcoming**: Assume good intent, help users learn community norms
- **Be transparent**: Explain moderation decisions when appropriate
- **Be consistent**: Apply rules fairly to all members
- **Be proactive**: Address issues early before they escalate

**Common Scenarios:**

1. **Off-topic Discussion:**
   - Gently redirect to #off-topic
   - Don't delete unless disruptive
   - Use humor and friendliness

2. **Duplicate Questions:**
   - Answer briefly with link to previous discussion
   - Consider adding to #faq if common
   - Use threads to consolidate related questions

3. **Low-Quality Bug Reports:**
   - Don't dismiss - ask for more info
   - Provide bug report template
   - Thank user for reporting even if incomplete

4. **Feature Spam:**
   - Consolidate similar requests
   - Create feature request voting system
   - Explain prioritization process transparently

**Moderation Tools:**

- **AutoMod**: Configure for spam links, excessive caps, banned words
- **Slow Mode**: Enable in high-traffic channels during events (30-60 seconds)
- **Warning System**: Verbal warning → Written warning → Timeout → Ban
- **Raid Protection**: Verification level set to "Medium" (verified email)

### 5. Beta Testing Coordination

**Beta Program Structure:**

1. **Beta Release Process:**
   - Announce in #beta-announcements 24 hours before release
   - Provide clear testing focus (e.g., "Test new terminal multiplexer")
   - Include known issues and what NOT to test
   - Set testing period (e.g., "We'll collect feedback for 5 days")

2. **Feedback Collection:**
   - Create dedicated thread per beta release
   - Use structured feedback template:
     ```
     **Feature Tested:** [Name]
     **Rating:** ⭐⭐⭐⭐⭐ (1-5)
     **What Worked Well:**
     **Issues Found:**
     **Suggestions:**
     **Would you use this?** Yes/No
     ```

3. **Beta Tester Recognition:**
   - Thank beta testers publicly in #announcements
   - Credit contributors in changelog
   - Offer early access to future features
   - Create "Beta Legend" role for highly active testers

**Testing Coordination:**

- Use Discord Events for scheduled testing sessions
- Create voice channels for real-time testing discussions
- Pin testing checklist in #beta-announcements
- Collect system info diversity (Mac/Windows/Linux, different versions)

### 6. Analytics & Community Health Metrics

**Key Metrics to Track:**

1. **Growth Metrics:**
   - New members per week
   - Member retention (30-day, 90-day)
   - Active members (posted in last 7 days)
   - Beta tester conversion rate

2. **Engagement Metrics:**
   - Messages per day (by channel)
   - Average response time in #help
   - Showcase submissions per month
   - Feature request volume and themes

3. **Health Metrics:**
   - Support resolution rate
   - User satisfaction (periodic surveys)
   - Churn rate (members leaving)
   - Moderation actions per week

**Discord Analytics Tools:**

- **Native Discord Insights**: Member growth, engagement, retention (Server Settings → Analytics)
- **Custom Bot**: Build simple analytics bot for deeper insights
- **Manual Tracking**: Spreadsheet with weekly snapshots of key metrics

**Health Indicators:**

- ✅ **Healthy**: Active daily discussion, users helping each other, positive showcase activity
- ⚠️ **Warning**: Decreased activity, unanswered questions, negative sentiment
- 🚨 **Critical**: Multiple users leaving, unresolved conflicts, spam/trolling issues

### 7. Community Events & Programming

**Event Types for Developer Communities:**

1. **AMA (Ask Me Anything):**
   - Monthly AMA with founder/lead developer
   - Announce 1 week ahead
   - Use Stage Channel or text-based thread
   - Post transcript afterwards in #documentation

2. **Office Hours:**
   - Weekly drop-in support session
   - Use voice channel
   - Screenshare for debugging help
   - Record and post highlights

3. **Hackathons/Build Challenges:**
   - Theme-based challenges (e.g., "Build something cool with Quack agents")
   - 1-week to 1-month duration
   - Small prizes or recognition
   - Showcase winners in #announcements

4. **Tutorial Sessions:**
   - Community-led tutorials
   - Screen sharing in voice channel
   - Record and archive in #tutorials
   - Encourage community members to lead

**Event Planning Checklist:**

- [ ] Create Discord Event 7 days before
- [ ] Announce in #announcements 5 days before
- [ ] Reminder in #general 1 day before
- [ ] Post in other channels (Reddit, X, LinkedIn) if public
- [ ] Prepare materials (slides, code examples)
- [ ] Assign moderators to manage chat during event
- [ ] Record event (with permission notice)
- [ ] Post recording and summary within 24 hours
- [ ] Thank participants and collect feedback

### 8. Crisis Management & Conflict Resolution

**Crisis Response Protocol:**

1. **Assess Severity:**
   - Low: Individual complaint, minor disagreement
   - Medium: Multiple users affected, technical issue causing frustration
   - High: Server raid, major product failure, public controversy

2. **Response Timeline:**
   - Low: Respond within 4 hours
   - Medium: Respond within 1 hour
   - High: Respond immediately

3. **Communication Template:**
   ```
   🚨 **Update: [Issue Name]**

   **Status:** We're aware and investigating
   **Impact:** [Who/what is affected]
   **Timeline:** [Expected resolution time or "investigating"]
   **Workaround:** [If available]

   We'll update every [timeframe] until resolved.

   Thanks for your patience! 🦆
   ```

4. **Post-Incident:**
   - Post-mortem in #announcements
   - Explain what happened, why, and how it's fixed
   - Thank community for patience and feedback
   - Implement preventive measures

**Conflict Resolution:**

- **User vs User**: DM both parties privately, facilitate resolution, enforce rules if needed
- **User vs Product**: Validate frustration, explain limitations, offer workarounds, gather feedback
- **User vs Moderator**: Escalate to admin, review mod action, apologize if error, clarify policy

### 9. Tools & Automation

**Recommended Discord Bots:**

1. **MEE6** (Moderation & Engagement):
   - Auto-moderation rules
   - Welcome messages
   - Level/XP system for gamification
   - Custom commands

2. **Carl-bot** (Utility):
   - Reaction roles (self-assign Beta Tester, etc.)
   - Embeds and announcements
   - Auto-responder
   - Logging (message edits, deletions)

3. **Ticket Tool** (Support):
   - Support ticket system
   - Private channels for one-on-one help
   - Ticket logs and history

4. **Statbot** (Analytics):
   - Server statistics
   - Member growth tracking
   - Activity heatmaps

**Automation Ideas:**

- Auto-assign "Member" role on join
- Auto-create thread for each #feature-request
- Auto-pin messages with 5+ reactions in #showcase
- Weekly digest of top posts sent to #announcements
- Auto-delete messages in #rules (keep clean)
- Welcome DM with onboarding links

**Integration Opportunities:**

- **GitHub**: Post issue/PR updates to #changelog
- **Twitter/X**: Cross-post announcements
- **Email**: Newsletter digest of weekly highlights
- **Analytics**: Export Discord data to dashboard

## Resources

### references/

This skill includes reference documents with detailed guides and templates:

- `community_templates.md` - Message templates, announcement formats, event planning checklists
- `moderation_guidelines.md` - Detailed moderation scenarios, escalation procedures, ban appeal process
- `growth_playbook.md` - Month-by-month community growth strategies, marketing tactics, partnership ideas

### assets/

This skill includes assets for immediate use:

- `server_icon.png` - Quack logo optimized for Discord (512x512px)
- `banner_template.psd` - Discord banner template for seasonal updates
- `welcome_embed.json` - Formatted welcome message embed template
- `bot_config/` - Pre-configured bot settings for MEE6, Carl-bot

**Note:** Bundled resources should be customized based on specific community needs. Delete any unused resources.

## Best Practices Summary

1. **Be Present**: Check Discord multiple times daily, respond to questions promptly
2. **Be Transparent**: Share roadmap, explain decisions, admit mistakes
3. **Be Grateful**: Thank contributors, recognize effort, celebrate wins
4. **Be Proactive**: Create content before asked, prevent issues before they arise
5. **Be Authentic**: Use personality (quack quack! 🦆), be human, have fun
6. **Listen More Than You Speak**: Community feedback drives product success
7. **Document Everything**: FAQs, guides, decisions - make knowledge accessible
8. **Foster Community Leaders**: Empower members to help each other and lead discussions

## Common Scenarios Checklist

- [ ] **New member joins**: Welcome message, assign role, encourage introduction
- [ ] **Bug report submitted**: Acknowledge, ask for details, create tracking issue
- [ ] **Feature requested**: Thank user, ask follow-up questions, add to backlog
- [ ] **User frustrated**: Validate feelings, offer solutions, escalate if needed
- [ ] **Great showcase post**: React with emoji, comment enthusiasm, consider featuring
- [ ] **Question in #help**: Provide answer with context, link to docs, offer to help further
- [ ] **Beta release**: Announce, explain focus, collect feedback, follow up
- [ ] **Weekly update**: Post changelog, share metrics, highlight community contributions
- [ ] **Conflict arises**: Assess severity, de-escalate, enforce rules fairly, document
- [ ] **Community milestone**: Celebrate publicly, thank contributors, share achievements
