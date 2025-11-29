- **File Preview Drawer**: `src/components/FilePreviewDrawer.tsx` – drawer for previewing file contents (up to 5MB)
- **File Context Menu**: `src/components/FileContextMenu.tsx` – right-click context menu for file operations

#### Git Integration

- **Git Panel**: `src/components/GitPanel.tsx` – Git status, diff viewer, stage/unstage, commit UI, and timeline
- **Diff Viewer**: `src/components/DiffViewer.tsx` – side-by-side diff display for worktree and staged changes

#### AI Assistant (Claude Agent SDK)

- **AI Assistant**: `src/components/AIAssistant.tsx` – main AI assistant interface
- **Chat View**: `src/components/ChatView.tsx` – chat interface with streaming messages
- **Chat Input**: `src/components/ChatInput.tsx` – input area with multiline support and keyboard shortcuts
- **Chat Message**: `src/components/ChatMessage.tsx` – individual message display (user/assistant)
- **Stream Message**: `src/components/StreamMessage.tsx` – real-time streaming message renderer
- **Message List**: `src/components/MessageList.tsx` – scrollable list of all messages
- **Agents Panel**: `src/components/AgentsPanel.tsx` – management panel for subagents and custom tools
- **AI Settings Panel**: `src/components/AISettingsPanel.tsx` – configuration for Claude SDK (model, permissions, etc.)
- **Claude Auth Settings**: `src/components/ClaudeAuthSettings.tsx` – API key configuration
- **Chat Settings Menu**: `src/components/ChatSettingsMenu.tsx` – session settings and options
- **Custom Permission Select**: `src/components/CustomPermissionSelect.tsx` – permission mode selector (plan/act/bypass)
- **Tool Widgets**: `src/components/ToolWidgets.tsx` – visual widgets for tool usage display
- **Tool Call Card**: `src/components/ToolCallCard.tsx` – card displaying individual tool calls
- **Markdown Text**: `src/components/MarkdownText.tsx` – markdown renderer for assistant messages
- **Skeleton Message**: `src/components/SkeletonMessage.tsx` – loading skeleton for streaming messages

#### Quack Agency Setup

- **Quack Agency Drawer**: `src/components/QuackAgencyDrawer.tsx` – main drawer for agency setup
- **Setup Wizard**: `src/components/QuackAgencySetupWizard.tsx` – multi-step wizard for project setup
- **Setup Steps**:
  - `SetupStepWelcome.tsx` – welcome screen
  - `SetupStepProject.tsx` – project configuration
  - `SetupStepFeatures.tsx` – feature selection
  - `SetupStepOptions.tsx` – additional options
  - `SetupStepReview.tsx` – review and confirm
- **Wizard Step**: `src/components/WizardStep.tsx` – reusable wizard step component

#### Preview & Development

- **Preview Panel**: `src/components/PreviewPanel.tsx` – web preview list with auto-detection
- **Preview Drawer**: `src/components/PreviewDrawer.tsx` – drawer containing preview panel
- **Processes Drawer**: `src/components/ProcessesDrawer.tsx` – running processes monitor

#### UI Components

- **Toolbar**: `src/components/ToolBar.tsx` – main toolbar with actions and settings
- **Title Bar**: `src/components/TitleBar.tsx` – custom title bar with window controls
- **Side Panel**: `src/components/SidePanel.tsx` – collapsible side panel container
- **Context Panel**: `src/components/ContextPanel.tsx` – contextual information panel
- **Context Menu**: `src/components/ContextMenu.tsx` – generic context menu component
- **Group Header**: `src/components/GroupHeader.tsx` – collapsible group header
- **Code Editor**: `src/components/CodeEditor.tsx` – Monaco editor integration
- **Duck Animation**: `src/components/DuckAnimation.tsx` – delightful duck animations 🦆
- **Error Boundary**: `src/components/ErrorBoundary.tsx` – React error boundary
- **Performance Monitor**: `src/components/PerformanceMonitor.tsx` – performance monitoring UI
- **Backgrounds Modal**: `src/components/BackgroundsModal.tsx` – terminal background customization
- **Saved Commands**: `src/components/SavedCommands.tsx` – saved command snippets
- **Saved Commands Drawer**: `src/components/SavedCommandsDrawer.tsx` – drawer for saved commands
- **Saved Command Modal**: `src/components/SavedCommandModal.tsx` – modal for editing commands

