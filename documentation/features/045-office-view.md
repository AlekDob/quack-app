---
type: feature-doc
project: quack-app
stack: TypeScript strict (React 18 frontend) + PixiJS v8 (@pixi/react), Zustand (sessionStore, chatStore)
created: 2026-04-06
last_verified: 2026-04-06
tags: [office, isometric, pixijs, visualization, agents, rooms, break-room, avatar, action-menu]
---

## Office View
**Purpose:** Isometric virtual office that visualizes the multi-project workspace as rooms. Each project gets a room with desks and agent avatars (ducks). Active agents appear at workstations with animated bobbing and session status dots. Includes a Break Room with sofas, TV, and vending machine, plus a header with project/agent stats. Supports pan/zoom navigation and click-to-interact agent menus.
**Stack:** React 18 + TypeScript strict + PixiJS v8 (@pixi/react) + Zustand

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/office/OfficeView.tsx` | Main container: PixiJS Application, header bar, viewport pan/zoom, action menu overlay, session dot color computation (Zustand reads in DOM tree, passed as props to PixiJS) |
| Component | `src/components/office/OfficeScene.tsx` | 4-layer PixiJS scene graph: base (walls/floor) > labels > desks+furniture > ducks. No zIndex — JSX order is render order |
| Component | `src/components/office/OfficeRoom.tsx` | Single project room: isometric diamond floor, left/right walls, workstation desks (with monitors, keyboards), diamond mask for desk clipping. Renders in 3 layer modes: `base`, `desks`, `ducks` |
| Component | `src/components/office/OfficeDuck.tsx` | Agent avatar: circular sprite (from useAvatarTexture) or fallback initial, colored border ring, session status dots (arc layout), typing particles when busy, animated bobbing (throttled to 12fps) |
| Component | `src/components/office/OfficeBreakRoom.tsx` | Break room: warm-toned isometric diamond with teal walls, 2 sofas (3-cushion isometric boxes), wall-mounted TV (with glow + LED), vending machine (with product dots + display). Renders in 2 layer modes: `base`, `furniture` |
| Component | `src/components/office/OfficeRoomLabel.tsx` | Project name text on left wall (rotated to wall angle, white, Inter font, drop shadow) |
| Component | `src/components/office/OfficeBreakRoomLabel.tsx` | "Break Room" label on left wall (orange #ff6b35, same rotation as room labels) |
| Component | `src/components/office/OfficeActionMenu.tsx` | HTML overlay menu on duck click: agent name + color, status, branch, session list with status dots, "Vai alla Chat" fallback button. Click-outside-to-close |
| Component | `src/components/office/OfficeTooltip.tsx` | HTML tooltip overlay: agent name, status badge (busy/idle), working-on task |
| Model/Type | `src/components/office/officeTypes.ts` | `TooltipData` (agentId, name, status, workingOn, screenX/Y), `ActionMenuData` (agentId, screenX/Y) |
| Service | `src/components/office/officeLayout.ts` | Grid-to-isometric math: `gridToIso()`, `computeRoomPositions()` (groups terminals by project, compact rectangular grid), `getWorkstationPositions()` (desk+duck positions per agent count), `computeBreakRoomPosition()` (next grid slot after project rooms) |
| Hook | `src/components/office/useAvatarTexture.ts` | Loads agent avatar as circular PixiJS Texture via offscreen canvas clipping. Handles blob URL lifecycle + GPU texture cleanup on unmount |
| Styles | `src/components/office/OfficeView.css` | Dark theme styles for container (#0f0f1a), header bar, tooltip, action menu, session items |

### Data Flow
`terminals[]` (TerminalInfo) + `sessionStore.sessions` → filter active (todo/in_progress) → `computeRoomPositions()` → group by project path → compact grid → `gridToIso()` → screen coordinates → PixiJS scene rendering → duck click → HTML action menu overlay → session navigation

### Key Functions
- `gridToIso(col, row) → {x, y}` — converts grid position to isometric screen coordinates using 2:1 diamond ratio
- `computeRoomPositions(terminals) → RoomPosition[]` — groups terminals by `cwd`, assigns compact rectangular grid positions
- `getWorkstationPositions(agentCount) → WorkstationPos[]` — computes desk + duck positions within room (1 agent: center, 2: diagonal, 3+: row grid with stagger)
- `computeBreakRoomPosition(projectCount) → BreakRoomPosition` — places break room at next available grid slot
- `getSessionDotHex(sessionId, ...) → number` — computes status color: purple (awaiting) > yellow (working) > green (ready) > gray (empty)
- `drawWorkstation(g, x, y)` — draws isometric desk with monitor back, keyboard, legs
- `drawSofa(g, ox, oy, eLen, faceSouth)` — draws isometric sofa with backrest + 3 cushion stitch lines
- `drawTV(g, ox, oy)` — draws wall-mounted TV with screen glow and power LED
- `drawVendingMachine(g, ox, oy)` — draws tall isometric vending machine with product dots and green display

### Isometric Layout
| Constant | Value | Description |
|----------|-------|-------------|
| `TILE_W` | 450px | Diamond width (2:1 ratio) |
| `TILE_H` | 225px | Diamond height |
| `WALL_H` | 50px | Wall height above floor |
| Grid system | compact rectangular | `cols = ceil(sqrt(count))`, row-major fill |
| Initial zoom | 0.8 | Centered on grid origin (0,0) |
| Zoom range | 0.3 - 2.0 | Scroll wheel control |

### Scene Render Order (bottom to top)
1. **Base layer**: walls + floor (project rooms + break room) — interactive (room click)
2. **Labels layer**: project name + break room text — non-interactive
3. **Desks + furniture layer**: workstations with diamond mask + break room sofas/TV/vending — non-interactive (eventMode="none", click passthrough)
4. **Ducks layer**: agent avatars — interactive (click opens action menu)

### Room Types
| Room | Floor Color | Wall Colors | Contents |
|------|-------------|-------------|----------|
| Project Room | `#1e1e3a` (dark indigo) | `#2a2a4a` / `#242444` | Desks + monitors + keyboards + agent ducks |
| Break Room | `#2a1f1a` (warm brown) | `#1a3a3a` / `#163333` (teal) | 2 sofas, wall TV, vending machine |

