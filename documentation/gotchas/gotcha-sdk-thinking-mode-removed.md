---
type: gotcha
project: quack-app
created: 2026-02-22
last_verified: 2026-02-22
tags: [sdk, thinking, breaking-change, opus-46]
---
# SDK thinkingMode property removed in v0.2.48+

## Trigger
Setting `options.thinkingMode` on the SDK query options — the property is silently ignored.

## Symptom
THINKING blocks appear in every response regardless of user's thinking mode setting. Opus 4.6 defaults to adaptive thinking when no `thinking` config is set.

## Root Cause
The `thinkingMode` string property was removed from the SDK. Replaced by:
- `thinking: ThinkingConfig` — controls ON/OFF/ADAPTIVE
- `effort: 'low' | 'medium' | 'high' | 'max'` — controls thinking depth

## Fix
Replace `options.thinkingMode = mode` with:

```javascript
// Disable thinking
options.thinking = { type: 'disabled' };

// Adaptive (default for Opus 4.6 — don't need to set)
options.thinking = { type: 'adaptive' };

// Control depth via effort
options.effort = 'high';
```

## Mapping from old to new
| Old thinkingMode | New thinking config | New effort |
|---|---|---|
| `'auto'` | (default/adaptive) | (unchanged) |
| `'think'` | `{ type: 'adaptive' }` | `'medium'` |
| `'hard'` | `{ type: 'adaptive' }` | `'high'` |
| `'harder'` | `{ type: 'adaptive' }` | `'max'` |
| `'ultra'` | `{ type: 'adaptive' }` | `'max'` |
| `'disabled'` | `{ type: 'disabled' }` | — |

## Files affected
- `src-tauri/node-sdk/stream-claude.js` — SDK query options
- `src/services/claudeSDK.ts` — frontend SDK options (passthrough)
- `src/types.ts` — ThinkingMode and EffortLevel types
