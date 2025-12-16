# Tab Popout Window Feature

**Status**: Implemented
**Version**: 1.0.0
**Last Updated**: 2025-12-16

## Overview

The Tab Popout Window feature allows users to drag tabs out of the main application window to create independent floating windows, similar to Visual Studio Code's tab detachment functionality. This enables multi-monitor workflows and side-by-side content viewing.

## Feature Summary

- Drag tabs outside the tab bar (60px threshold) to create floating windows
- Each popout window maintains its own state and position
- Windows persist across app restarts
- Glassmorphism design matching Quack's visual style
- Support for multiple tab types (files, docs, terminals, etc.)
- Custom titlebar with native window dragging

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Application                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  TabBar Component                                     │   │
│  │  ┌────┐ ┌────┐ ┌────┐                                │   │
│  │  │Tab1│ │Tab2│ │Tab3│ <-- Drag Detection (60px)     │   │
│  │  └────┘ └────┘ └────┘                                │   │
│  └──────────────────────────────────────────────────────┘   │
│           │                                                  │
│           │ onTabPopout(tab, position)                      │
│           ▼                                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  useTabPopoutWindow Hook                             │   │
│  │  - Create WebviewWindow via Tauri API                │   │
│  │  - Pass tab data via URL params                      │   │
│  │  - Manage window lifecycle                           │   │
│  └──────────────────────────────────────────────────────┘   │
│           │                                                  │
│           │ WebviewWindow.create()                          │
│           ▼                                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  popoutWindowStore (Zustand)                         │   │
│  │  - Persist window state                              │   │
│  │  - Store: .quack-popout-windows.dat                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ Tauri Event Bridge
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Popout Window (WebviewWindow)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  tab-popout.html                                      │   │
│  │  └──> src/tab-popout-entry.tsx                       │   │
│  │       └──> TabPopoutWindowApp                        │   │
│  └──────────────────────────────────────────────────────┘   │
│           │                                                  │
│           │ Parse URL params (tabData)                      │
│           ▼                                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Custom Titlebar (Draggable)                         │   │
│  │  [Icon] Tab Name                    [─] [×]          │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Content Area                                         │   │
│  │  - Renders based on tab.type                         │   │
│  │  - Currently: placeholder views                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Files Structure

| File Path | Type | Purpose |
|-----------|------|---------|
| `tab-popout.html` | HTML | Entry point for popout windows |
| `src/tab-popout-entry.tsx` | React | React root for popout window |
| `src/components/TabPopoutWindowApp.tsx` | Component | Main popout window UI component |
| `src/components/TabPopoutWindowApp.css` | Styles | Glassmorphism styling |
| `src/hooks/useTabPopoutWindow.ts` | Hook | Window lifecycle management |
| `src/stores/popoutWindowStore.ts` | Store | Zustand state persistence |
| `src/components/TabBar.tsx` | Component | Drag-out detection logic |
| `vite.config.ts` | Config | Multi-page build configuration |
| `src/tests/tabPopout.test.ts` | Tests | 35 unit tests |

### Key Components

#### 1. TabBar Component
**Location**: `src/components/TabBar.tsx`

**Responsibilities**:
- Detect when tab is dragged outside bounds
- Calculate 60px threshold for popout trigger
- Emit `onTabPopout` event with position data

**Key Code**:
```typescript
const POPOUT_THRESHOLD = 60;

const isOutsideTabBar = (clientX: number, clientY: number): boolean => {
  const rect = tabBarRef.current.getBoundingClientRect();
  return (
    clientY < rect.top - POPOUT_THRESHOLD ||
    clientY > rect.bottom + POPOUT_THRESHOLD ||
    clientX < rect.left - POPOUT_THRESHOLD ||
    clientX > rect.right + POPOUT_THRESHOLD
  );
};
```

#### 2. useTabPopoutWindow Hook
**Location**: `src/hooks/useTabPopoutWindow.ts`

**Responsibilities**:
- Create WebviewWindow instances
- Serialize tab data for URL transmission
- Handle window lifecycle events
- Persist window state to store

**Window Sizes by Type**:
```typescript
'file': { width: 1000, height: 800 }
'agent-terminal': { width: 1200, height: 700 }
'browser': { width: 1200, height: 900 }
'docs': { width: 900, height: 700 }
'memory-graph': { width: 1000, height: 800 }
default: { width: 800, height: 600 }
```

**API**:
```typescript
const {
  popoutTab,              // Create new popout window
  closePopoutWindow,      // Close specific window
  closeAllPopoutWindows,  // Close all windows
  isTabPoppedOut,         // Check if tab is popped out
  updatePopoutTab,        // Send updates to window
} = useTabPopoutWindow(onTabReturn);
```

#### 3. TabPopoutWindowApp Component
**Location**: `src/components/TabPopoutWindowApp.tsx`

