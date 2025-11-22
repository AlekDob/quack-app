# Droid Templates Guide

Pre-built droid templates with complete agent configurations ready to use.

## Available Templates

### 1. Web Explorer

**File:** `assets/web-explorer.md`

**Purpose:** Browse and analyze web content with intelligent extraction

**Configuration:**
```yaml
name: web-explorer
description: "Browse and analyze web content with intelligent extraction"
tools: Read, WebFetch, WebSearch, Grep
model: sonnet
```

**Capabilities:**
- Search the web for information
- Extract content from websites
- Analyze web pages
- Monitor content changes
- Competitive research

**Best for:**
- Market research
- Competitor analysis
- Content aggregation
- Data extraction from websites
- Keeping track of web resources

**Use cases:**
- "Research our top 5 competitors"
- "Find the latest articles about AI in healthcare"
- "Extract pricing information from competitor websites"
- "Monitor changes on company website"

---

### 2. Code Explorer

**File:** `assets/code-explorer.md`

**Purpose:** Navigate and analyze existing codebase with deep understanding

**Configuration:**
```yaml
name: code-explorer
description: "Navigate and analyze existing codebase with deep understanding"
tools: Read, Grep, Glob, Bash
model: sonnet
```

**Capabilities:**
- Understand unfamiliar codebases
- Find code patterns and usage
- Trace function calls
- Generate architecture diagrams
- Analyze code structure

**Best for:**
- Onboarding to new codebases
- Understanding legacy code
- Finding implementation examples
- Analyzing code architecture
- Discovering code patterns

**Use cases:**
- "How does authentication work in this codebase?"
- "Find all usage of the UserService class"
- "Generate an architecture diagram of the data layer"
- "Trace the flow from API endpoint to database"

---

### 3. Documentation Writer

**File:** `assets/doc-writer.md`

**Purpose:** Create comprehensive documentation from code and context

**Configuration:**
```yaml
name: doc-writer
description: "Create comprehensive documentation from code and context"
tools: Read, Grep, Glob, Write
model: sonnet
```

**Capabilities:**
- Generate API documentation
- Write README files
- Create inline code comments
- Produce user guides
- Generate technical specifications

**Best for:**
- API documentation
- Project README creation
- Code commenting
- User guide writing
- Technical specification docs

**Use cases:**
- "Document the REST API endpoints"
- "Create a README for this project"
- "Add JSDoc comments to all functions in this file"
- "Generate user guide for the admin dashboard"

---

### 4. Bug Hunter

**File:** `assets/bug-hunter.md`

**Purpose:** Identify and analyze bugs with detailed debugging support

**Configuration:**
```yaml
name: bug-hunter
description: "Identify and analyze bugs with detailed debugging support"
tools: Read, Grep, Glob, Bash
model: sonnet
```

**Capabilities:**
- Debug failing tests
- Analyze error logs
- Trace exception sources
- Identify root causes
- Suggest fixes

**Best for:**
- Debugging test failures
- Analyzing production errors
- Finding bug root causes
- Error log analysis
- Exception tracking

**Use cases:**
- "Why is this test failing?"
- "Analyze the error logs from production"
- "Find the source of this null pointer exception"
- "Debug the failing CI/CD pipeline"

---

### 5. Test Generator

**File:** `assets/test-generator.md`

**Purpose:** Generate comprehensive test suites with edge cases

**Configuration:**
```yaml
name: test-generator
description: "Generate comprehensive test suites with edge cases"
tools: Read, Grep, Write
model: sonnet
```

**Capabilities:**
- Write unit tests
- Generate integration tests
- Create test fixtures
- Improve code coverage
- Generate edge case tests

**Best for:**
- Unit test creation
- Integration test generation
- Test fixture creation
- Coverage improvement
- Edge case testing

**Use cases:**
- "Generate unit tests for this component"
- "Create integration tests for the payment flow"
- "Add edge case tests for input validation"
- "Generate test fixtures for the User model"

---

## Using Templates

### Template Selection

Choose template based on primary task:

| Need | Template | Reason |
|------|----------|--------|
| Research competitors | Web Explorer | Web access needed |
| Understand codebase | Code Explorer | Code analysis focus |
| Write API docs | Doc Writer | Documentation generation |
| Debug failing test | Bug Hunter | Debugging capabilities |
| Improve test coverage | Test Generator | Test creation focus |

### Creating from Template

1. **Read template file:**
   ```
   Read assets/{template-name}.md
   ```

2. **Generate agent name:**
   - Use template's displayName
   - Convert to lowercase-with-hyphens

3. **Create agent file:**
   - Write to `.claude/agents/{name}.md`
   - Use exact template content

4. **Confirm creation:**
   - Show file path
   - Provide usage instructions

### Example: Creating Web Explorer

```
1. Read: assets/web-explorer.md
2. Name: "web-explorer" (from template)
3. Write: .claude/agents/web-explorer.md
4. Confirm: "Web Explorer droid created successfully"
```

---

## Template Customization

Templates can be used as-is or customized:

### Use Template As-Is

Best when:
- Template matches use case exactly
- No special requirements
- Quick creation needed

### Customize Template

Modify when:
- Need different tool permissions
- Want different model (opus/haiku)
- Need specific personality/tone
- Require additional capabilities

**How to customize:**
1. Start with template content
2. Modify YAML frontmatter (tools, model, description)
3. Adjust system prompt as needed
4. Save with new name

---

## Template Development

### Creating New Templates

To add new template:

1. **Identify common use case** that isn't covered
2. **Design agent configuration:**
   - Name and description
   - Appropriate tools
   - Clear system prompt

3. **Create template file** in `assets/`:
   ```markdown
   ---
   name: template-name
   description: "Clear purpose description"
   tools: Tool1, Tool2, Tool3
   model: sonnet
   ---

   [System prompt]
   ```

4. **Document template** in this guide

5. **Test template** with real tasks

### Template Quality Checklist

- ✅ Name follows naming convention (lowercase-with-hyphens)
- ✅ Description is clear and actionable
- ✅ Tools are minimum needed for task
- ✅ System prompt defines role clearly
- ✅ Capabilities are well-explained
- ✅ Communication style is specified
- ✅ Works for multiple similar tasks (not too specific)

---

## Template Maintenance

### When to Update Templates

Update when:
- New tools become available
- Better prompting patterns discovered
- User feedback suggests improvements
- Bug fixes or corrections needed

### Update Process

1. Identify improvement opportunity
2. Update template file in `assets/`
3. Update this documentation
4. Test updated template
5. Communicate changes to users

---

## Best Practices

1. **Start with Templates**: Use templates when possible before creating custom droids
2. **Minimal Customization**: Keep changes minimal to maintain template quality
3. **Test Before Production**: Test template-based droids before critical use
4. **Provide Feedback**: Report issues or improvement ideas
5. **Share Successful Customizations**: Help improve templates for everyone
