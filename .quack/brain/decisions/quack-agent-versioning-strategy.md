---
type: decision
project: quack-app
created: 2026-01-10
migrated: true
---

# Quack Agent Versioning Strategy

## Versioning Strategy per Agent Bundles

### Semantic Versioning (SemVer)

Ogni bundle usa versioning semantico:
- **MAJOR** (1.x.x): Breaking changes (rimozione skills, cambio struttura)
- **MINOR** (x.1.x): Nuove features (nuovi droids, skills aggiunte)
- **PATCH** (x.x.1): Bug fixes, miglioramenti testo

### Update Flow

```
1. User ha installato agent-charlie@1.0.0
2. Author pubblica agent-charlie@1.1.0 (nuova skill)
3. Quack mostra notifica: 'Update disponibile'
4. User sceglie:
   - Update automatico (installa nuova versione)
   - Review changes (vedi diff)
   - Skip (rimani su versione attuale)
   - Pin version (mai aggiornare automaticamente)
```

### Conflict Resolution

Quando un bundle vuole installare una skill che esiste già:

1. **Same ID, Same Content** → Skip (già installata)
2. **Same ID, Different Content** → Prompt user:
   - Keep existing
   - Replace with bundle version
   - Rename bundle version (skill-name-v2)
3. **Different ID** → Install normalmente

### Dependency Management

```json
{
  "dependencies": {
    "skills": {
      "code-review": ">=1.0.0",
      "test-automation": "^2.0.0"
    }
  }
}
```

### Rollback Support

Quack mantiene backup delle versioni precedenti:
- `~/.quack/bundles/agent-charlie/1.0.0/`
- `~/.quack/bundles/agent-charlie/1.1.0/`

User può fare rollback da Settings > Installed Agents > agent-charlie > Version History

[2026-01-10] Tag: #quack-bundles - Strategia versioning SemVer

[2026-01-10] Moved to quack-bundles/ folder for better organization
