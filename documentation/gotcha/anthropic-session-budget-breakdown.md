---
type: gotcha
created: 2026-07-01
last_verified: 2026-07-01
tags: [anthropic, api, session, budget, limits]
---

# Anthropic API: no per-category session budget breakdown

**Problem:** The `claude_usage_limits` API returns only an aggregate utilization
% for the 5hr rolling session pool. It does not expose a per-category
breakdown (tools, memory, context window, CLAUDE.md).

**Impact:** The Session Usage drawer cannot show "X% from tools, Y% from
memory" — only the total %. All displayed data must be real aggregate metrics
(utilization %, cost, token count), not estimated splits.

**Workaround:** The drawer shows only verifiable data:

- Aggregate 5hr utilization % (from API)
- Total tokens consumed (tracked locally per-turn)
- Total cost (tracked locally per-turn)
- Cache-hit ratio (from API)

No simulated breakdown is attempted. If Anthropic adds a per-category API in
the future, this gotcha lifts.