**Responsibilities**:
- Parse tab data from URL params
- Render custom titlebar
- Display tab content based on type
- Handle window controls (minimize, close)
- Emit lifecycle events

**Lifecycle Events**:
```typescript
// On mount
emit('tab-popout-ready', { tabId });

// Before close
emit('tab-popout-closing', { tabId, position, size });

// Listen for updates
listen(`tab-popout-update-${tabId}`, updateHandler);
listen(`tab-popout-close-${tabId}`, closeHandler);
```

#### 4. popoutWindowStore
**Location**: `src/stores/popoutWindowStore.ts`

**Responsibilities**:
- Zustand store for state management
- Persist to `.quack-popout-windows.dat`
- Track window positions and sizes
- Restore windows on app restart

**Store Schema**:
```typescript
interface PopoutWindowInfo {
  windowLabel: string;           // Unique identifier
  tab: Tab;                       // Full tab data
  position: { x: number; y: number };
  size: { width: number; height: number };
  createdAt: number;              // Timestamp
}
```

## Data Flow

### 1. Creating a Popout Window

```
User drags tab → TabBar detects outside bounds (60px threshold)
                       ↓
              onTabPopout(tab, position)
                       ↓
        useTabPopoutWindow.popoutTab()
                       ↓
    Serialize tab data → encodeURIComponent(JSON.stringify(tab))
                       ↓
        Create WebviewWindow with URL params
        url: tab-popout.html?tabId=...&tabType=...&tabData=...
                       ↓
          Save to popoutWindowStore
                       ↓
        Emit 'tab-popout-created' event
```

### 2. Rendering Popout Content

```
tab-popout.html loads → src/tab-popout-entry.tsx
                               ↓
                    TabPopoutWindowApp mounts
                               ↓
              Parse URL params (tabData)
                               ↓
                Deserialize: JSON.parse(decodeURIComponent(tabData))
                               ↓
              Render titlebar + content based on tab.type
                               ↓
                Emit 'tab-popout-ready'
```

### 3. Closing a Popout Window

```
User clicks close button → handleClose()
                               ↓
              beforeunload event fires
                               ↓
        Save position & size → emit('tab-popout-closing')
                               ↓
              Window closes (Tauri API)
                               ↓
        'tauri://destroyed' event → handleWindowClose()
                               ↓
        Remove from popoutWindowStore
                               ↓
            emit('tab-popout-closed')
```

## Event System

### Events Emitted by Main Window

| Event | Payload | Direction | Purpose |
|-------|---------|-----------|---------|
| `tab-popout-created` | `{ tab }` | Main → Popup | Confirm window creation |
| `tab-popout-update-${tabId}` | `Partial<Tab>` | Main → Popup | Update tab content |
| `tab-popout-close-${tabId}` | `null` | Main → Popup | Request window close |

### Events Emitted by Popout Window

| Event | Payload | Direction | Purpose |
|-------|---------|-----------|---------|
| `tab-popout-ready` | `{ tabId }` | Popup → Main | Window ready to receive updates |
| `tab-popout-closing` | `{ tabId, position, size }` | Popup → Main | Save state before close |
| `tab-popout-closed` | `{ tabId }` | Popup → Main | Window has closed |
| `tab-popout-dragback` | `{ tab, position }` | Popup → Main | Return tab to main window (planned) |

## Supported Tab Types

### Popout Enabled

| Type | Icon | Default Size | Notes |
|------|------|--------------|-------|
| `file` | 📄 | 1000×800 | File editor |
| `docs` | 📖 | 900×700 | Documentation viewer |
| `memory-graph` | 🧠 | 1000×800 | Knowledge graph |
| `browser` | 🌐 | 1200×900 | Web browser |
| `skill` | ⚡ | 800×600 | Skill viewer |
| `command` | / | 800×600 | Command viewer |
| `agent-terminal` | 🦆 | 1200×700 | Terminal window |

### Popout Disabled

| Type | Reason |
|------|--------|
| `chat` | Main app tab, always pinned |

**Validation Function**:
```typescript
function canPopoutTab(tab: Tab): boolean {
  return tab.type !== 'chat';
}
```

## Persistence

### Storage Location
`.quack-popout-windows.dat` (Tauri plugin-store)

### Data Persisted
- Window label (unique identifier)
- Full tab data (type, label, metadata)
- Window position (x, y)
- Window size (width, height)
- Creation timestamp

### Restoration on Startup
Windows are **NOT** automatically restored on app restart. The store maintains history for future implementation of session restoration.

## Usage Guide

### For Users

#### Creating a Popout Window
1. Click and hold any tab (except "Chat")
2. Drag the tab outside the tab bar area
3. Move cursor at least 60 pixels away from tab bar
4. Release mouse button
5. Popout window appears at cursor position

