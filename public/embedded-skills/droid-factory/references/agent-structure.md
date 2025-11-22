# Agent File Structure

This document describes the proper structure for agent files in Claude Code.

## File Format

Agent files are Markdown files with YAML frontmatter stored in `.claude/agents/` directory.

### Filename Convention

- Lowercase with hyphens only
- Format: `{agent-name}.md`
- Example: `api-documentation-writer.md`

### File Structure

```markdown
---
name: agent-name
description: "Clear, concise description of agent purpose"
tools: Tool1, Tool2, Tool3
model: sonnet
---

[System prompt content in markdown]
```

## YAML Frontmatter

### Required Fields

**name** (string):
- Lowercase with hyphens only
- Pattern: `/^[a-z0-9-]+$/`
- Example: `web-explorer`, `api-documentation-writer`

**description** (string):
- Clear, actionable description of agent purpose
- Quoted string
- Example: "Browse and analyze web content with intelligent extraction"

### Optional Fields

**tools** (comma-separated string):
- List of tool names the agent can use
- Valid tools: Read, Write, Edit, Bash, Grep, Glob, WebFetch, WebSearch, Task, SlashCommand, TodoWrite, NotebookEdit
- If omitted, agent inherits all tools from parent
- Example: `Read, Grep, Glob, Write`

**model** (string):
- AI model for the agent
- Options: `sonnet`, `opus`, `haiku`, `inherit`
- Default: `inherit` (use parent's model)
- Example: `sonnet`

## System Prompt

Content after YAML frontmatter defines the agent's behavior.

### Structure Guidelines

1. **Role Definition**: Clear statement of agent's identity and purpose
2. **Expertise**: Specific domain knowledge and capabilities
3. **Working Method**: How the agent approaches tasks
4. **Communication Style**: Tone and interaction preferences
5. **Limitations**: What the agent should avoid or cannot do

### Example System Prompt

```markdown
You are API Documentation Writer, a specialized AI agent for API documentation and OpenAPI specs.

**Your role:**
Create comprehensive API documentation from code and specifications.

**Your expertise:**
API documentation and OpenAPI specification generation.

**How you work:**
- Analyze code to extract API structure
- Generate clear, developer-friendly documentation
- Create OpenAPI/Swagger specifications
- Follow industry best practices for API docs

**Communication style:**
Professional and efficient, focused on delivering clear documentation.
```

## Validation Rules

### Name Validation

```regex
/^[a-z0-9-]+$/
```

Must be:
- Lowercase only
- Alphanumeric characters and hyphens
- No spaces, underscores, or special characters
- No leading/trailing hyphens

### Tool Validation

All tool names must match exact case-sensitive tool names:
- ✅ `Read, Grep, Glob`
- ❌ `read, grep, glob`
- ❌ `ReadTool`

### Model Validation

Must be one of:
- `sonnet`
- `opus`
- `haiku`
- `inherit`

### YAML Syntax

- Proper YAML formatting
- Quoted strings for description
- Comma-separated tools list
- Three dashes before and after frontmatter

## Complete Example

```markdown
---
name: competitor-researcher
description: "Analyze competitor websites and extract key business intelligence"
tools: Read, WebFetch, WebSearch, Grep
model: sonnet
---

You are Competitor Researcher, a specialized AI agent for competitive analysis and business intelligence.

**Your role:**
Research and analyze competitor activities, products, and market positioning through web analysis.

**Your expertise:**
Competitive intelligence, web content extraction, market analysis, and strategic insights.

**How you work:**
- Search and analyze competitor websites systematically
- Extract key information: products, pricing, features, messaging
- Identify patterns and trends in competitor activities
- Provide actionable insights with data-driven recommendations
- Track changes and updates over time

**Communication style:**
Professional and analytical, delivering clear insights backed by evidence.

**Output format:**
- Executive summary with key findings
- Detailed analysis organized by topic
- Data tables for quantitative comparisons
- Actionable recommendations based on insights
```

## Common Mistakes to Avoid

1. **Uppercase in name**: ❌ `API-Writer` → ✅ `api-writer`
2. **Spaces in name**: ❌ `api writer` → ✅ `api-writer`
3. **Invalid tools**: ❌ `FileRead` → ✅ `Read`
4. **Unquoted description**: ❌ `description: My agent` → ✅ `description: "My agent"`
5. **Wrong model**: ❌ `model: claude-sonnet` → ✅ `model: sonnet`
6. **Missing frontmatter dashes**: Must have `---` before and after YAML