#### Services & SDK Integration

- **Claude SDK Service**: `src/services/claudeSDK.ts` – wrapper around `@anthropic-ai/claude-agent-sdk` with streaming support

#### Notifications & Audio

- **Notifications**: handled in `src/App.tsx` via `@tauri-apps/plugin-notification`
- **Audio feedback**: WebAudio-based "quack" sound when terminals become idle or jobs complete

### Backend (Rust + Tauri)

- **Core Library**: `src-tauri/src/lib.rs` – Tauri app setup, plugin registration (dialog, notification, store), command wiring, and HTTP hook server (Axum on port 6768)
- **Terminal Module**: `src-tauri/src/terminal.rs` – PTY management using `portable-pty`, color updates, cwd validation, process lifecycle
- **File System Module**: `src-tauri/src/fs.rs` – secure file system access, directory listing, file reading (with 5MB limit)
- **Git Module**: `src-tauri/src/git.rs` – Git operations via CLI (status, diff, stage/unstage, commit, history)
- **Capabilities**: `src-tauri/capabilities/default.json` – grants `dialog:default` (Finder), `notification:default` (desktop notifications), and `store:default` permissions

### Key Technologies

- **Frontend**: React 19, TypeScript 5.8, Vite 7, xterm.js, Monaco Editor, Tailwind CSS
- **Backend**: Tauri v2, Rust, portable-pty, Axum (HTTP server)
- **AI/SDK**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), Anthropic SDK (`@anthropic-ai/sdk`)
- **Plugins**: `tauri-plugin-dialog`, `tauri-plugin-notification`, `tauri-plugin-store`
- **Styling**: Tailwind CSS with custom liquid/radix-inspired utilities
- **Build**: Vite for frontend bundling, Cargo for Rust backend compilation

## Development Commands

### Frontend Development

- `npm run dev` - Start Vite development server (browser only)
- `npm run build` - Build frontend for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Tauri Development

- `npm run tauri:dev` - Start Tauri development with hot reload
- `npm run tauri:build` - Build desktop application for distribution
- `npm run tauri` - Run cargo tauri commands directly

### Rust Backend

- `cd src-tauri && cargo check` - Check Rust code compilation
- `cd src-tauri && cargo test` - Run Rust tests
- `cd src-tauri && cargo clippy` - Run Rust linter

## Architecture Notes

### Multi-Agentic System (Claude Agent SDK)

- **Claude Agent SDK Integration**: Uses `@anthropic-ai/claude-agent-sdk` for autonomous agent capabilities
- **Streaming Support**: Real-time message streaming with event-driven architecture
- **Tool System**: Full support for Claude's tool usage (file operations, bash execution, searches)
- **Session Management**: Persistent sessions with resume capability and context tracking
- **Permission Modes**: Three modes for tool execution control:
  - `plan`: Agent plans actions but requires approval before execution
  - `act`: Agent executes tools automatically (default)
  - `bypass`: Bypass all permission checks (use with caution)
- **Subagents**: Support for spawning specialized subagents for parallel task execution
- **Working Directory**: Each AI session can be bound to a specific terminal's working directory
- **Event Types**: System events, assistant messages, user messages (tool results), and result events with usage tracking

### Terminal Management

- Each terminal is backed by a PTY process managed in Rust using `portable-pty`
- Frontend creates Terminal instances from xterm.js with custom themes and addons (FitAddon, WebLinksAddon)
- Terminal data flows through Tauri events (`terminal-data`, `terminal-exit`)
- Terminals are persisted in memory with unique UUIDs and organized in groups
- **Intelligent State Detection**: Terminals automatically detect busy/idle states based on:
  - Process output patterns
  - Prompt detection (shell ready indicators)
  - Process exit events
