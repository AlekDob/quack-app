# Agent Skills in the SDK

Agent Skills extend Claude with specialized capabilities that Claude autonomously invokes when relevant. Skills are packaged as `SKILL.md` files containing instructions, descriptions, and optional supporting resources.

## Overview

Skills are:
1. **Defined as filesystem artifacts**: Created as `SKILL.md` files in `.claude/skills/`
2. **Loaded from filesystem**: Skills must be loaded by specifying `settingSources` or `setting_sources`
3. **Automatically discovered**: Skill metadata is discovered at startup; full content loaded when triggered
4. **Model-invoked**: Claude autonomously chooses when to use them based on context
5. **Enabled via allowed_tools**: Add `"Skill"` to your `allowed_tools` to enable Skills

**Important**: Unlike subagents (which can be defined programmatically), Skills must be created as filesystem artifacts.

**Default behavior**: By default, the SDK does not load any filesystem settings. To use Skills, you must explicitly configure `settingSources: ['user', 'project']` (TypeScript) or `setting_sources=["user", "project"]` (Python).

## Using Skills with the SDK

To use Skills, you need to:
1. Include `"Skill"` in your `allowed_tools` configuration
2. Configure `settingSources`/`setting_sources` to load Skills from the filesystem

### TypeScript Example
```typescript
import { query, ClaudeAgentOptions } from '@anthropic-ai/claude-agent-sdk';

const options: ClaudeAgentOptions = {
  cwd: "/path/to/project",  // Project with .claude/skills/
  settingSources: ["user", "project"],  // Load Skills from filesystem
  allowedTools: ["Skill", "Read", "Write", "Bash"]  // Enable Skill tool
};

for await (const message of query({
  prompt: "Help me process this PDF document",
  options
})) {
  console.log(message);
}
```

### Python Example
```python
from claude_agent_sdk import query, ClaudeAgentOptions

options = ClaudeAgentOptions(
    cwd="/path/to/project",
    setting_sources=["user", "project"],
    allowed_tools=["Skill", "Read", "Write", "Bash"]
)

async for message in query(
    prompt="Help me process this PDF document",
    options=options
):
    print(message)
```

## Skill Locations

Skills are loaded from filesystem directories based on your `settingSources`/`setting_sources` configuration:

- **Project Skills** (`.claude/skills/`): Shared with your team via git - loaded when `setting_sources` includes `"project"`
- **User Skills** (`~/.claude/skills/`): Personal Skills across all projects - loaded when `setting_sources` includes `"user"`
- **Plugin Skills**: Bundled with installed Claude Code plugins

## Creating Skills

Skills are defined as directories containing a `SKILL.md` file with YAML frontmatter and Markdown content.

### Example Directory Structure
```
.claude/skills/processing-pdfs/
└── SKILL.md
```

### SKILL.md Structure
```markdown
---
name: processing-pdfs
description: Extract text and metadata from PDF documents. Use when the user wants to read, analyze, or process PDF files.
---

# PDF Processing Skill

To process PDF documents:
1. Use the `extract_pdf_text` script to extract text content
2. Parse metadata from the PDF header
3. Return structured information to the user

## Available Tools
- scripts/extract_pdf_text.py - Extracts text from PDF files
- scripts/parse_pdf_metadata.py - Extracts PDF metadata
```

**Important**: The `description` field determines when Claude invokes your Skill. Make it specific and include relevant keywords.

## Tool Restrictions

The `allowed-tools` frontmatter field in SKILL.md is only supported when using Claude Code CLI directly. **It does not apply when using Skills through the SDK**.

When using the SDK, control tool access through the main `allowedTools` option:

```typescript
const options: ClaudeAgentOptions = {
  setting_sources: ["user", "project"],
  allowed_tools: ["Skill", "Read", "Grep", "Glob"]  // Restricted toolset
};
```

## Discovering Available Skills

To see which Skills are available, simply ask Claude:

```typescript
const options: ClaudeAgentOptions = {
  setting_sources: ["user", "project"],
  allowed_tools: ["Skill"]
};

for await (const message of query({
  prompt: "What Skills are available?",
  options
})) {
  console.log(message);
}
```

## Testing Skills

Test Skills by asking questions that match their descriptions:

```typescript
const options: ClaudeAgentOptions = {
  cwd: "/path/to/project",
  setting_sources: ["user", "project"],
  allowed_tools: ["Skill", "Read", "Bash"]
};

for await (const message of query({
  prompt: "Extract text from invoice.pdf",
  options
})) {
  console.log(message);
}
```

Claude automatically invokes the relevant Skill if the description matches your request.

## Troubleshooting

### Skills Not Found

**Check settingSources configuration**: This is the most common issue. Skills are only loaded when you explicitly configure `settingSources`/`setting_sources`:

```typescript
// Wrong - Skills won't be loaded
const options = {
  allowed_tools: ["Skill"]
};

// Correct - Skills will be loaded
const options = {
  setting_sources: ["user", "project"],  // Required!
  allowed_tools: ["Skill"]
};
```

**Check working directory**: The SDK loads Skills relative to the `cwd` option. Ensure it points to a directory containing `.claude/skills/`:

```typescript
const options = {
  cwd: "/path/to/project",  // Must contain .claude/skills/
  setting_sources: ["user", "project"],
  allowed_tools: ["Skill"]
};
```

**Verify filesystem location**:
```bash
# Check project Skills
ls .claude/skills/*/SKILL.md

# Check personal Skills
ls ~/.claude/skills/*/SKILL.md
```

### Skill Not Being Used

**Check the Skill tool is enabled**: Confirm `"Skill"` is in your `allowedTools`.

**Check the description**: Ensure it's specific and includes relevant keywords. The description determines when Claude invokes the Skill.

## Progressive Disclosure Design

Skills use a three-level loading system:
1. **Metadata (name + description)** - Always in context (~100 words)
2. **SKILL.md body** - When skill triggers (<5k words)
3. **Bundled resources** - As needed by Claude (unlimited*)

*Scripts can be executed without reading into context window.

## Related Documentation

- [Agent Skills in Claude Code](https://docs.claude.com/en/docs/claude-code/skills)
- [Agent Skills Overview](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview)
- [Agent Skills Best Practices](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/best-practices)
- [Agent Skills Cookbook](https://github.com/anthropics/claude-cookbooks/tree/main/skills)
