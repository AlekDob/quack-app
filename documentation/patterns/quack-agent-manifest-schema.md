---
type: pattern
created: 2026-01-10
---

# Quack Agent Manifest Schema

## manifest.json Schema

```json
{
  "$schema": "https://quack.dev/schemas/agent-bundle-v1.json",
  "id": "agent-charlie",
  "version": "1.0.0",
  "name": "Agent Charlie",
  "displayName": "Charlie - Code Reviewer",
  "description": "Senior Code Reviewer specializing in TypeScript and React",
  "author": { "name": "Alek Dobrohotov", "github": "alekdob" },
  "license": "MIT",
  "personality": {
    "role": "Senior Code Reviewer & Quality Engineer",
    "class": "reviewer",
    "communicationStyle": "professional",
    "avatar": "assets/charlie.png",
    "color": "#9333EA"
  },
  "equipment": {
    "skills": [{ "id": "code-review", "required": true }],
    "droids": [{ "id": "test-runner", "required": true }],
    "rules": [{ "id": "typescript-strict", "required": true }],
    "commands": [{ "id": "review-pr", "required": true }]
  },
  "stats": { "level": 5, "xp": 2500, "skillPoints": 3, "droidSlots": 2 },
  "compatibility": { "quackVersion": ">=1.0.0", "claudeCodeVersion": ">=0.2.0" },
  "marketplace": { "category": "code-quality", "tags": ["review", "typescript"], "verified": true }
}
```

## Key Design Decisions

1. **Semantic Versioning** -- Standard semver for updates
2. **Equipment System** -- Skills/Droids/Rules as RPG 'equipment'
3. **Stats System** -- Level/XP for gamification
4. **Compatibility Matrix** -- Versioning for Quack and Claude Code
5. **Marketplace Metadata** -- For discovery and filtering
