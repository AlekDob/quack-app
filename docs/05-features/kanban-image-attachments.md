# Kanban Image Attachments

## Overview

Kanban tasks now support image attachments, allowing users and AI agents to attach screenshots, diagrams, or reference images directly to task cards. Images are displayed as thumbnails on the card and can be viewed in full when the task drawer is opened.

## Usage

### Via UI (AddKanbanTaskModal)

When creating a task through the UI modal:
1. Drag and drop images into the prompt text area
2. Or use the file attachment button
3. Supported formats: PNG, JPEG, GIF, WebP
4. Maximum 4 attachments per task
5. Maximum file size: 3MB per image (for base64 preview)

### Via MCP Tools (AI Agents)

AI agents can create tasks with image attachments using the `kanban_create_task` MCP tool:

```typescript
// Example: Creating a task with attachments
mcp__kanban__kanban_create_task({
  title: "Fix UI alignment issue",
  prompt: "The button alignment is off in the sidebar. See attached screenshot.",
  projectPath: "/Users/dev/my-project",
  projectName: "My Project",
  attachments: [
    {
      path: "/tmp/screenshot-123.png",
      name: "sidebar-issue.png",  // optional
      mimeType: "image/png"       // optional, auto-detected from extension
    }
  ]
})
```

#### Attachment Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | Yes | Absolute path to the image file |
| `name` | string | No | Display name (defaults to filename) |
| `mimeType` | string | No | MIME type (auto-detected if not provided) |

## Display

### On Task Cards

- First 3 images shown as 36x36px thumbnails
- "+N" indicator if more than 3 images
- Hover effect highlights thumbnails
- Images positioned after the prompt preview

### In Task Drawer

- Full-size image previews
- Click to expand/zoom
- Image details (name, size) shown

## Technical Implementation

### Types

```typescript
// ChatAttachment interface (src/types.ts)
interface ChatAttachment {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType?: string;
  previewUrl?: string;  // Base64 data URL for preview
}

// KanbanTask includes attachments
interface KanbanTask {
  // ... other fields
  attachments?: ChatAttachment[];
}
```

### Components

- **KanbanCard.tsx**: Displays thumbnail grid
- **AddKanbanTaskModal.tsx**: Handles drag-drop upload
- **KanbanView.css**: Attachment styling

### MCP Server

- **kanban-mcp-server.js**: Processes attachments, validates files, generates base64 previews
- **kanban-tools.js**: Schema definition for Claude Agent SDK

### CSS Classes

```css
.kanban-card-attachments        /* Container for thumbnails */
.kanban-card-attachment-thumb   /* Individual thumbnail */
.kanban-card-attachment-img     /* Image element */
.kanban-card-attachment-more    /* "+N" overflow indicator */
```

## Limitations

1. **File Size**: Images over 3MB won't have base64 previews (path-only reference)
2. **Formats**: Only common image formats supported (PNG, JPEG, GIF, WebP, SVG)
3. **Count**: Maximum 4 attachments per task
4. **Storage**: Images are referenced by path, not stored in the task database

## Related Files

- `src/components/kanban/KanbanCard.tsx` - Card display
- `src/components/kanban/KanbanView.css` - Styling
- `src-tauri/node-sdk/kanban-mcp-server.js` - MCP tool handler
- `src-tauri/node-sdk/kanban-tools.js` - Claude Agent SDK tools
- `src/types.ts` - TypeScript interfaces
