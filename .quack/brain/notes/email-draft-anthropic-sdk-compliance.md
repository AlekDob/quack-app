---
type: note
project: quack-app
created: 2026-01-11
migrated: true
---

# email-draft-anthropic-sdk-compliance

## Email Draft: Claude Agent SDK Compliance Inquiry

### Subject: Clarification on Claude Agent SDK usage with OAuth credentials in desktop application

### To: (TBD - cercando contatto appropriato)

### From: Alek Dobrohotov, Product Manager @ C&C Apple Premium Partner

Dear Anthropic Team,

I'm developing **Quack**, a desktop productivity application (Tauri + React) that integrates Claude AI capabilities for coding assistance and task management.

**Our Implementation:**

1. We use the official `@anthropic-ai/claude-agent-sdk` (v0.1.62) - NOT direct HTTP calls

2. When users have existing Claude Code CLI credentials (~/.claude.json with OAuth), we leverage those for authentication

3. We also support `ANTHROPIC_API_KEY` for pay-per-token usage

4. We do NOT spoof headers or impersonate Claude Code CLI

5. We do NOT manipulate User-Agent or any client identifiers

6. The SDK handles all telemetry internally

**Our Concern:**

Following the recent enforcement against third-party harnesses (January 2026), we want to ensure our implementation is compliant with Anthropic's Terms of Service.

We understand that tools spoofing Claude Code CLI headers were blocked. Our architecture is different:

- We use Anthropic's official SDK (claude-agent-sdk)

- We don't impersonate any Anthropic client

- We transparently identify as a third-party application

**Our Question:**

Is using `@anthropic-ai/claude-agent-sdk` with OAuth credentials from Claude Code CLI (~/.claude.json) compliant with your ToS? Or should we require users to provide their own API keys exclusively?

We're committed to building on Claude the right way and would appreciate official guidance.

Thank you for your time.

Best regards,

Alek Dobrohotov

Product Manager & AI-First Developer

C&C Apple Premium Partner

### Attachments to include:

- Architecture diagram showing SDK integration

- Code snippets demonstrating no header manipulation

### Contact Information Found:\n- **API/Technical Support**: support@anthropic.com (recommended for this inquiry)\n- **Help Center**: https://support.anthropic.com with chat widget\n- **Discord**: Anthropic developer community for discussions\n- **Alternative**: Open issue on GitHub anthropics/claude-code for public discussion