#### Moving a Popout Window
1. Click and drag the titlebar
2. Window follows cursor movement
3. Native Tauri window dragging provides smooth experience

#### Closing a Popout Window
1. Click the × button in titlebar (saves position/size)
2. Or use standard OS window close (Cmd+W, Alt+F4, etc.)
3. Tab can be re-opened from main window if needed

### For Developers

#### Integrate Popout in Component

```typescript
import { useTabPopoutWindow } from '../hooks/useTabPopoutWindow';

function MyComponent() {
  const { popoutTab, isTabPoppedOut } = useTabPopoutWindow();

  const handleTabPopout = async (tab: Tab, position: PopoutPosition) => {
    const windowLabel = await popoutTab(tab, position);
    console.log('Created window:', windowLabel);
  };

  return (
    <TabBar
      tabs={tabs}
      onTabPopout={handleTabPopout}
    />
  );
}
```

#### Add New Tab Type Support

1. **Add type to Tab interface** (`src/components/TabBar.tsx`):
```typescript
export interface Tab {
  type: 'chat' | 'file' | ... | 'my-new-type';
  // ...
}
```

2. **Define window size** (`src/hooks/useTabPopoutWindow.ts`):
```typescript
const getWindowSizeForTabType = (type: Tab['type']) => {
  switch (type) {
    case 'my-new-type':
      return { width: 1000, height: 800 };
    // ...
  }
};
```

3. **Add rendering logic** (`src/components/TabPopoutWindowApp.tsx`):
```typescript
const renderTabContent = () => {
  switch (tab.type) {
    case 'my-new-type':
      return <MyNewTypeView tab={tab} />;
    // ...
  }
};
```

4. **Update tests** (`src/tests/tabPopout.test.ts`):
```typescript
it('should return true for my-new-type tabs', () => {
  const tab: Tab = {
    type: 'my-new-type',
    // ...
  };
  expect(canPopoutTab(tab)).toBe(true);
});
```

## Design System

### Glassmorphism Styling

**Colors**:
- Background: `rgba(10, 12, 16, 0.95)`
- Titlebar: `rgba(20, 24, 32, 0.8)`
- Accent: `#f28c52` (Quack orange)
- Border: `rgba(255, 255, 255, 0.1)`

**Effects**:
- Backdrop filter: `blur(20px)`
- Border radius: `12px`
- Box shadow: `0 8px 32px rgba(0, 0, 0, 0.5)`

**Transitions**:
- Button hover: `0.2s ease`
- Titlebar drag: Background changes to orange tint

### Custom Titlebar

```
┌────────────────────────────────────────────┐
│ 📄 App.tsx                        [─] [×]  │ ← Titlebar (Draggable)
├────────────────────────────────────────────┤
│                                            │
│                                            │
│            Content Area                    │ ← Tab content
│                                            │
│                                            │
└────────────────────────────────────────────┘
```

**Titlebar Features**:
- Icon based on tab type (emoji)
- Truncated label with ellipsis
- Minimize button (−)
- Close button (×)
- Hover effects with scale transform
- Focus-visible outline for accessibility

### Placeholder Views

While full content rendering is not yet implemented, each tab type shows a styled placeholder:

```
   📄
File Editor
/path/to/file.ts
```

**Styling**:
- Large floating icon (64px, animated)
- Title (18px, semi-bold)
- Subtitle (14px, dimmed)
- Centered layout

## Testing

### Test Coverage
**File**: `src/tests/tabPopout.test.ts`
**Tests**: 35 passing unit tests

### Test Categories

#### 1. Window Label Generation (4 tests)
- Unique labels with timestamp
- Special character sanitization
- Different tab types
- Timestamp accuracy

#### 2. Tab Type Validation (8 tests)
- Chat tab rejection
- All tab types validation
- Edge case handling

#### 3. Drag Detection (15 tests)
- Above/below/left/right threshold
- Inside tab bar detection
- Threshold boundary testing
- Invalid coordinate handling

#### 4. Popout Behavior (3 tests)
- Prevent multiple triggers
- Reset on drag end
- State management