- **Smart Auto-Scroll System**: Intelligent scroll management prevents frustrating auto-scroll behavior during heavy output
  - Auto-scroll automatically disables when user scrolls UP more than 10 lines (intentional navigation)
  - Auto-scroll re-enables when user scrolls back within 3 lines of bottom (returned to live output)
  - Floating "Scroll to bottom" badge appears when auto-scroll is disabled (only for active terminal)
  - Click badge to instantly jump to bottom and re-enable auto-scroll
  - Prevents flickering during Claude Code, Factory.ai, or other verbose command output
  - Each terminal maintains independent scroll state (preserved across terminal switches)
- **External Hooks**: HTTP endpoint on `127.0.0.1:6768` receives status updates from external tools (see Claude Code Hooks Integration section)

### File System Integration

- File explorer synchronizes with active terminal's current working directory
- Rust backend provides secure file system access through Tauri commands (`list_directory`, `read_file_content`)
- Directory navigation updates both explorer and terminal state
- File preview drawer supports preview up to 5MB with syntax highlighting (Monaco Editor)
- Context menu for file operations (open, copy path, reveal in Finder, etc.)

### Git Integration

- **Git Status**: Real-time repository status showing:
  - Current branch and upstream tracking
  - Ahead/behind commit counts
  - Staged, unstaged, and untracked files
  - Working tree state
- **Diff Viewer**: Side-by-side diff display for:
  - Worktree changes (unstaged)
  - Staged changes (index)
  - Untracked files (compared to /dev/null)
- **Stage/Unstage**: Interactive file staging with `git add` and `git reset`
- **Commit**: Commit UI with message validation and author info
- **Timeline**: Git log with commit history, dates, and messages
- **Repository Detection**: Automatically finds `.git` directory from current working directory

### State Management

- React state manages:
  - Terminal list, active terminal, groups, and per-terminal status (`busy` / `idle`)
  - File explorer state (current path, selected files)
  - Git panel state (status, diffs, staged files)
  - AI assistant state (messages, streaming, sessions, agents)
  - Modal and drawer visibility
  - Theme and customization settings
- No external state management library – uses built-in React hooks (useState, useEffect, useRef, useCallback)
- Terminal instances (xterm.js) are cached in React refs to prevent recreation
- Idle timers per terminal are tracked via refs to coordinate notifications and avoid duplicates
- Claude SDK sessions persist across component remounts using session IDs

### Event System

- **Tauri Events**: Bidirectional communication between frontend and backend
  - `terminal-data`: Terminal output stream (PTY → React)
  - `terminal-exit`: Process termination notification
  - `external-terminal-status`: Status updates from HTTP hooks
- **Claude SDK Events**: Real-time streaming from Agent SDK
  - `system`: Session initialization and tool registration
  - `assistant`: Assistant messages with text and tool_use blocks
  - `user`: User messages with tool_result blocks
  - `result`: Final results with usage stats and cost tracking
  - **Event Deduplication**: Implemented in `useClaudeChat.ts` to prevent duplicate rendering
    - Tracks unique event IDs using a `Set<string>` during streaming
    - Generates stable IDs based on event type and properties (session_id, message.id, etc.)
    - Skips duplicate events with warning logs for debugging
    - Ensures clean UI rendering without visual duplicates
- **HTTP Hooks**: External tool integration via `http://127.0.0.1:6768/terminal/status`
  - Receives status updates from Claude Code, Factory.ai, or other tools
  - Payload: `{ id/label, status: "busy"|"idle", notify: bool }`
  - Propagates to UI via `external-terminal-status` Tauri event
- **Dialog & Notifications**:
  - Dialog selections via `tauri-plugin-dialog::open` (Finder integration)
  - Desktop push notifications via `tauri-plugin-notification`
  - Audio feedback with WebAudio "quack" sound on idle transitions

## Development Notes

### General

