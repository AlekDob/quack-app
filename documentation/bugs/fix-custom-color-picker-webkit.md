---
type: bug
project: quack-app
created: 2026-04-07
last_verified: 2026-04-07
tags: [color-picker, webkit, tauri, appearance, settings]
---

# Custom Color Picker Not Opening in WebKit

## Symptom
Clicking the "Custom" accent color swatch in Settings > Appearance does nothing -- the native color picker never opens.

## Root Cause
`<input type="color">` does **not** work in Tauri's WKWebView on macOS. The native OS color dialog cannot be triggered from a WebView context, regardless of how `.click()` is invoked (inside button, outside button, programmatic or user-initiated).

This is the same class of issue as `window.confirm()` (see gotcha-window-confirm-tauri-webview.md).

## Investigation Timeline
1. First attempt: moved `<input type="color">` outside the `<button>` -- still broken
2. Confirmed: WKWebView simply does not support native color picker dialogs
3. Built custom picker inline -- worked but rendered inside the CSS grid, stretching and misaligned
4. Final fix: portal-based floating popover with `position: fixed`

## Fix
Replaced `<input type="color">` entirely with `CustomColorPicker.tsx`, rendered via `createPortal(picker, document.body)` as a floating popover.

**Component features:**
- Saturation/Lightness 2D area (click + drag)
- Hue slider bar (click + drag)
- Hex text input for precise values
- Live preview swatch
- `position: fixed` via portal -- escapes all parent overflow/z-index contexts
- Positioned above the anchor button (flips below if no space)
- Closes on outside click (with setTimeout guard to prevent same-click close)
- Fade-in animation + backdrop-blur + deep shadow

**Files:**
- `src/components/settings/controls/CustomColorPicker.tsx` (new)
- `src/components/settings/categories/AppearanceSettings.tsx` (uses CustomColorPicker via anchorPos + showPicker state)
- `src/components/settings/UnifiedSettings.css` (`.custom-color-picker`, `.ccp-*` styles)

## Prevention
Never use `<input type="color">` in Tauri apps targeting macOS. Build custom picker UI instead.
Same rule applies to `<input type="date">`, `<input type="time">`, and other inputs that rely on native OS dialogs.
When building floating pickers in Settings, always use `createPortal` + `position: fixed` to escape the scrollable content area and CSS grid.