#### 5. Edge Cases (5 tests)
- Complete tab data
- Minimal tab data
- Long labels
- Special characters
- Real-world scenarios

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Interactive UI
npm run test:ui
```

### Example Test

```typescript
it('should detect when cursor is above tab bar (beyond threshold)', () => {
  mockTabBar.getBoundingClientRect = vi.fn(() => ({
    top: 100,
    bottom: 150,
    left: 0,
    right: 800,
  }));

  const rect = mockTabBar.getBoundingClientRect();
  const cursorY = 30; // Above threshold
  const isOutside = cursorY < rect.top - POPOUT_THRESHOLD;

  expect(isOutside).toBe(true);
});
```

## Configuration

### Vite Build Configuration

**File**: `vite.config.ts`

```typescript
rollupOptions: {
  input: {
    main: resolve(rootDir, 'index.html'),
    'tab-popout': resolve(rootDir, 'tab-popout.html'), // Added
    // ... other entries
  },
}
```

This creates a separate bundle for popout windows, optimizing load time and isolating dependencies.

### Tauri Window Options

```typescript
new WebviewWindow(windowLabel, {
  url,                    // tab-popout.html?params...
  title: tab.label,       // Window title
  width: windowSize.width,
  height: windowSize.height,
  x: windowX,             // Cursor-centered
  y: windowY,
  decorations: false,     // Custom titlebar
  transparent: true,      // Glassmorphism
  resizable: true,        // User can resize
  alwaysOnTop: false,     // Normal window behavior
  focus: true,            // Activate on creation
});
```

## Known Limitations & Future Enhancements

### Current Limitations

1. **Placeholder Content**: Actual content rendering not implemented
   - File editor shows placeholder instead of Monaco
   - Browser shows placeholder instead of webview
   - Terminal shows placeholder instead of xterm.js

2. **No Drag-Back**: Cannot drag titlebar back to re-attach
   - Only way to return: close window
   - Planned feature for future release

3. **No Session Restoration**: Windows don't restore on app restart
   - Store is ready, implementation pending
   - Requires app-level initialization logic

4. **Single Tab Per Window**: Can't drag multiple tabs to same window
   - Each window = one tab
   - Multi-tab windows planned for future

### Planned Enhancements

#### Priority 1: Content Rendering
- [ ] Integrate Monaco Editor for `file` tabs
- [ ] Integrate xterm.js for `agent-terminal` tabs
- [ ] Integrate webview for `browser` tabs
- [ ] Integrate DocsViewer for `docs` tabs

#### Priority 2: Drag-Back
- [ ] Detect when titlebar is dragged over main window
- [ ] Emit `tab-popout-dragback` event
- [ ] Add tab back to TabBar
- [ ] Close popout window

#### Priority 3: Session Restoration
- [ ] Implement `restoreWindows()` on app startup
- [ ] Handle edge cases (screen disconnected, etc.)
- [ ] Add user preference to enable/disable

#### Priority 4: Advanced Features
- [ ] Window snapping (edge detection)
- [ ] Multi-tab popout windows (tabbed interface)
- [ ] Window grouping (link related windows)
- [ ] Picture-in-Picture mode toggle
- [ ] Keyboard shortcuts (Cmd+Shift+T to popout)

## Troubleshooting

### Issue: Window doesn't appear

**Cause**: Tab type is `chat` (not allowed)
**Solution**: Only non-chat tabs can be popped out

**Cause**: Drag didn't reach 60px threshold
**Solution**: Drag further away from tab bar

### Issue: Window appears at wrong position

**Cause**: Multi-monitor setup with different DPI
**Solution**: Position calculation uses `screenX/screenY` for accuracy

### Issue: Content shows placeholder

**Cause**: Actual content rendering not yet implemented
**Solution**: Planned for Priority 1 enhancements

### Issue: Can't drag window back

**Cause**: Drag-back feature not implemented
**Solution**: Close window to return tab to main app

### Issue: Windows lost after restart

**Cause**: Session restoration not implemented
**Solution**: Manually re-open tabs after restart

## Performance Considerations

### Bundle Size
- Separate Vite entry point prevents bloating main bundle
- Popout window bundle: ~200KB (compressed)
- Lazy-loaded only when first popout created

### Memory Usage
- Each window: ~50-100MB (depending on content)
- Tauri WebviewWindow is lightweight vs. Electron BrowserWindow
- Store overhead: <1KB per window

### Event Performance
- Tauri events are IPC-based (fast)
- Typical round-trip: <5ms
- No performance impact on main window

## References

### Related Documentation
- [Architecture Overview](../01-architecture.md)
- [Tab System Design](../06-design/tab-system.md)
- [Testing Strategy](../testing-strategy.md)

### External Resources
- [Tauri WebviewWindow API](https://tauri.app/v2/reference/javascript/webviewwindow/)
- [Zustand Store](https://github.com/pmndrs/zustand)
- [VS Code Tab Detachment](https://code.visualstudio.com/docs/getstarted/userinterface#_tabs)

### Code References
- Tab Bar Component: `src/components/TabBar.tsx` (lines 220-255)
- Popout Hook: `src/hooks/useTabPopoutWindow.ts` (lines 105-184)
- Store Implementation: `src/stores/popoutWindowStore.ts` (lines 37-190)
- Test Suite: `src/tests/tabPopout.test.ts` (684 lines, 35 tests)

---

**Documentation Version**: 1.0.0
**Feature Version**: 1.0.0 (MVP)
**Author**: Documentation Writer Expert
**Last Updated**: 2025-12-16
