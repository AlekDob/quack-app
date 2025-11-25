# DocsViewer Integration Guide

This guide shows how to integrate the DocsViewer into App.tsx with minimal changes.

## Step 1: Import Required Components

Add these imports at the top of App.tsx:

```tsx
import { useDocsTab } from './hooks/useDocsTab';
import DocsTabView from './views/DocsTabView';
```

## Step 2: Initialize the Hook

Inside the App component, after other hooks:

```tsx
// Documentation tab management
const { openDocsTab, isDocsTab } = useDocsTab();
```

## Step 3: Add Handler Function

Add this handler function (near other handlers like `handleOpenBrowserTab`):

```tsx
const handleOpenDocsTab = useCallback(() => {
  const newTab = openDocsTab();
  setTabs((prevTabs) => [...prevTabs, newTab]);
  setActiveTabId(newTab.id);
}, [openDocsTab]);
```

## Step 4: Pass to TerminalSidebar

Find where `<TerminalSidebar />` is rendered and add the `onOpenDocs` prop:

```tsx
<TerminalSidebar
  // ... existing props ...
  onOpenSettings={() => {
    setShowSettings(true);
  }}
  onOpenDocs={handleOpenDocsTab}  // ADD THIS LINE
  // ... more props ...
/>
```

## Step 5: Render DocsTabView

Find where tabs are rendered (look for `activeTab.type === 'browser'` etc.) and add:

```tsx
{/* Documentation Tab */}
{tabs
  .filter((tab) => tab.type === 'docs')
  .map((tab) => (
    <DocsTabView
      key={tab.id}
      tab={tab}
      isActive={activeTabId === tab.id}
    />
  ))}
```

## That's It!

The documentation viewer is now integrated. Users can click "Guide" in the sidebar to open the docs.

## File Locations

- Hook: `src/hooks/useDocsTab.tsx`
- View: `src/views/DocsTabView.tsx`
- Viewer: `src/components/docs/DocsViewer.tsx`
- Content: `docs/guide/`