- The app requires Tauri environment to function – browser-only mode shows fallback UI with limited features
- Uses Tailwind CSS for styling with custom utility classes
- All UI text is in English (as per project guidelines)
- Terminal colors are customizable and stored per-terminal instance (persistent via `tauri-plugin-store`)
- Terminals automatically resize based on container dimensions using FitAddon
- Performance monitoring available via `PerformanceMonitor` component

### Terminal Features

- **New Terminal Modal**: User can name session, pick directory via Finder, and choose accent color (presets or color picker)
- **Status Indicators**: Sidebar shows status badges:
  - `RUNNING` (yellow) – Terminal is busy executing commands
  - `READY` (green) – Terminal is idle and waiting for input
  - Pulsing animation when background terminal becomes idle
- **Notifications**: Desktop notifications and "quack" sound when background terminals complete jobs
- **Groups**: Terminals can be organized into collapsible groups in the activity bar
- **Saved Commands**: Store frequently-used commands with snippets drawer

### AI Assistant Features

- **Real-time Streaming**: Messages stream in real-time with smooth rendering
- **Tool Usage Display**: Visual widgets show tool calls (Read, Write, Edit, Bash, Grep, Glob, etc.)
- **Session Persistence**: Sessions can be resumed using session IDs
- **Agent Reset**: True fresh start via UUID regeneration (see [Agent Reset Mechanism](./05-features/agent-reset-mechanism.md))
- **Permission Control**: Three permission modes (plan/act/bypass) for different trust levels
- **Working Directory Binding**: AI can operate in context of specific terminal's working directory
- **Cost Tracking**: Real-time cost tracking with USD amounts and token usage
- **Agents Panel**: Manage and configure subagents for parallel task execution

### Code Review Skill (`/code-review`)

- **Intelligent Analysis**: Comprehensive review of uncommitted Git changes with AI-powered insights
- **Multi-Category Review**: Analyzes security, performance, code quality, maintainability, testing, and best practices
- **Severity Levels**: Issues categorized as CRITICAL (🔴), WARNING (🟡), INFO (🟢), and SUGGESTION (💡)
- **Quality Scoring**: Automated quality score (0-100) based on findings with actionable recommendations
- **Command Options**:
  - `--staged`: Review only staged changes (what will be committed)
  - `--focus <categories>`: Focus on specific categories (e.g., `security,performance`)
  - `--severity <level>`: Show only issues of specified severity or higher
  - `--file <pattern>`: Review only files matching glob pattern
  - `--summary`: Show summary statistics only
- **Structured Output**: Detailed markdown reports with code snippets, line numbers, explanations, and suggested fixes
- **Language-Aware**: Applies appropriate analysis rules based on file type (JS/TS, Python, Rust, etc.)
- **Educational**: Provides clear explanations and links to resources for each finding

### Quack Agency Setup Wizard

- Multi-step wizard for bootstrapping new projects with agent-based workflows
- Configures `.claude/` directory structure with agents, commands, and project documentation
- Creates `CLAUDE.md` with project-specific context and agent personalities
- Generates agent team based on project type (frontend/backend/fullstack)
- Integrates with global `~/.claude/CLAUDE.md` for user preferences

### Preview Inspector

- **Multiple custom URLs**: Add unlimited custom ports (e.g., `5173`) or full URLs (e.g., `http://localhost:8080`) to preview list
- **Auto-detection**: Automatically detects running dev servers from active terminal processes with exposed ports
- **Manual activation**: Preview windows open only when explicitly clicking the "Preview" button (no auto-open)
- **Independent WebViews**: Each preview opens in a separate Tauri WebView window with integrated inspector UI
- **Inspector UI in preview**: The inspector panel, toggle button, and history are rendered directly inside the preview window (not in the drawer)
  - Toggle button (bottom-right): Click to activate/deactivate inspector mode
  - Inspector panel (top-right): Shows component details, file location, React props when hovering elements
  - History panel (bottom-right, above toggle): Saves clicked elements for later reference
  - Copy for AI button: Copies inspector data to clipboard in markdown format
