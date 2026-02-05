---
type: pattern
project: quack-app
created: 2026-01-10
migrated: true
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
  "author": {
    "name": "Alek Dobrohotov",
    "github": "alekdob",
    "email": "alek@quack.dev"
  },
  "license": "MIT",
  "repository": "https://github.com/quack-marketplace/agent-charlie",
  
  "personality": {
    "role": "Senior Code Reviewer & Quality Engineer",
    "class": "reviewer",
    "communicationStyle": "professional",
    "quirks": "Says 'quack check' when reviewing code",
    "avatar": "assets/charlie.png",
    "color": "#9333EA"
  },
  
  "equipment": {
    "skills": [
      { "id": "code-review", "required": true },
      { "id": "test-automation", "required": false }
    ],
    "droids": [
      { "id": "test-runner", "required": true }
    ],
    "rules": [
      { "id": "typescript-strict", "required": true },
      { "id": "security-first", "required": false }
    ],
    "commands": [
      { "id": "review-pr", "required": true }
    ]
  },
  
  "stats": {
    "level": 5,
    "xp": 2500,
    "skillPoints": 3,
    "droidSlots": 2
  },
  
  "compatibility": {
    "quackVersion": ">=1.0.0",
    "claudeCodeVersion": ">=0.2.0"
  },
  
  "marketplace": {
    "category": "code-quality",
    "tags": ["review", "typescript", "testing"],
    "featured": false,
    "verified": true,
    "downloads": 1234
  }
}
```

## Key Design Decisions

1. **Semantic Versioning** - Standard semver per updates
2. **Equipment System** - Skills/Droids/Rules come 'equipaggiamento' RPG
3. **Stats System** - Level/XP per gamification
4. **Compatibility Matrix** - Versioning per Quack e Claude Code
5. **Marketplace Metadata** - Per discovery e filtering

[2026-01-10] Tag: #quack-bundles - Schema manifest.json per bundle

[2026-01-10] Moved to quack-bundles/ folder for better organization
