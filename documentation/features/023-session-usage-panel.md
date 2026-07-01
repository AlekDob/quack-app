---
type: feature
project: quack-desktop
created: 2026-07-01
last_verified: 2026-07-01
tags: [session, usage, progress, claude-code, drawer, monitor, quack-v1]
---

# 023 — Session Usage Panel

**Purpose:** A 16px ProgressCircle in the composer showing the real-time 5hr
Claude Code session utilization % + a slide-over drawer with plan limits, extra
usage, and real metrics.

## Data flow

| Concern | Source | Rate |
|---|---|---|
| Session utilization % | `claude_usage_limits` API | Every 30s poll |
| Cumulative token tracking | `AIChatPanel` local state | Per-turn update |
| Cost / turns / cache-hit | AI usage log (`aiUsageLog`) | Per-turn update |
| Drawer detail cards | Same sources, computed on open | Live refresh |

## Components

| File | Role |
|---|---|
| `src/components/SessionUsageCircle.tsx` | 16px ProgressCircle in composer toolbar, colour-coded by % |
| `src/components/SessionUsageDrawer.tsx` | Slide-over drawer with detail cards (plan, extra, metrics) |
| `src/components/AIChatPanel.tsx` | Hosts the circle + drawer, manages polling + cumulative state |
| `src/App.css` | `.usage-*` CSS tokens for circle/drawer |

## Triggers & interactions

- **Click** on ProgressCircle → opens drawer with plan limits, extra usage, session metrics
- **Esc** / **X button** / **backdrop click** → closes drawer (reuses existing slide-over pattern)
- Polling runs in background while chat is active, stops when chat is idle/closed

## Colour thresholds (circle + drawer bars)

| Range | Colour | Meaning |
|---|---|---|
| <60% | Green | Safe |
| 60-80% | Yellow | Approaching limit |
| >80% | Red | Near/at cap |

## Related

- Usage monitor (Sessions + Context): `019-usage-monitor.md`, `020-context-optimizer.md`

## Gotcha

Anthropic's API does not expose a per-category breakdown of the 5hr session
budget (tools, memory, context, CLAUDE.md). The drawer shows only real aggregate
data: utilization %, total cost, total tokens. See
`documentation/gotcha/anthropic-session-budget-breakdown.md`.