- **Browser fallback**: "Browser" button opens the URL in the system default browser
- **Remove custom URLs**: Custom URLs can be removed individually via the "Remove" button

## Best Practices for Agentic Development

### The Agentic Cycle (Gather → Act → Verify → Repeat)

Based on Claude Agent SDK principles, Quack follows this development pattern:

#### 1. Gather Context

- **Agentic Search**: Use file system tools and bash commands to find relevant information
- **Subagents**: Parallelize context gathering when needed for faster results
- **Semantic Search**: Use only when speed is critical (less accurate than agentic search)
- Tools: `Glob` for file patterns, `Grep` for content search, `Read` for file contents

#### 2. Take Action

- **Tools**: Use well-defined actions for specific operations (Read, Write, Edit)
- **Bash**: For flexible tasks that require a computer's capabilities
- **Code Generation**: When precision and reusability are needed
- **MCP Integrations**: For standard integrations (Slack, GitHub, databases, etc.)

#### 3. Verify Work

- **Rules-Based Verification**: Linting, type checking, validation scripts
- **Visual Feedback**: Screenshots for UI/HTML changes (use Preview Panel)
- **LLM as Judge**: Only for fuzzy rules (more expensive, use sparingly)
- **Test Execution**: Run tests via bash in terminal to validate changes

#### 4. Repeat

- Iterate on the cycle until objectives are met
- Use subagents to handle parallel verification tasks
- Document progress in commit messages and project documentation

### Permission Modes Strategy

Choose the right permission mode based on task complexity and trust level:

- **Plan Mode** (`plan`): Use when:
  - Exploring unfamiliar codebases
  - Making potentially destructive changes
  - Learning how the agent approaches problems
  - You want to review actions before execution

- **Act Mode** (`act`) - Default: Use when:
  - Working on familiar projects
  - Implementing well-defined features
  - Trusting the agent's judgment
  - Wanting autonomous development flow

- **Bypass Mode** (`bypass`): Use with caution when:
  - Time is critical and you fully trust the agent
  - Performing repetitive, safe operations
  - Working in sandboxed/test environments
  - Never on production systems

## Quack Features vs. Standard Claude Agent SDK

While Quack is built on the Claude Agent SDK, it adds several enhancements:

### Enhanced Features

1. **Visual Terminal Integration**
   - Multiple xterm.js terminals with PTY backing
   - Real-time output streaming with smart auto-scroll
   - Terminal groups and organization
   - State detection (busy/idle) with visual indicators

2. **Desktop Notifications & Audio Feedback**
   - Desktop push notifications when background jobs complete
   - "Quack" audio feedback for terminal state changes
   - Pulsing animations for attention-grabbing

3. **File Explorer Integration**
   - Visual file navigation synchronized with terminal CWD
   - File preview with Monaco Editor (5MB limit)
   - Context menus for file operations
   - Drag-and-drop support (future)

4. **Git Integration**
   - Visual Git status panel
   - Side-by-side diff viewer
   - Interactive staging/unstaging
   - Commit UI with validation
   - Timeline/history view

5. **HTTP Hooks for External Tools**
   - Local HTTP endpoint (port 6768) for external integrations
   - Allows Claude Code, Factory.ai, or other tools to update terminal status
   - Bidirectional communication between external tools and Quack UI

6. **Preview System**
   - Auto-detection of running dev servers
   - Multiple preview URLs/ports
   - Independent WebView windows with inspector
   - Manual activation control

7. **Quack Agency System**
   - Setup wizard for bootstrapping agent-based projects
   - Pre-configured agent team (Jack, Mike, Julie, John, Scott, Carmelo, Giuseppe, Roberta)
   - Structured `.claude/` directory with agents, commands, and documentation
   - Integration with both project-level and global `CLAUDE.md` files

8. **Persistent Configuration**
   - Settings stored via `tauri-plugin-store`
   - Session persistence with resume capability
   - Terminal customization (colors, backgrounds)
   - Saved command snippets

