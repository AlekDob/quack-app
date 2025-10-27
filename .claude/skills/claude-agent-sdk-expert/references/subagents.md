# Subagents in the SDK

Subagents in the Claude Agent SDK are specialized AIs orchestrated by the main agent. Use subagents for context management and parallelization.

## Overview

Subagents can be defined in two ways:
1. **Programmatically** - Using the `agents` parameter in your `query()` options (recommended)
2. **Filesystem-based** - Placing markdown files with YAML frontmatter in `.claude/agents/`

## Benefits of Using Subagents

### Context Management
Subagents maintain separate context from the main agent, preventing information overload. Only relevant findings are returned to the main conversation.

**Example**: A `research-assistant` subagent can explore dozens of files without cluttering the main conversation with intermediate search results.

### Parallelization
Multiple subagents can run concurrently, dramatically speeding up complex workflows.

**Example**: During code review, run `style-checker`, `security-scanner`, and `test-coverage` subagents simultaneously.

### Specialized Instructions
Each subagent can have tailored system prompts with specific expertise, best practices, and constraints.

**Example**: A `database-migration` subagent can have detailed SQL knowledge unnecessary in the main agent's instructions.

### Tool Restrictions
Subagents can be limited to specific tools, reducing risk of unintended actions.

**Example**: A `doc-reviewer` subagent might only have access to Read and Grep tools.

## Creating Subagents

### Programmatic Definition (Recommended)

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

const result = query({
  prompt: "Review the authentication module for security issues",
  options: {
    agents: {
      'code-reviewer': {
        description: 'Expert code review specialist. Use for quality, security, and maintainability reviews.',
        prompt: `You are a code review specialist with expertise in security, performance, and best practices.

When reviewing code:
- Identify security vulnerabilities
- Check for performance issues
- Verify adherence to coding standards
- Suggest specific improvements`,
        tools: ['Read', 'Grep', 'Glob'],
        model: 'sonnet'
      }
    }
  }
});
```

### AgentDefinition Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | `string` | Yes | Natural language description of when to use this agent |
| `prompt` | `string` | Yes | The agent's system prompt defining its role and behavior |
| `tools` | `string[]` | No | Array of allowed tool names. If omitted, inherits all tools |
| `model` | `'sonnet' \| 'opus' \| 'haiku' \| 'inherit'` | No | Model override for this agent |

### Filesystem-Based Definition

Create markdown files in `.claude/agents/`:

```markdown
---
name: code-reviewer
description: Expert code review specialist. Use for quality, security, and maintainability reviews.
tools: Read, Grep, Glob, Bash
---

Your subagent's system prompt goes here. This defines the subagent's
role, capabilities, and approach to solving problems.
```

**Note**: Programmatically defined agents take precedence over filesystem-based agents with the same name.

## How the SDK Uses Subagents

1. **Load programmatic agents** from the `agents` parameter
2. **Auto-detect filesystem agents** from `.claude/agents/` directories
3. **Invoke them automatically** based on task matching and the agent's `description`
4. **Use their specialized prompts** and tool restrictions
5. **Maintain separate context** for each subagent invocation

## SDK Integration Patterns

### Automatic Invocation

The SDK will automatically invoke appropriate subagents based on task context. Ensure your agent's `description` clearly indicates when it should be used:

```typescript
const result = query({
  prompt: "Optimize the database queries in the API layer",
  options: {
    agents: {
      'performance-optimizer': {
        description: 'Use PROACTIVELY when code changes might impact performance. MUST BE USED for optimization tasks.',
        prompt: 'You are a performance optimization specialist...',
        tools: ['Read', 'Edit', 'Bash', 'Grep'],
        model: 'sonnet'
      }
    }
  }
});
```

### Explicit Invocation

Users can request specific subagents in their prompts:

```typescript
const result = query({
  prompt: "Use the code-reviewer agent to check the authentication module",
  options: {
    agents: {
      'code-reviewer': {
        description: 'Expert code review specialist',
        prompt: 'You are a security-focused code reviewer...',
        tools: ['Read', 'Grep', 'Glob']
      }
    }
  }
});
```

### Dynamic Agent Configuration

Dynamically configure agents based on your application's needs:

```typescript
function createSecurityAgent(securityLevel: 'basic' | 'strict'): AgentDefinition {
  return {
    description: 'Security code reviewer',
    prompt: `You are a ${securityLevel === 'strict' ? 'strict' : 'balanced'} security reviewer...`,
    tools: ['Read', 'Grep', 'Glob'],
    model: securityLevel === 'strict' ? 'opus' : 'sonnet'
  };
}
```

## Tool Restrictions

### Common Tool Combinations

**Read-only agents** (analysis, review):
```typescript
tools: ['Read', 'Grep', 'Glob']
```

**Test execution agents**:
```typescript
tools: ['Bash', 'Read', 'Grep']
```

**Code modification agents**:
```typescript
tools: ['Read', 'Edit', 'Write', 'Grep', 'Glob']
```

## Example Subagents

### Code Reviewer
```typescript
'code-reviewer': {
  description: 'Expert code review specialist. Use for quality, security, and maintainability reviews.',
  prompt: `Review code for:
- Security vulnerabilities
- Performance issues
- Coding standards
- Specific improvements`,
  tools: ['Read', 'Grep', 'Glob']
}
```

### Test Runner
```typescript
'test-runner': {
  description: 'Runs and analyzes test suites. Use for test execution and coverage analysis.',
  prompt: `Run tests and provide clear analysis:
- Execute test commands
- Analyze test output
- Identify failing tests
- Suggest fixes`,
  tools: ['Bash', 'Read', 'Grep']
}
```

### Security Scanner
```typescript
'security-scanner': {
  description: 'Security vulnerability scanner. Use PROACTIVELY for security reviews.',
  prompt: `Scan for security issues:
- SQL injection risks
- XSS vulnerabilities
- Authentication flaws
- Dependency vulnerabilities`,
  tools: ['Read', 'Grep', 'Glob', 'Bash']
}
```
