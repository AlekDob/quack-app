---
type: gotcha
project: quack-app
created: 2026-04-02
last_verified: 2026-04-02
tags: [popout, codemirror, css, search-panel, dark-theme]
---

# Popout Window Search Panel CSS Scope

## Problem

CodeMirror 6 search panel buttons appear with default browser styling (white/light buttons) when the editor is rendered inside a popout window (`TabPopoutWindowApp`).

## Root Cause

The main editor's dark theme CSS overrides are scoped to `.code-editor-view .cm-panel.cm-search` in `CodeEditorView.css`. The popout window renders `CodeEditorEngine` directly without the `.code-editor-view` wrapper, so those CSS rules don't apply.

The CM6 theme (`editorTheme.ts`) does include `.cm-panel button` styles, but WebKit's default `button` styling has higher specificity in some cases.

## Fix

Duplicate the search panel CSS overrides in `TabPopoutWindowApp.css`, scoped to `.tab-popout-content`:

```css
.tab-popout-content .cm-panel.cm-search button { ... }
```

## Trigger

Any time a new CM6-based feature is added that might render in a popout window, the CSS overrides must exist in BOTH `CodeEditorView.css` AND `TabPopoutWindowApp.css`.