### Claude Code Hooks Integration

- Hook commands can notify Quack about session state changes by hitting the local endpoint:
  ```bash
  curl -s http://127.0.0.1:6768/terminal/status \
    -H 'Content-Type: application/json' \
    -d '{"id":"Claude Code", "status":"busy"}'
  ```
- Typical setup:
  - `UserPromptSubmit` hook → send `{ status: "busy" }`
  - `Notification` or `PostToolUse` hook → send `{ status: "idle" }`
- Payload fields:
  - `id`: matches the terminal label in the sidebar
  - `status`: `"busy"` or `"idle"`
  - `notify` (optional, default `true`): set to `false` to suppress notification/sound for that update
- Hooks run concurrently; the endpoint is idempotent—only matching terminals are updated. If no terminal ID matches exactly, the event is ignored.
- Terminal chips indicate `RUNNING` (yellow) vs `READY` (green); when unobserved terminals become idle, they pulse, trigger a desktop notification, and play the duck "quack" sound

## Documentation System

### Overview

Quack includes an integrated **Documentation Center** that provides user guides, best practices, and Claude Code techniques directly within the application. The system is built on React Markdown with custom components and a flexible metadata-driven structure.

### Architecture

#### Components Structure

**Core Components**:
- **`src/components/docs/DocsViewer.tsx`** - Main container component
  - Loads documentation structure from `_meta.json` files
  - Manages navigation state and page loading
  - Coordinates sidebar and content rendering
  - Handles initial path routing

- **`src/components/docs/DocsSidebar.tsx`** - Navigation sidebar
  - Renders collapsible section groups
  - Highlights current page
  - Supports keyboard navigation
  - Toggle button for collapse/expand

- **`src/components/docs/DocsContent.tsx`** - Markdown renderer
  - Displays markdown content with custom components
  - Auto-generates Table of Contents (TOC) from headings
  - Previous/Next page navigation
  - Smooth scrolling and anchor links

- **`src/components/docs/DocsComponents.tsx`** - Custom markdown components
  - `Callout` - Info boxes (info, warning, error, tip)
  - `Steps` - Numbered instruction sequences
  - `Tabs` - Tabbed content blocks
  - `Card` - Clickable feature cards
  - Code blocks with copy button

- **`src/components/docs/DocsViewer.css`** - Styling
  - Dark theme matching Quack design
  - Glassmorphism effects
  - Responsive layout
  - Typography and spacing

#### Supporting Files

- **`src/hooks/useDocsTab.tsx`** - Hook for managing docs tabs
  - Keeps App.tsx clean by encapsulating docs logic
  - Creates docs tabs with initial path
  - Type checking for docs tabs

- **`src/views/DocsTabView.tsx`** - Wrapper component
  - Renders docs tabs in tab system
  - Handles visibility and z-index
  - Passes initial path to DocsViewer

#### Tab Integration

The documentation system integrates seamlessly with Quack's tab system:

1. **Tab Type**: Added `'docs'` to TabBar types
2. **Tab Field**: `docsPath?: string` - Relative path to initial page
3. **Icon**: 📖 (book emoji)
4. **Access Point**: "Guide" button in TerminalSidebar
5. **Multiple Instances**: Supports multiple docs tabs with different initial paths

**Example Tab Object**:
```typescript
{
  id: 'docs-1234567890',
  label: 'Guide',
  type: 'docs',
  closable: true,
  docsPath: 'guide/01-getting-started/introduction'
}
```

### Content Structure

Documentation is organized in a hierarchical structure using directories and JSON metadata:

```
docs/guide/
├── _meta.json                     # Root configuration
├── 01-getting-started/
│   ├── _meta.json                 # Section configuration
│   ├── introduction.md
│   ├── installation.md
│   └── first-steps.md
├── 02-core-concepts/
│   ├── _meta.json
│   └── [markdown files]
├── 03-advanced-techniques/
│   ├── _meta.json
│   └── [markdown files]
└── 04-best-practices/
    ├── _meta.json
    └── [markdown files]
```

