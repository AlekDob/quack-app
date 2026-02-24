---
type: gotcha
project: quack-app
created: 2026-02-24
last_verified: 2026-02-24
tags: [remote-dashboard, vanilla-js, event-binding]
---
# Dashboard Login: bindEvents() must be called after every render

## Problem

In the vanilla JS SPA (`static/app.js`), `render()` rebuilds the DOM via `innerHTML`.
After setting `innerHTML`, all event handlers are lost because the old DOM nodes are destroyed.

The original code called `bindEvents()` only after the main content render, but NOT after the login screen render:

```js
function render() {
  if (!state.token) {
    app.innerHTML = renderLogin();
    return;  // ← bindEvents() never called!
  }
  // ...
  bindEvents();
}
```

## Fix

Call `bindEvents()` before every `return` that sets `innerHTML`:

```js
if (!state.token) {
  app.innerHTML = renderLogin();
  bindEvents();  // ← must bind login button events
  return;
}
```

## Related

Also: the token injection placeholder must be distinct from the JS variable name.
`__QUACK_TOKEN__` was used both as the JS key (`window.__QUACK_TOKEN__`) and the replacement target,
causing `str.replace()` to replace both. Fixed by using `%%INJECT_TOKEN%%` as the placeholder value only.
