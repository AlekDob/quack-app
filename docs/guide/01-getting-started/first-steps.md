# First Steps with Quack

Now that you have Quack installed, let's explore the basic features and get you productive quickly.

## The Quack Interface

Quack is organized into several key areas:

### 1. Tab Bar (Top)
- **Chat Tab**: Main conversation with Claude
- **Terminal Tabs**: Each open terminal appears as a tab
- **File Tabs**: Opened files for quick reference
- **Browser Tabs**: Integrated web browser for localhost apps

### 2. Sidebar (Left)
- **Chat**: AI conversation interface
- **File Explorer**: Navigate your project files
- **Git**: Version control operations
- **Agents**: Manage available agents
- **Skills**: Browse and use Claude skills
- **Commands**: Quick access to slash commands

### 3. Main Content Area
- **Terminal**: XTerm.js-powered terminal
- **Editor**: Code viewer (coming soon)
- **Browser**: Embedded web view for local apps

### 4. Status Bar (Bottom)
- Connection status
- Current working directory
- Active model information

## Opening Your First Terminal

Let's start by opening a terminal:

1. Click the **+** button in the tab bar (or press `Cmd/Ctrl + T`)
2. A new terminal tab will appear
3. The terminal starts in your home directory by default

Try running some basic commands:

```bash
# Check current directory
pwd

# List files
ls -la

# Navigate to a project
cd ~/projects/my-app

# Run a dev server
npm run dev
```

## Having Your First Conversation

Claude is always ready in the Chat tab:

1. Click the **Chat** tab (or press `Cmd/Ctrl + 1`)
2. Type a question or request
3. Press `Enter` to send

**Try these prompts**:

```
Explain the difference between let and const in JavaScript
```

```
How do I create a React component with TypeScript?
```

```
Show me best practices for error handling in async functions
```

## Using File References

One of Quack's most powerful features is **file context**:

You can reference files in your prompts using the `@` symbol:

```
Explain what this file does @src/App.tsx
```

```
Find bugs in @src/components/Terminal.tsx
```

```
Analyze all components in @src/components/*.tsx
```

## Working with Multiple Terminals

Quack supports multiple terminals running simultaneously:

1. Open a new terminal: `Cmd/Ctrl + T`
2. Each terminal maintains its own session
3. Switch between terminals by clicking their tabs
4. Color indicators help distinguish terminals
5. Close terminals with the × button

**Use case example**:
- Terminal 1: Running `npm run dev`
- Terminal 2: Running `npm test --watch`
- Terminal 3: Git operations

## Exploring Agents

Agents are specialized AI assistants for specific tasks:

1. Click **Agents** in the sidebar
2. Browse available agents (git-flow-manager, test-engineer, etc.)
3. Click an agent to learn what it does
4. Use agents via chat: `/agent-name task description`

## Using Skills

Skills provide domain-specific knowledge:

1. Click **Skills** in the sidebar
2. Browse skills (xterm-terminal-expert, tauri-build-expert, etc.)
3. Click a skill to read its documentation
4. Skills are automatically available to Claude

## Slash Commands

Quick actions are available via slash commands:

**In Chat**:
- `/feature` - Create a Git Flow feature branch
- `/commit` - Commit changes with AI-generated message
- `/code-review` - Review uncommitted changes
- `/diary` - Log progress and plan next steps

Type `/` in the chat to see all available commands.

## Keyboard Shortcuts

Speed up your workflow with keyboard shortcuts:

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| New Terminal | `Cmd + T` | `Ctrl + T` |
| Close Tab | `Cmd + W` | `Ctrl + W` |
| Switch Tabs | `Cmd + 1-9` | `Ctrl + 1-9` |
| Open Settings | `Cmd + ,` | `Ctrl + ,` |
| Search | `Cmd + F` | `Ctrl + F` |
| Command Palette | `Cmd + P` | `Ctrl + P` |

## Next Steps

Now that you're familiar with the basics:

- Explore [Core Concepts](../02-core-concepts/what-is-claude-code) to understand how Claude Code works
- Learn [Prompting Basics](../02-core-concepts/prompting-basics) for better AI interactions
- Discover [Advanced Techniques](../03-advanced-techniques/agent-architecture) for power users

---

**Previous**: [← Installation](./installation)
**Next**: [What is Claude Code? →](../02-core-concepts/what-is-claude-code)