### Agent Avatar (OfficeDuck)
- **Texture**: circular clipping via offscreen canvas (128x128), wrapped as PixiJS Texture
- **Fallback**: colored circle with initial letter (agent.label first char)
- **Border ring**: agent color, `AVATAR_RADIUS=18`, `BORDER_WIDTH=2.5`
- **Bobbing animation**: `sin()` oscillation — busy: fast (0.15), waiting: slow (0.05), idle: subtle (0.03)
- **Typing particles**: 3 dots above head when `status === 'busy'`
- **Session dots**: up to 5 dots in arc at top-right, colors match session status
- **Render throttle**: useTick at 60fps, React re-render every 5 frames (12fps)
- **Memory**: texture destroyed on unmount (GPU cleanup), blob URLs revoked

### Session Status Dots
| Priority | Color | Hex | Condition |
|----------|-------|-----|-----------|
| 1 (highest) | Purple | `#a855f7` / `0xa855f7` | Pending user question |
| 2 | Yellow | `#f59e0b` / `0xf59e0b` | Loading or streaming |
| 3 | Green | `#22c55e` / `0x22c55e` | Last assistant message complete |
| 4 (lowest) | Gray | `#6b7280` / `0x6b7280` | Empty or dormant |

### Action Menu
- **Trigger**: click on duck avatar
- **Position**: absolute, offset 30px right from click point
- **Content**: agent color dot + name, status text, branch (monospace), session list with status dots
- **Session navigation**: click session item to navigate to that session's chat
- **Fallback**: "Vai alla Chat" button when no active sessions
- **Close**: click outside (mousedown listener on document)
- **Scroll isolation**: `onWheel` stopPropagation prevents canvas zoom

### Navigation
- **Pan**: mouse drag (left button) — grab/grabbing cursor
- **Zoom**: scroll wheel (deltaY * 0.001), clamped 0.3-2.0
- **Initial center**: viewport centered on grid origin (0,0) via half container size
- **Resize handling**: ResizeObserver + `isActive` re-measure on tab activation (position:absolute workaround)

### CSP Workaround
- `import 'pixi.js/unsafe-eval'` required before any PixiJS usage
- Replaces `new Function()` calls in shader compilation with CSP-safe polyfills
- Without it: production `script-src 'self'` blocks shaders, causing black screen

### PixiJS Destroy Patch
- `Application.prototype.destroy` wrapped in try-catch at module level
- Catches `_cancelResize` TypeError from @pixi/react v8 async race condition
- Without patch: TypeError propagates to React reconciler, marks root as `RootFatalErrored`, all future rendering stops

### Props (OfficeView)
| Prop | Type | Description |
|------|------|-------------|
| `terminals` | `TerminalInfo[]` | All registered agent terminals |
| `isActive` | `boolean` | Whether the office tab is currently visible (triggers resize re-measure) |
| `onRoomClick` | `(projectPath: string) => void` | Callback when clicking a room floor |
| `onDuckClick` | `(agentId: string) => void` | Callback when clicking an agent duck |
| `onSessionClick` | `(sessionId: string) => void` | Callback for session navigation from action menu |
| `onExitOffice` | `() => void` | "Torna alla Chat" button handler |

### State
- `viewport`: `{zoom, panX, panY}` — canvas pan/zoom (component state)
- `actionMenu`: `ActionMenuData | null` — currently open action menu (component state)
- `isDragging`: `boolean` — pan drag active (component state)
- `containerSize`: `{w, h}` — ResizeObserver-tracked container dimensions (component state)
- `agentDotColors`: `Map<string, number[]>` — pre-computed session dot colors per agent (derived from Zustand stores, passed as props to PixiJS tree)

### External Dependencies
- PixiJS v8 (`pixi.js`, `@pixi/react`) — 2D WebGL/Canvas rendering
- Zustand stores: `sessionStore` (sessions), `chatStore` (chatLoadingMap, pendingQuestionsMap, chatSessions)
- Zero Tauri commands (reads only from in-memory stores)

### UI Language
- Header stats: Italian ("progetti", "agenti attivi")
- Action menu: Italian ("Lavorando", "In attesa", "Vai alla Chat")
- Break room label: English ("Break Room")
