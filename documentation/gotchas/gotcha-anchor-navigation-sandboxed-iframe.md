---
type: gotcha
project: quack-app
created: 2026-03-27
last_verified: 2026-03-27
tags: [iframe, sandbox, srcdoc, anchor, navigation, html-visualizer]
---

# Gotcha: Anchor Links Navigate Away in Sandboxed srcdoc Iframes

## Trigger

When an `<a href="#section">` link is clicked inside a sandboxed iframe using `srcdoc`, the browser navigates the iframe away from its srcdoc content — showing the Quack splash/default page instead of scrolling to the target element.

## Root Cause

In a `sandbox="allow-scripts"` iframe with `srcdoc`, the browser treats `#section` as a navigation to `about:srcdoc#section`, which effectively reloads the iframe and loses the srcdoc content. This is different from a normal page where `#anchors` scroll in-place.

## Fix

Intercept all anchor clicks via JS and use `scrollIntoView` instead:

```js
document.addEventListener('click', function(e) {
  var link = e.target.closest('a[href^="#"]');
  if (!link) return;
  e.preventDefault();
  var targetId = link.getAttribute('href').slice(1);
  var target = document.getElementById(targetId);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});
```

This is injected automatically by `wrapHtmlForSandbox()` in `htmlVisualizerUtils.ts`.

## Brain Breadcrumb

`// Brain: fix-anchor-navigation-sandboxed-iframe` — in `htmlVisualizerUtils.ts` (AUTO_RESIZE_SCRIPT).
