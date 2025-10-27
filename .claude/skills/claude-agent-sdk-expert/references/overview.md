# Claude Agent SDK Overview

The Claude Agent SDK (formerly Claude Code SDK) is a powerful framework for building custom AI agents with autonomous capabilities.

## Installation

### TypeScript
```bash
npm install @anthropic-ai/claude-agent-sdk
```

### Python
```bash
pip install claude-agent-sdk
```

## Why Use the Claude Agent SDK?

Built on top of the agent harness that powers Claude Code, the Claude Agent SDK provides all the building blocks you need to build production-ready agents:

- **Context Management**: Automatic compaction and context management to ensure your agent doesn't run out of context
- **Rich tool ecosystem**: File operations, code execution, web search, and MCP extensibility
- **Advanced permissions**: Fine-grained control over agent capabilities
- **Production essentials**: Built-in error handling, session management, and monitoring
- **Optimized Claude integration**: Automatic prompt caching and performance optimizations

## What Can You Build?

### Coding Agents
- SRE agents that diagnose and fix production issues
- Security review bots that audit code for vulnerabilities
- Oncall engineering assistants that triage incidents
- Code review agents that enforce style and best practices

### Business Agents
- Legal assistants that review contracts and compliance
- Finance advisors that analyze reports and forecasts
- Customer support agents that resolve technical issues
- Content creation assistants for marketing teams

## Core Concepts

### Authentication

For basic authentication, retrieve a Claude API key from the [Claude Console](https://console.anthropic.com/) and set the `ANTHROPIC_API_KEY` environment variable.

The SDK also supports authentication via third-party API providers:
- **Amazon Bedrock**: Set `CLAUDE_CODE_USE_BEDROCK=1` environment variable
- **Google Vertex AI**: Set `CLAUDE_CODE_USE_VERTEX=1` environment variable

**Important**: We do not allow third party developers to apply Claude.ai rate limits for their products. Please use API key authentication methods instead.

### Full Claude Code Feature Support

The SDK provides access to all default features available in Claude Code:

- **Subagents**: Launch specialized agents stored as Markdown files in `./.claude/agents/`
- **Agent Skills**: Extend Claude with specialized capabilities stored as `SKILL.md` files in `./.claude/skills/`
- **Hooks**: Execute custom commands configured in `./.claude/settings.json` that respond to tool events
- **Slash Commands**: Use custom commands defined as Markdown files in `./.claude/commands/`
- **Plugins**: Load custom plugins programmatically using the `plugins` option
- **Memory (CLAUDE.md)**: Maintain project context through `CLAUDE.md` or `.claude/CLAUDE.md` files

**Important**: To load these features, you must explicitly set `settingSources: ['project']` (TypeScript) or `setting_sources=["project"]` (Python) in your options.

### System Prompts

System prompts define your agent's role, expertise, and behavior. This is where you specify what kind of agent you're building.

### Tool Permissions

Control which tools your agent can use with fine-grained permissions:
- `allowedTools` - Explicitly allow specific tools
- `disallowedTools` - Block specific tools
- `permissionMode` - Set overall permission strategy

### Model Context Protocol (MCP)

Extend your agents with custom tools and integrations through MCP servers. This allows you to connect to databases, APIs, and other external services.

## SDK Options

The Claude Agent SDK is available in multiple forms:

- **TypeScript SDK** - For Node.js and web applications
- **Python SDK** - For Python applications and data science
- **Streaming vs Single Mode** - Understanding input modes and best practices

## Related Resources

- [CLI Reference](https://docs.claude.com/en/docs/claude-code/cli-reference)
- [GitHub Actions Integration](https://docs.claude.com/en/docs/claude-code/github-actions)
- [MCP Documentation](https://docs.claude.com/en/docs/claude-code/mcp)
- [Common Workflows](https://docs.claude.com/en/docs/claude-code/common-workflows)
- [Troubleshooting](https://docs.claude.com/en/docs/claude-code/troubleshooting)

## Reporting Bugs

If you encounter bugs or issues:
- **TypeScript SDK**: [Report on GitHub](https://github.com/anthropics/claude-agent-sdk-typescript/issues)
- **Python SDK**: [Report on GitHub](https://github.com/anthropics/claude-agent-sdk-python/issues)
