---
name: whiteboard
version: 1.0.0
description: "Read, annotate, and organize the Feature Map whiteboard canvas. Use this skill PROACTIVELY whenever the user mentions whiteboard, feature map annotations, post-its, organizing features visually, creating notes on the canvas, arranging nodes, or wants to interact with the .whiteboard.json file. Also trigger when the user asks to visualize, label, or group features on the map."
keywords: [whiteboard, feature-map, post-it, annotation, organize, canvas, group, layout]
builtin: true
---

# Whiteboard Skill

Interact with Quack's Feature Map whiteboard — an SVG canvas that visualizes feature docs as architecture-layer nodes. This skill lets you read the canvas state, create post-it notes, draw group rectangles, reposition feature nodes, and auto-organize the entire board.

The whiteboard state lives in a single JSON file. The React UI polls this file every 2 seconds, so any change you write appears on the canvas almost immediately — no reload needed.

## How It Works

The whiteboard file is at:
```
{projectPath}/documentation/features/.whiteboard.json
```

Where `{projectPath}` is the current working directory. Read it, modify the JSON, write it back. That's it.

## Data Schema

```json
{
  "version": 1,
  "annotations": {
    "postIts": [
      { "id": "uuid-v4", "text": "Note text", "x": 100, "y": 200, "color": "#fbbf24" }
    ],
    "groups": [
      { "id": "uuid-v4", "label": "Group Name", "x": 50, "y": 50, "w": 400, "h": 300, "color": "#00d9ff" }
    ],
    "images": [
      { "id": "uuid-v4", "src": "images/screenshot.png", "x": 300, "y": 100, "w": 240, "h": 160 }
    ]
  },
  "positions": {
    "feature-node-id": { "x": 150, "y": 200 }
  }
}
```

If the file doesn't exist yet, create it with empty arrays and an empty positions object.

## Colors

### Post-it Colors
| Name | Hex |
|------|-----|
| yellow | `#fbbf24` |
| green | `#4ade80` |
| pink | `#f472b6` |
| blue | `#60a5fa` |
| purple | `#c084fc` |
| orange | `#fb923c` |

### Group Rectangle Colors
| Name | Hex |
|------|-----|
| cyan | `#00d9ff` |
| purple | `#a855f7` |
| orange | `#f97316` |
| green | `#22c55e` |
| red | `#ef4444` |
| slate | `#64748b` |

## What You Can Do

### 1. List / Inspect

Read `.whiteboard.json` and `documentation/features/*.md` to understand what's on the board. Report: how many features exist, how many post-its/groups/images are placed, which nodes have custom positions.

### 2. Add Post-its

Create sticky notes on the canvas. Each post-it needs:
- `id`: a fresh UUID (8-4-4-4-12 hex format)
- `text`: the note content
- `x`, `y`: canvas coordinates
- `color`: hex from the post-it colors table (default: `#fbbf24` yellow)

**Positioning tips:**
- To place near a specific feature node, find that node's position (from the `positions` object, or calculate from the default layout) and offset by `x + 260` (right of the node).
- Default annotation area: `x: 600, y: -80` (above the graph, to the right).

### 3. Add Group Rectangles

Draw labeled rectangles to visually group related features. Each group needs:
- `id`: fresh UUID
- `label`: descriptive text (e.g., "Authentication Flow")
- `x`, `y`, `w`, `h`: position and size in canvas coords
- `color`: hex from the group colors table (default: `#00d9ff` cyan)

**To wrap around specific nodes:** find their positions, compute the bounding box, and add 40px padding on each side.

### 4. Move Feature Nodes

Set custom positions for feature nodes by writing to the `positions` object:
```json
"positions": {
  "024-integrated-code-editor": { "x": 500, "y": 300 }
}
```

Node IDs come from feature doc filenames without the `.md` extension (e.g., `024-integrated-code-editor.md` becomes `024-integrated-code-editor`).

### 5. Clear

Reset parts of the whiteboard:
- Post-its only: set `annotations.postIts` to `[]`
- Groups only: set `annotations.groups` to `[]`
- Positions only: set `positions` to `{}`
- Everything: reset the entire file to the empty schema

**Never remove `annotations.images`** — they reference saved image files on disk.

### 6. Auto-Organize

The power move. Read all feature docs, classify them into architecture layers, position them in a clean grid, and add group rectangles.

**Layer classification** — match feature tags against these keywords:

| Layer | Color | Keywords |
|-------|-------|----------|
| UI Components | `#5ce0ff` | editor, codemirror, tab, popout, diff, highlighting, visualization, whiteboard, graph, pixi, feature-map, search, multi-tab |
| Business Logic | `#c084fc` | permission, delegation, team, remote-api, agent-mode, sdk, build, plan, ask, debug, chat, mention |
| Infrastructure | `#94a3b8` | terminal, ide, context-injection, saved-commands, git, tauri |

**Layout algorithm:**
1. For each feature doc, extract `id` (filename minus `.md`), `title` (first `#` heading), and `tags` (from YAML frontmatter)
2. Classify each feature into a layer by counting keyword matches in its tags
3. Position nodes top-to-bottom by layer (UI, Logic, Infra):
   - Left margin: 30px
   - 2 columns (if >3 nodes), 1 column otherwise
   - Node size: 240x72px, horizontal gap: 20px, vertical gap: 14px
   - Section header: 32px height, section gap: 24px between layers
4. Create a group rectangle around each layer's nodes (bounding box + 40px padding)
5. Add a summary post-it with stats (e.g., "15 features / 3 layers / organized by Agent")

## Important Rules

- **Always preserve images**: never clear or modify `annotations.images` — they reference binary files saved to disk
- **Pretty-print JSON**: write with 2-space indentation so humans can read it too
- **UUIDs**: use proper v4 format (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- **React polls every 2s**: your changes appear on the canvas within 2 seconds of writing the file
- **Read before write**: always read the current file first to avoid overwriting concurrent changes
