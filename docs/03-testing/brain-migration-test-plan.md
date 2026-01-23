# Quack Brain v2 - Test & Documentation Guide

This document serves two purposes:
1. **Documentation**: Explains how the new file-based Second Brain works
2. **Manual Test Plan**: Step-by-step verification to perform within the Quack interface

---

## How Quack Brain Works

Quack Brain is a knowledge system that helps AI agents remember patterns, bug fixes, decisions, and gotchas across sessions. Instead of a database, everything is stored as simple markdown files in `~/.quack/brain/`.

### The Three Pillars

```
1. STORAGE          2. AI ACCESS           3. AUTO-LEARN
   ~/.quack/brain/     .claude/skills/        useClaudeChat.ts
   (markdown files)    quack-brain/skill.md   (post-session hook)
        │                    │                       │
        └────────── read ────┘                       │
                    write ───────────────────────────┘
```

**Storage**: Plain markdown files organized by project and type. No database, no corruption, no sync issues. Files can be opened with Obsidian, VS Code, or any text editor.

**AI Access**: A Claude skill teaches agents how to search and write brain files. The skill is loaded automatically when context is relevant. Agents use standard Read/Write/Grep tools - no custom MCP server needed.

**Auto-learn**: After each AI response, a lightweight hook evaluates if the content contains knowledge worth saving (bug fix, pattern, gotcha, or decision). If detected, it writes a new `.md` file automatically.

### Directory Layout

```
~/.quack/brain/
├── global/                        # Knowledge that applies to all projects
│   ├── patterns/                  # Reusable techniques
│   ├── preferences/               # How the user likes things done
│   ├── people/                    # Contacts and collaborators
│   └── tools/                     # Tool tips and configurations
└── projects/                      # Project-scoped knowledge
    ├── quack-app/
    │   ├── patterns/              # Project-specific patterns
    │   ├── bugs/                  # Bug fixes (with root cause)
    │   ├── decisions/             # Architecture Decision Records
    │   ├── gotchas/               # Pitfalls to avoid
    │   ├── notes/                 # General notes
    │   └── diary/                 # Daily progress (YYYY-MM-DD.md)
    ├── flow-bi/
    │   └── ...
    └── safehood/
        └── ...
```

### File Format

Every brain file uses YAML frontmatter + markdown body:

```markdown
---
type: bug_fix
project: quack-app
created: 2025-01-23
tags: [react, hooks, memory-leak]
---

# useEffect cleanup with async operations

## Problem
Memory leak when component unmounts during async fetch.

## Solution
Use AbortController in the useEffect cleanup function.

## Context
Found in ChatView.tsx during streaming refactor.
```

### What Gets Auto-Saved

The auto-learn hook detects these patterns in AI responses:

| Type | Trigger words | Example |
|------|---------------|---------|
| `bug_fix` | fix, resolved, root cause, the issue was | "The fix was to add AbortController..." |
| `pattern` | pattern, best practice, approach, recommended | "The recommended approach is to use React.memo..." |
| `gotcha` | gotcha, pitfall, careful, won't work, breaks when | "Careful: Tauri shell plugin doesn't support..." |
| `decision` | decided to, trade-off, chose, architecture | "We decided to use file-based storage because..." |

Only responses longer than 200 characters with code blocks or multi-line explanations are saved. Trivial fixes and short answers are ignored.

### Where Things Live in Code

| File | What it does |
|------|-------------|
| `src/services/brainFileService.ts` | Core service: save, read, list, evaluate knowledge |
| `.claude/skills/quack-brain/skill.md` | Teaches Claude how to use the brain |
| `src/hooks/useClaudeChat.ts` | Contains the auto-learn hook (calls `evaluateAndSaveKnowledge`) |
| `src/components/TerminalSidebar.tsx` | Purple "Brain" button in sidebar |
| `src/components/settings/categories/SecondBrainSettings.tsx` | Settings panel |

---

## Manual Testing in Quack

Open Quack and follow each section in order. Each test has clear pass/fail criteria.

---

### Test 1: App Launches Clean

**What to check**: The app starts without brain-related errors.

1. Open Quack normally
2. Open the Developer Tools console (Cmd+Option+I or via Quack menu)
3. Check the console output

**Pass criteria**:
- [ ] No "Failed to initialize Quack Brain database" error
- [ ] No "Failed to setup MCP Brain server" error
- [ ] No "Could not resolve" errors mentioning brain/memory modules
- [ ] App loads to the main view without white screen

---

### Test 2: Sidebar Brain Button

**What to check**: The Brain button exists and opens the brain folder.

1. Look at the left sidebar, below the agent list area
2. Find the purple brain button (SVG brain icon + "Brain" label)
3. Click it

**Pass criteria**:
- [ ] Purple brain button is visible in the sidebar
- [ ] Hovering shows tooltip "Open Brain folder"
- [ ] Clicking opens Finder at `~/.quack/brain/`
- [ ] The folder contains `global/` and `projects/` subdirectories

