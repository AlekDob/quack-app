---
type: decision
created: 2026-01-10
tags: [marketplace, git, architecture, agent-bundles]
---

# Quack Marketplace Git Architecture

## Git-Based Marketplace Architecture

### Repository: github.com/quack-marketplace

**Perche Git-based:**
1. **Community-driven** - Chiunque puo contribuire via PR
2. **Versionato** - Ogni modifica e tracciata
3. **Decentralizzato** - Fork e customizzazioni possibili
4. **CI/CD ready** - Validazione automatica dei bundle
5. **Free hosting** - GitHub/GitLab gratis

### Repository Structure

```
quack-marketplace/
|-- agents/                    # Full agent bundles
|   |-- agent-charlie/
|   |   |-- manifest.json
|   |   |-- personality/
|   |   |-- skills/
|   |   |-- droids/
|   |   |-- rules/
|   |   +-- assets/
|   +-- agent-magnus/
|
|-- skills/                    # Standalone skills
|   |-- code-review/
|   |   |-- manifest.json
|   |   +-- skill.md
|   +-- test-automation/
|
|-- droids/                    # Standalone droids
|   |-- test-runner/
|   +-- doc-writer/
|
|-- rules/                     # Standalone rules
|   +-- typescript-strict/
|
|-- stacks/                    # Curated combinations
|   +-- frontend-dev-stack/
|
|-- registry.json              # Index of all resources
+-- CONTRIBUTING.md            # How to contribute
```

### registry.json Schema

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-01-10T12:00:00Z",
  "resources": {
    "agents": [
      {
        "id": "agent-charlie",
        "path": "agents/agent-charlie",
        "version": "1.0.0",
        "verified": true,
        "downloads": 1234
      }
    ],
    "skills": [...],
    "droids": [...],
    "rules": [...],
    "stacks": [...]
  }
}
```

### Contribution Flow

1. Fork `quack-marketplace`
2. Create folder in appropriate category
3. Add `manifest.json` + content files
4. Submit Pull Request
5. CI validates bundle structure
6. Maintainers review
7. Merge = Available in Quack!

### Quack App Sync

```
Quack App Boot
    |
    v
Check ~/.quack/marketplace-cache.json
    |
    v
If stale (>1h) or missing:
  Fetch raw.githubusercontent.com/.../registry.json
    |
    v
Parse and display in Marketplace UI
    |
    v
User clicks 'Install'
    |
    v
Download bundle files via GitHub raw URLs
    |
    v
Extract to ~/.claude/ (skills, droids, rules, commands)
    |
    v
Update ~/.quack/installed.json
```

### Verification System

- **Unverified**: Anyone can submit
- **Verified**: Reviewed by maintainers, marked with badge
- **Featured**: Highlighted in UI, curated weekly
- **Official**: Made by Quack team

[2026-01-10] Tag: #quack-bundles - Architettura marketplace Git-based

[2026-01-10] Moved to quack-bundles/ folder for better organization
