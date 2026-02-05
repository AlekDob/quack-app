---
type: component
project: quack-app
created: 2026-01-12
migrated: true
---

# component-quack-brain-link-bar

QuackBrainLinkBar is a React component that displays a purple glassmorphism bar when Claude creates an entity in the Quack Brain

Automatically detects when brain MCP creates/modifies a file by checking for `mdFilePath` in tool results

Shows: brain icon, 'Quack Brain' label, entity type icon (bug, pattern, decision, etc.), entity name, and 'Obsidian' button

Uses `openInEditor()` from [[obsidianSyncService]] to open files in configured editor (Obsidian by default)

Bar disappears automatically when user sends new message and response doesn't contain Brain creations

Files: `src/components/QuackBrainLinkBar.tsx` (component) and `src/components/QuackBrainLinkBar.css` (purple theme styles)

Integrated in [[ChatView]] - renders conditionally based on last assistant message content

Pattern: Similar to [[EditSummaryBar]] - contextual bar that appears/disappears based on assistant message

Implementation uses useMemo to extract entity info from message, conditional rendering in JSX