### _meta.json Format

#### Root Meta Configuration

Location: `docs/guide/_meta.json`

```json
{
  "title": "Quack Guide",
  "description": "Complete guide to using Quack and Claude Code",
  "sections": [
    "01-getting-started",
    "02-core-concepts",
    "03-advanced-techniques",
    "04-best-practices"
  ]
}
```

**Fields**:
- `title` - Overall documentation title
- `description` - Brief description of the documentation
- `sections` - Array of section directory names (ordered)

#### Section Meta Configuration

Location: `docs/guide/{section}/_meta.json`

```json
{
  "title": "Getting Started",
  "description": "Introduction to Quack",
  "icon": "🚀",
  "order": 1,
  "pages": [
    "introduction",
    "installation",
    "first-steps"
  ]
}
```

**Fields**:
- `title` - Section display name
- `description` - Section description (optional)
- `icon` - Emoji icon for sidebar (optional)
- `order` - Sort order (lower = first)
- `pages` - Array of markdown filenames without `.md` extension (ordered)

### File Loading

#### Development Mode

Uses absolute paths from project root:

```typescript
const absolutePath = `/Users/alekdob/Desktop/Dev/Personal/quack-app/${path}`;
const content = await invoke<string>('read_file_content', { path: absolutePath });
```

**Reads**:
- `_meta.json` files for structure
- `.md` files for content

**Tauri Command**: `read_file_content` (defined in `src-tauri/src/fs.rs`)

#### Production Mode (TODO)

For production builds, documentation should be bundled with the app:

1. **Bundle docs in resources** via `tauri.conf.json`:
   ```json
   "bundle": {
     "resources": ["docs/guide"]
   }
   ```

2. **Resolve bundled paths** using Tauri's resource API:
   ```typescript
   import { resolveResource } from '@tauri-apps/api/path';
   const resourcePath = await resolveResource('docs/guide/_meta.json');
   ```

3. **Update file loading logic** in DocsViewer to detect environment and use appropriate paths

### Custom Markdown Components

Implemented in `DocsComponents.tsx` and available in all markdown files:

#### 1. Callout

Info boxes with different types:

```markdown
:::callout{type="info"}
This is an informational callout with a blue theme.
:::

:::callout{type="warning"}
Warning! This action cannot be undone.
:::

:::callout{type="error"}
Error: Something went wrong.
:::

:::callout{type="tip"}
Pro tip: Use keyboard shortcuts for faster navigation.
:::
```

**Types**: `info` (blue), `warning` (yellow), `error` (red), `tip` (green)

#### 2. Steps

Numbered instruction sequences:

```markdown
:::steps
1. Open the terminal
2. Run `npm install`
3. Start the application with `npm run dev`
:::
```

Automatically numbered with visual step indicators.

#### 3. Tabs

Tabbed content blocks for organizing related information:

```markdown
:::tabs
### macOS
Instructions for macOS users...

### Windows
Instructions for Windows users...

### Linux
Instructions for Linux users...
:::
```

Each `###` heading becomes a tab.

#### 4. Card

Clickable feature cards:

```markdown
:::card{title="Feature Name" icon="🚀"}
Brief description of the feature and its benefits.
:::
```

**Props**:
- `title` - Card heading
- `icon` - Emoji or icon (optional)

#### 5. Code Blocks

Enhanced code blocks with syntax highlighting and copy button:

````markdown
```typescript
const example = "Code with copy button";
```
````

Features:
- Syntax highlighting for common languages
- Copy to clipboard button (top-right)
- Line numbers (optional, future enhancement)

### Libraries Used

#### React Markdown Ecosystem

- **`react-markdown@10.1.0`** - Core markdown rendering engine
  - Converts markdown AST to React components
  - Supports custom component mapping
  - Handles inline and block-level elements

- **`remark-gfm@4.0.1`** - GitHub Flavored Markdown support
  - Tables
  - Task lists
  - Strikethrough
  - Autolinks

