---
type: bug
project: quack-app
created: 2026-03-24
last_verified: 2026-03-24
tags: [sdk, node-sdk, stream-claude, const, javascript]
---

# stream-claude.js: Assignment to constant variable

## Problem
Sending any message via Quack throws "Assignment to constant variable" error, caught at App.tsx:2810.

## Root Cause
In `stream-claude.js` (legacy spawn path), `prompt` is destructured with `const` at line 214:
```js
const { prompt, model, ... } = config;
```

But later at line 1040, the prompt cache fix (Brain: fix-session-limit-prompt-cache) reassigns it:
```js
prompt = finalPrompt;  // TypeError: Assignment to constant variable
```

This was needed because `generateMessages()` (line 432) reads the module-level `prompt` variable.

## Fix
Changed `const` to `let` in the destructuring:
```js
let { prompt, model, ... } = config;
```

## Files modified
| File | Change |
|------|--------|
| `src-tauri/node-sdk/stream-claude.js` | Changed `const` to `let` for config destructuring |
