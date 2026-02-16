---
type: pattern
created: 2026-01-10
---

# Quack Agent Power Rating System

Simple, intuitive, non-invasive. A number indicating how "equipped" an agent is.

## Formula

```
Power = (Skills x 100) + (Droids x 150) + (Rules x 50) + (Commands x 75) + Base(100)
```

| Component | Weight | Rationale |
|-----------|--------|-----------|
| Skill | 100 | Core abilities |
| Droid | 150 | Subagents are powerful |
| Rule | 50 | Guidelines, less impactful |
| Command | 75 | Utility shortcuts |
| Base | 100 | Everyone starts at 100 |

## Examples

- **Minimal** (1 skill): Power = 200
- **Standard** (2 skills, 1 droid, 2 rules): Power = 550
- **Pro** (4 skills, 2 droids, 3 rules, 2 commands): Power = 1100

## Advantages

1. Zero complexity -- one calculation, one number
2. Immediate feedback -- see impact of adding equipment
3. Comparable -- easy to compare agents in marketplace
4. Non-blocking -- no unlock requirements
