# Tool Permissions Reference

Complete guide to tool permissions system for droid creation.

## Permission Levels

Choose appropriate tool set based on droid's purpose and required capabilities.

### Level 1: Read-Only (Safest)

**Tools:** `Read, Grep, Glob`

**Capabilities:**
- Read files from filesystem
- Search file contents with regex
- Find files by pattern matching

**Use cases:**
- Research and analysis
- Code exploration
- Documentation review
- Pattern discovery
- Architecture understanding

**Security level:** Low risk - cannot modify files or execute commands

**Example droids:**
- Code Explorer
- Documentation Reviewer
- Pattern Analyzer

---

### Level 2: Read + Web

**Tools:** `Read, Grep, Glob, WebFetch, WebSearch`

**Capabilities:**
- All Level 1 tools
- Fetch web content
- Search the internet
- Extract data from websites

**Use cases:**
- Web research
- Competitive analysis
- Content extraction
- Data aggregation
- Market research

**Security level:** Low-moderate risk - can access external web resources

**Example droids:**
- Web Explorer
- Competitor Researcher
- Content Aggregator

---

### Level 3: Read + Execute

**Tools:** `Read, Grep, Glob, Bash`

**Capabilities:**
- All Level 1 tools
- Execute bash commands
- Run tests
- Build projects
- Install dependencies

**Use cases:**
- Code analysis with execution
- Test running
- Build verification
- Dependency management
- Performance benchmarking

**Security level:** Moderate risk - can execute system commands

**Example droids:**
- Test Runner
- Build Analyzer
- Performance Tester
- Bug Hunter

---

### Level 4: Read + Write

**Tools:** `Read, Grep, Glob, Write, Edit`

**Capabilities:**
- All Level 1 tools
- Create new files
- Modify existing files
- Generate code
- Update documentation

**Use cases:**
- Documentation generation
- Code generation
- Refactoring
- Template creation
- Content writing

**Security level:** Moderate-high risk - can modify codebase

**Example droids:**
- Documentation Writer
- Code Generator
- Refactoring Assistant
- Template Builder

---

### Level 5: Full Access (Maximum)

**Tools:** `Read, Write, Edit, Bash, Grep, Glob, WebFetch, WebSearch, Task, SlashCommand, TodoWrite, NotebookEdit`

**Capabilities:**
- All tools available
- Can orchestrate complex workflows
- Can spawn sub-agents
- Can modify files and execute commands
- Can access web resources

**Use cases:**
- Complex multi-step tasks
- Full feature implementation
- End-to-end workflows
- Agent orchestration
- Complete project tasks

**Security level:** High risk - unrestricted access

**Example droids:**
- Feature Builder
- Project Manager
- Full-Stack Developer
- DevOps Engineer

---

## Tool Reference

### File System Tools

**Read**
- Read files from disk
- Supports line offsets and limits
- Can read images and PDFs

**Write**
- Create new files
- Overwrite existing files (with confirmation)
- Cannot edit existing files (use Edit instead)

**Edit**
- Modify existing files
- String replacement operations
- Preserves file structure

**Glob**
- Find files by pattern
- Supports wildcards (*, **, ?)
- Returns file paths

**Grep**
- Search file contents
- Supports regex patterns
- Can filter by file type

---

### Execution Tools

**Bash**
- Execute bash commands
- Run scripts
- Install packages
- Build projects
- Run tests

---

### Web Tools

**WebFetch**
- Fetch web page content
- Extract data from URLs
- Process HTML to markdown

**WebSearch**
- Search the internet
- Find relevant web resources
- Get current information

---

### Orchestration Tools

**Task**
- Spawn sub-agents
- Delegate to specialized agents
- Coordinate multi-agent workflows

**SlashCommand**
- Execute slash commands
- Invoke pre-configured workflows
- Run project-specific commands

---

### Utility Tools

**TodoWrite**
- Create task lists
- Track progress
- Manage work items

**NotebookEdit**
- Edit Jupyter notebooks
- Modify notebook cells
- Manage notebook content

---

## Selection Guide

### By Task Type

| Task Type | Recommended Level | Tools |
|-----------|------------------|-------|
| Research | Level 1 | Read, Grep, Glob |
| Web Research | Level 2 | + WebFetch, WebSearch |
| Testing | Level 3 | + Bash |
| Documentation | Level 4 | + Write, Edit |
| Feature Building | Level 5 | All tools |

### By Domain

| Domain | Recommended Level | Rationale |
|--------|------------------|-----------|
| Code Analysis | Level 1 or 3 | Read-only for analysis, Bash for running tests |
| Web Scraping | Level 2 | Needs web access but not file modification |
| Bug Fixing | Level 5 | Needs to read, modify files, and run tests |
| Documentation | Level 4 | Needs to read code and write docs |
| DevOps | Level 5 | Needs full access for deployments |

---

## Security Best Practices

1. **Principle of Least Privilege**: Grant minimum tools needed
2. **Start Small**: Begin with lower level, upgrade if needed
3. **Review Regularly**: Audit droid permissions periodically
4. **Isolate High-Risk**: Keep Level 5 droids for specific tasks
5. **Test First**: Try droids in safe environment before production use

---

## Auto-Selection Logic

When creating custom droids, suggest level based on keywords:

**Level 1 triggers:**
- "analyze", "review", "explore", "understand", "search"

**Level 2 triggers:**
- "research", "web", "fetch", "scrape", "competitor"

**Level 3 triggers:**
- "test", "run", "build", "execute", "benchmark"

**Level 4 triggers:**
- "document", "write", "generate", "create", "refactor"

**Level 5 triggers:**
- "implement", "build feature", "full-stack", "deploy", "orchestrate"

---

## Validation

All tool names must:
- Match exact case (e.g., `Read` not `read`)
- Be valid tool names from the list above
- Be comma-separated in YAML frontmatter

**Example valid tools specification:**
```yaml
tools: Read, Grep, Glob, Write, Edit
```

**Example invalid:**
```yaml
tools: read, grep, glob  # Wrong case
tools: ReadTool          # Not a valid tool name
tools: Read Grep Glob    # Missing commas
```