---

### Test 3: Settings Panel

**What to check**: The Second Brain settings section works correctly.

1. Open Settings (gear icon in sidebar or Cmd+,)
2. Navigate to "Second Brain" category
3. Check the displayed information

**Pass criteria**:
- [ ] "Second Brain" section is visible in settings navigation
- [ ] "Brain Location" shows the path `~/.quack/brain` (or similar with your home dir)
- [ ] "Reveal" button opens Finder to the brain folder
- [ ] "Open in Obsidian" button attempts to launch Obsidian (may show error if not installed - that's OK)
- [ ] "Auto-learn" row shows "Active" in green
- [ ] "AI Access" row shows "Via Skill" in green
- [ ] No crash, no old sync/vault/embeddings UI visible

---

### Test 4: No Old Brain UI Remains

**What to check**: All removed components are gone from the interface.

1. Check the side panel tabs (right side)
2. Look through all available tabs and views
3. Open a chat and send a test message

**Pass criteria**:
- [ ] No "Memory" tab in the side panel
- [ ] No purple "Quack Brain" link bar below the chat input
- [ ] No memory search icon anywhere in the chat area
- [ ] No "Knowledge Graph" or "Second Brain" tab options
- [ ] No Obsidian sync indicators or status badges
- [ ] Settings has NO "Sync Settings", "Embeddings", or "Vault Watcher" sections

---

### Test 5: Auto-learn Hook (Bug Fix Detection)

**What to check**: The system automatically saves knowledge from AI responses.

1. Open a chat with an agent assigned to a project (e.g., quack-app)
2. Ask something that will produce a substantive bug-fix-style response. Example prompt:
   ```
   Explain how to fix a React useEffect memory leak when
   the component unmounts during an async fetch operation.
   Give me the root cause and the solution with code.
   ```
3. Wait for the full response
4. Open the Developer Tools console
5. Check `~/.quack/brain/projects/quack-app/bugs/` in Finder

**Pass criteria**:
- [ ] Console shows `[brainFileService] Saved knowledge: bug_fix/...` (or similar)
- [ ] A new `.md` file appears in the bugs folder
- [ ] The file has correct YAML frontmatter (type, project, created, tags)
- [ ] The file content is a meaningful summary, not garbage

**If nothing was saved**: The response might have been too short or didn't match patterns. Try a more detailed prompt. Check console for `[useClaudeChat] Brain knowledge save failed:` errors.

---

### Test 6: Auto-learn Hook (Pattern Detection)

**What to check**: Pattern-type knowledge is also detected and saved.

1. In the same or new chat, ask:
   ```
   What's the best practice for handling error boundaries in React?
   Describe the recommended approach with a reusable ErrorBoundary
   component pattern including code examples.
   ```
2. Wait for the full response
3. Check `~/.quack/brain/projects/{project}/patterns/` in Finder

**Pass criteria**:
- [ ] Console shows `[brainFileService] Saved knowledge: pattern/...`
- [ ] A new `.md` file appears in the patterns folder
- [ ] Content captures the essence of the pattern described

---

### Test 7: Auto-learn Does NOT Save Trivial Content

**What to check**: Short/trivial responses don't get saved.

1. Ask a simple question:
   ```
   What is the CSS property for text color?
   ```
2. Wait for the response (should be short)
3. Check console and brain folder

**Pass criteria**:
- [ ] No `[brainFileService] Saved knowledge:` message in console
- [ ] No new file created in brain folder
- [ ] Chat works normally, no errors

---

### Test 8: Brain Files Are Valid Markdown

**What to check**: Files created by auto-learn are well-formatted.

1. Open any recently created brain file in a text editor (or Finder Quick Look)
2. Check the structure

**Pass criteria**:
- [ ] File starts with `---` (frontmatter delimiter)
- [ ] Has `type:` field (bug_fix, pattern, gotcha, or decision)
- [ ] Has `created:` field with today's date (YYYY-MM-DD format)
- [ ] Has `tags:` field (array, even if empty `[]`)
- [ ] Ends frontmatter with `---`
- [ ] Has a markdown heading `# Title`
- [ ] Body content is readable text (not HTML, not JSON, not garbage)

---

### Test 9: Claude Skill Works (Agent Can Search Brain)

**What to check**: An AI agent can search and find knowledge in the brain.

1. Make sure you have some brain files from previous tests
2. Start a new chat session
3. Ask the agent:
   ```
   Search my brain for any patterns or bug fixes related to React hooks.
   Tell me what you find.
   ```

**Pass criteria**:
- [ ] Agent uses Grep or Read tools to search `~/.quack/brain/`
- [ ] Agent finds and references content from existing brain files
- [ ] Agent doesn't try to call old MCP tools (`mcp__memory__search_nodes` etc.)
- [ ] Response mentions actual file content from the brain

**Note**: This test validates that the `.claude/skills/quack-brain/skill.md` is being loaded and followed by the agent.

---

### Test 10: Claude Skill Works (Agent Can Save to Brain)

**What to check**: An agent can write new knowledge to the brain.

1. In a chat session, ask:
   ```
   Save a new pattern to my brain: "Always use AbortController
   for fetch operations in useEffect to prevent memory leaks on unmount."
   Save it as a pattern for this project.
   ```

**Pass criteria**:
- [ ] Agent writes a file to `~/.quack/brain/projects/{project}/patterns/`
- [ ] File has correct frontmatter format
- [ ] Agent confirms the save with the file path
- [ ] File is readable and well-formatted

---

### Test 11: Multiple Projects Isolation

**What to check**: Brain knowledge is scoped per-project.

1. Check that `~/.quack/brain/projects/` has separate folders for each project
2. Knowledge saved from a quack-app session goes to `projects/quack-app/`
3. Knowledge saved from a flow-bi session goes to `projects/flow-bi/`

**Pass criteria**:
- [ ] Each project has its own subfolder
- [ ] Files are not mixed between projects
- [ ] Global knowledge (no project) goes to `global/`

---

### Test 12: Brain Works Without Obsidian

**What to check**: The system doesn't require Obsidian to function.

1. Close Obsidian if open
2. Perform a chat interaction that triggers auto-learn
3. Click the sidebar brain button

**Pass criteria**:
- [ ] Auto-learn still saves files correctly
- [ ] Sidebar button opens Finder (not Obsidian)
- [ ] No errors about Obsidian being missing
- [ ] Settings "Open in Obsidian" button may show system error (acceptable) but doesn't crash Quack

---

### Test 13: Chat Performance

**What to check**: The auto-learn hook doesn't slow down chat.

1. Have a normal conversation with an agent
2. Pay attention to response speed

**Pass criteria**:
- [ ] Responses stream in at normal speed
- [ ] No noticeable delay after response completes
- [ ] If brain save fails, chat is unaffected (check console for warnings, not errors)

---

## Post-Testing Cleanup

After all tests pass, remove the old database artifacts:

1. Open Terminal
2. Run:
   ```bash
   rm -f ~/.quack/brain/brain.db
   rm -f ~/.quack/brain/brain.db-shm
   rm -f ~/.quack/brain/brain.db-wal
   rm -f ~/.quack/brain/brain.db.backup-fts5
   rm -f ~/.quack/brain/brain_old_fts5.db
   rm -rf ~/.quack/brain/markdown/
   ```

These are leftover files from the old SQLite-based system and are no longer needed.

---

## Troubleshooting

### Auto-learn never saves anything

- Check console for `[brainFileService]` or `[useClaudeChat]` messages
- Verify the Tauri commands work: `get_home_directory`, `create_directory`, `write_file_content` should not throw
- Make sure responses are >200 chars and contain pattern trigger words
- Check that `~/.quack/brain/` exists and is writable

### Agent doesn't search brain before acting

- Verify `.claude/skills/quack-brain/skill.md` exists in the project
- The skill may not activate for simple questions - try asking specifically about "patterns" or "past decisions"
- Check that the skill frontmatter has correct `name:` and `description:` fields

### Settings panel shows wrong path or crashes

- The `get_home_directory` Tauri command must return the correct home directory
- If `reveal_in_finder` fails, the path might not exist yet - trigger auto-learn first

### Brain button doesn't open Finder

- Check that `reveal_in_finder` Tauri command is registered in `lib.rs`
- The path `~/.quack/brain/` must exist - create it manually if needed: `mkdir -p ~/.quack/brain`

---

## Architecture Summary (for developers)

### Before (removed)

```
SQLite DB (brain.db, 3MB+, corrupted)
  ↕ Rust commands (~60 Tauri commands)
  ↕ MCP Server (brain-mcp-server.js, 2134 LOC)
  ↕ React components (MemoryPanel, SecondBrainTabView, graph...)
  ↕ Obsidian Sync service (bidirectional, conflict resolution)
  ↕ Embeddings system (never worked)
Total: ~10,000+ LOC, fragile, corrupted data
```

### After (current)

```
Markdown files (~/.quack/brain/)
  ← Claude Skill (skill.md, ~130 LOC) - teaches AI to read/write
  ← brainFileService.ts (~380 LOC) - Tauri file operations
  ← useClaudeChat.ts hook (~10 LOC added) - auto-learn trigger
  ← Sidebar button + Settings panel (~100 LOC)
Total: ~400 LOC, zero corruption risk, git-friendly
```

### Key Design Decisions

1. **Files over databases**: Markdown files can't corrupt, are human-readable, and work with any editor
2. **Skill over MCP**: No custom server means no startup overhead, no port conflicts, no dependency management
3. **Auto-learn over manual save**: Knowledge is captured passively, reducing friction to zero
4. **Obsidian as optional viewer**: Users who want graph/links use Obsidian; others just use Finder or VS Code
5. **Project isolation by folder**: Simple directory structure instead of SQL relations
