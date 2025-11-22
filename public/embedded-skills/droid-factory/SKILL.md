---
name: droid-factory
description: "Create specialized AI agents (droids) with proper YAML frontmatter structure. Use this skill when users request to create new agents through the Droid Factory UI or via commands. Supports both template-based and custom droid creation."
---

# Droid Factory

Create specialized AI agents (droids) for Quack with proper agent file structure.

## When to Use This Skill

Use this skill when:
- User clicks "Create Droid" button in Droid Factory UI
- User provides droid specifications (name, description, tools, model, specialization)
- User requests to create agent from template or custom configuration
- Triggered by Droid Factory UI component sending droid spec

## Droid Creation Workflow

### Step 1: Receive Droid Specification

Expect to receive a `DroidSpec` object with:
- **displayName**: Human-readable name (e.g., "API Documentation Writer")
- **description**: Clear purpose description
- **specialization**: Area of expertise
- **tools**: Array of tool names (see Tool Permissions section)
- **model**: `sonnet` | `opus` | `haiku` | `inherit`

### Step 2: Generate Agent Name

Convert displayName to agent name:
```
name = displayName
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
```

Example: "API Documentation Writer" → "api-documentation-writer"

### Step 3: Validate Specification

Check all fields meet requirements:
- Name: lowercase with hyphens only (`/^[a-z0-9-]+$/`)
- Tools: all tool names must be valid (see Tool Permissions)
- Model: must be `sonnet`, `opus`, `haiku`, or `inherit`
- Description: non-empty and clear
- Specialization: non-empty

If validation fails, return error message with specific issue.

### Step 4: Generate Agent File Content

Create markdown file with YAML frontmatter + system prompt:

```markdown
---
name: {generated-name}
description: "{description}"
tools: {tool1}, {tool2}, {tool3}
model: {model}
---

You are {displayName}, a specialized AI agent for {specialization}.

**Your role:**
{description}

**Your expertise:**
{specialization}

**How you work:**
- Focus on delivering value in {specialization}
- Use available tools effectively to accomplish tasks
- Provide clear, structured outputs
- Follow best practices in your domain

**Communication style:**
Professional and efficient, focused on solving problems.
```

### Step 5: Write Agent File

Use Write tool to create file at `.claude/agents/{name}.md` with generated content.

Check if file already exists:
- If exists: Confirm with user before overwriting
- If new: Create directly

### Step 6: Confirm Creation

Provide confirmation message with:
- File path (`.claude/agents/{name}.md`)
- Brief summary of droid capabilities
- Example usage instructions

## Tool Permissions

Select appropriate tool set based on droid purpose:

**Level 1 - Read-Only** (safest):
- Tools: `Read, Grep, Glob`
- Use for: Research, analysis, exploration

**Level 2 - Read + Web**:
- Tools: `Read, Grep, Glob, WebFetch, WebSearch`
- Use for: Web research, content extraction

**Level 3 - Read + Execute**:
- Tools: `Read, Grep, Glob, Bash`
- Use for: Code analysis, testing, builds

**Level 4 - Read + Write**:
- Tools: `Read, Grep, Glob, Write, Edit`
- Use for: Documentation, code generation

**Level 5 - Full Access**:
- Tools: `Read, Write, Edit, Bash, Grep, Glob, WebFetch, WebSearch, Task`
- Use for: Complex orchestration, multi-step tasks

**Valid Tool Names:**
`Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob`, `WebFetch`, `WebSearch`, `Task`, `SlashCommand`, `TodoWrite`, `NotebookEdit`

## Template-Based Creation

Templates are stored in `assets/` directory:
- `web-explorer.md` - Web research and content analysis
- `code-explorer.md` - Code analysis and architecture understanding
- `doc-writer.md` - Technical writing and documentation
- `bug-hunter.md` - Debugging and error analysis
- `test-generator.md` - Test automation and quality assurance

To use template:
1. Read template file from `assets/{template-name}.md`
2. Generate name from template's displayName
3. Create file in `.claude/agents/{name}.md` with template content
4. Confirm creation with usage instructions

## Error Handling

Handle common errors gracefully:

| Error | Solution |
|-------|----------|
| Invalid name format | Auto-convert to lowercase-with-hyphens |
| Invalid tool name | Return error listing valid tools |
| File already exists | Ask user to confirm overwrite or choose new name |
| Empty required field | Return error specifying missing field |
| Invalid model | Return error listing valid models |

## Success Criteria

Creation is successful when:
1. File exists at `.claude/agents/{name}.md`
2. YAML frontmatter is properly formatted
3. All tools are valid tool names
4. System prompt is clear and actionable
5. User receives confirmation with file path

## Example Usage

**Custom droid creation:**
```
Input spec:
{
  displayName: "API Documentation Writer",
  description: "Create comprehensive API documentation from code",
  specialization: "API documentation and OpenAPI specs",
  tools: ["Read", "Grep", "Glob", "Write"],
  model: "sonnet"
}

Generated name: "api-documentation-writer"
File path: ".claude/agents/api-documentation-writer.md"

Output: "Droid 'API Documentation Writer' created successfully at .claude/agents/api-documentation-writer.md"
```

## References

For detailed information, see reference files:
- `references/tool-permissions.md` - Complete tool permission documentation
- `references/agent-structure.md` - Agent file format specification
- `references/templates-guide.md` - Pre-built template documentation

## Assets

Pre-built template files in `assets/` directory:
- Template files are complete, ready-to-use agent configurations
- Can be copied directly to `.claude/agents/` with appropriate naming