- **`rehype-raw@7.0.0`** - HTML in markdown
  - Allows custom HTML elements
  - Sanitizes dangerous HTML
  - Preserves custom components

- **`rehype-slug@6.0.0`** - Auto-generate heading IDs
  - Creates kebab-case IDs from heading text
  - Enables anchor linking
  - Ensures unique IDs

- **`rehype-autolink-headings@7.1.0`** - Add anchor links to headings
  - Inserts clickable anchor icons
  - Enables "Copy link to heading" functionality
  - Smooth scrolling to sections

### Features

- ✅ **Sidebar Navigation** - Collapsible sections with icons
- ✅ **Table of Contents (TOC)** - Auto-generated from headings (H2, H3)
- ✅ **Previous/Next Navigation** - Contextual page navigation
- ✅ **Code Blocks with Copy** - One-click code copying
- ✅ **External Link Icons** - Visual indicator for external links
- ✅ **Dark Theme** - Matches Quack's dark UI
- ✅ **Glassmorphism Effects** - Consistent with app design
- ✅ **Responsive Layout** - Adapts to window size
- ✅ **i18n-Ready Structure** - Prepared for internationalization (currently English only)
- ✅ **Markdown Extensions** - Custom components (Callout, Tabs, Steps, Card)
- ✅ **Anchor Links** - Click headings to copy URL fragment
- ✅ **Keyboard Navigation** - Navigate sections with keyboard

### App.tsx Integration

The Documentation Center integrates into App.tsx with minimal code (~15 lines):

**Changes Made**:

1. **Import Hook and View**:
   ```typescript
   import { useDocsTab } from './hooks/useDocsTab';
   import DocsTabView from './views/DocsTabView';
   ```

2. **Initialize Hook**:
   ```typescript
   const { openDocsTab, isDocsTab } = useDocsTab();
   ```

3. **Create Handler**:
   ```typescript
   const handleOpenDocsTab = useCallback((path?: string) => {
     const docsTab = openDocsTab(path);
     setTabs(prev => [...prev, docsTab]);
     setActiveTab(docsTab.id);
   }, [openDocsTab]);
   ```

4. **Pass Handler to Sidebar**:
   ```typescript
   <TerminalSidebar
     // ... other props
     onOpenDocs={handleOpenDocsTab}
   />
   ```

5. **Render Docs Tabs**:
   ```typescript
   {tabs.map(tab => (
     isDocsTab(tab) ? (
       <DocsTabView
         key={tab.id}
         tab={tab}
         isActive={activeTab === tab.id}
       />
     ) : (
       // ... other tab types
     )
   ))}
   ```

**Benefits of This Approach**:
- ✅ Keeps App.tsx focused on orchestration
- ✅ Logic encapsulated in dedicated hook
- ✅ Rendering isolated in dedicated view component
- ✅ Easy to test and maintain
- ✅ Follows separation of concerns

### Future Enhancements

#### High Priority

- [ ] **Production Path Resolution** - Bundle docs and use `resolveResource()` for production builds
- [ ] **Full-text Search** - Search across all documentation with highlighting
- [ ] **Syntax Highlighting** - Add syntax highlighting to code blocks (e.g., Prism.js or highlight.js)

#### Medium Priority

- [ ] **Internationalization (i18n)** - Support for Italian and other languages
  - Detect user locale
  - Load localized `_meta.json` files
  - Fallback to English

- [ ] **Dark/Light Theme Toggle** - User preference for theme
- [ ] **Copy Link to Heading** - Click heading to copy anchor link
- [ ] **Sticky TOC** - Keep TOC visible while scrolling
- [ ] **Search Suggestions** - Autocomplete search with page suggestions

#### Low Priority

- [ ] **Breadcrumb Navigation** - Show current location in hierarchy
- [ ] **Version Selector** - Support multiple documentation versions
- [ ] **PDF Export** - Export documentation as PDF
- [ ] **Offline Mode** - Cache docs for offline access
- [ ] **Analytics** - Track which pages are most viewed (privacy-preserving)
