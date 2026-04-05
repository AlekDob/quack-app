---
name: whiteboard
version: 1.1.0
description: "Read, annotate, and organize the Feature Map whiteboard canvas. Use this skill PROACTIVELY whenever the user mentions whiteboard, feature map annotations, post-its, organizing features visually, creating notes on the canvas, arranging nodes, creating components, nesting elements, or wants to interact with the .whiteboard.json file. Also trigger when the user asks to visualize, label, or group features on the map."
keywords: [whiteboard, feature-map, post-it, annotation, organize, canvas, group, layout, component, nested]
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
      { "id": "uuid-v4", "text": "Note text", "x": 100, "y": 200, "color": "#fbbf24", "parentComponentId": "comp-uuid" }
    ],
    "groups": [
      { "id": "uuid-v4", "label": "Group Name", "x": 50, "y": 50, "w": 400, "h": 300, "color": "#00d9ff", "isComponent": true, "parentComponentId": "parent-uuid" }
    ],
    "images": [
      { "id": "uuid-v4", "src": "images/screenshot.png", "x": 300, "y": 100, "w": 240, "h": 160, "parentComponentId": "comp-uuid" }
    ]
  },
  "positions": {
    "feature-node-id": { "x": 150, "y": 200 }
  },
  "nodeAssignments": {
    "feature-node-id": "component-uuid"
  }
}
```

**Key fields:**
- `parentComponentId` (optional on postIts/groups/images): assigns the annotation inside a component
- `isComponent` (optional on groups): marks a group as an enterable nested whiteboard
- `nodeAssignments` (optional): maps feature node IDs to component IDs — nodes assigned here disappear from the main canvas and appear only inside the component
- If the file doesn't exist yet, create it with empty arrays, empty positions, and empty nodeAssignments

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

### 7. Create Components (Nested Whiteboards)

Group feature nodes and annotations into a component — a nestable sub-whiteboard. When users double-click a component in the UI, they enter it and see only its children.

**To create a component:**
1. Pick the IDs of elements to group (feature nodes + annotations)
2. Compute bounding box of their positions (add 20px padding, 24px top for label)
3. Create a group rect with `isComponent: true`
4. Set `parentComponentId` on each child annotation
5. Add entries to `nodeAssignments` for each child feature node

```json
{
  "annotations": {
    "postIts": [
      { "id": "p1", "text": "Login", "x": 120, "y": 90, "color": "#60a5fa", "parentComponentId": "comp1" }
    ],
    "groups": [
      { "id": "comp1", "label": "Auth Module", "x": 80, "y": 46, "w": 400, "h": 200, "color": "#00d9ff", "isComponent": true }
    ],
    "images": []
  },
  "nodeAssignments": {
    "024-code-editor": "comp1",
    "026-feature-map": "comp1"
  }
}
```

**To dissolve a component:** remove the group, clear `parentComponentId` from children, delete entries from `nodeAssignments`. Children return to the main canvas.

**Constraints:**
- Max nesting depth: 5 levels
- `parentComponentId` must reference an existing group with `isComponent: true`
- Removing a component without cleaning children creates orphans (the UI auto-cleans on next load, but best to clean manually)

## Important Rules

- **Always preserve images**: never clear or modify `annotations.images` — they reference binary files saved to disk
- **Preserve nodeAssignments**: when clearing annotations, also clean `nodeAssignments` to avoid orphaned nodes
- **Pretty-print JSON**: write with 2-space indentation so humans can read it too
- **UUIDs**: use proper v4 format (`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
- **React polls every 2s**: your changes appear on the canvas within 2 seconds of writing the file
- **Read before write**: always read the current file first to avoid overwriting concurrent changes
- **Component integrity**: when removing a component group, always promote its children (clear `parentComponentId` and remove from `nodeAssignments`)
