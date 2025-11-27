# Introduction to Quack

Welcome to **Quack** - your multi-agentic IDE powered by Claude Code!

![Quack Agent](/images/quack-agent.jpeg)

---

## What is Quack?

Quack is a **multi-agentic IDE** built on top of Claude Code that revolutionizes how you work on software projects. Unlike traditional IDEs or AI assistants, Quack allows you to:

- Work on **multiple projects simultaneously** with different agents
- Run **multiple agents on the same project**, each focused on specific tasks
- Operate on the **same branch or different worktrees** in parallel
- Give each agent a **unique personality** and specialized focus

Think of Quack as your **AI development team** - where each agent is a team member with specific expertise, working together on your codebase.

---

## Core Architecture: Droids & Skills

Quack is built on two fundamental principles:

### Droids (Specialized Subagents)

Droids are **isolated subagents** specialized in specific contexts:

- Each Droid works in a **sandboxed environment**
- They execute specialized tasks and **return only what the main agent needs**
- Examples: `frontend-developer`, `test-engineer`, `security-auditor`, `code-reviewer`
- Droids don't pollute the main conversation - they deliver focused results

```
Main Agent → Delegates to Droid → Droid works in isolation → Returns results
```

### Skills (Modular Abilities)

Skills are **modular capabilities** that extend what agents and droids can do. They are **model-invoked** - Claude autonomously decides when to use them based on your request and the skill's description.

- Skills are packaged as **organized folders** containing instructions, scripts, and resources
- They define **how** to approach specific tasks with specialized knowledge
- Skills can be **personal** (your own), **project-based** (shared with team), or from **plugins**
- Claude **discovers and uses them automatically** when relevant

**Examples of Skills:**
- `commit-message-generator` - Creates clear, standardized git commit messages
- `code-reviewer` - Analyzes code for best practices and potential issues
- `pdf-processor` - Extracts text, fills forms, merges PDF documents
- `release-notes-generator` - Generates changelog from commits
- `test-data-cleanup` - Manages test fixtures and mock data

### Teaching Your Agents

One of Quack's most powerful features is the ability to **teach agents**:

- Define **when** to use specific skills
- Configure **which droids** to invoke for certain tasks
- Create **custom behaviors** based on your workflow
- Build specialized agents for your project's needs

---

## Real-Time Agent Monitoring

One of Quack's killer features is the **Agent Panel** - a real-time dashboard that keeps you in control of all your agents:

### Live Activity View

- See **what each agent is working on** at a glance
- Monitor **progress and status** across all active sessions
- Switch between agents instantly without losing context

### Smart Notifications

Never miss when an agent completes a task! Quack notifies you through multiple channels:

- **Quack Sound** - A distinctive audio alert when an agent finishes
- **macOS Notification** - Native system notification with task summary
- **Telegram Integration** - Get notified on your phone, wherever you are

This means you can **start multiple agents on different tasks**, go grab a coffee, and get pinged the moment any of them needs your attention. True multitasking productivity!

---

## Why Quack?

### True Multi-Agent Workflow

```
Project A                    Project B
   │                            │
   ├── Agent: Laura (Features)  ├── Agent: Max (Refactoring)
   ├── Agent: Dev (Tests)       └── Agent: Doc (Documentation)
   └── Agent: Review (Code Review)
```

Each agent maintains its own:
- Conversation context
- Working directory
- Personality and focus area
- Skill set and droid access

### Parallel Development

Work on multiple aspects simultaneously:
- **Same project, different tasks**: One agent on features, another on tests
- **Same branch**: Multiple perspectives on the same codebase
- **Different worktrees**: Parallel development without conflicts
- **Cross-project**: Manage multiple repositories at once

### Context Isolation

Droids ensure clean separation:
- Main agent stays focused on high-level decisions
- Complex tasks are delegated without cluttering context
- Results are synthesized and returned cleanly
- Token usage is optimized

---

## Who is Quack For?

**Solo Developers** who want to:
- Multiply their productivity with specialized agents
- Work on multiple aspects of a project in parallel
- Build a personal AI development team

**Teams** looking for:
- Consistent agent configurations across developers
- Specialized agents for different roles (QA, Security, Docs)
- Scalable AI-assisted workflows

**Claude Code Power Users** who need:
- Better orchestration of AI capabilities
- Visual management of multiple agent sessions
- Advanced customization of agent behaviors

---

## Getting Started

Ready to build your AI development team? Continue to the [Installation Guide](./installation) to set up Quack on your machine.

Or jump to [First Steps](./first-steps) to create your first agent and learn the basics.

---

**Next**: [Installation →](./installation)
