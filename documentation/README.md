# Conocimiento del proyecto (Pinky Brain)

Los `.md` de esta carpeta son la **fuente de verdad** del conocimiento del
proyecto (gotchas, patrones, decisiones, diary). `pinky` los indexa en
`brain.db` (derivado y desechable) para búsqueda híbrida.

Cada `.md` lleva frontmatter YAML:

```yaml
---
type: gotcha            # gotcha | pattern | decision | diary | guide | note
project: <proyecto>
created: YYYY-MM-DD
last_verified: YYYY-MM-DD
tags: [tag1, tag2]
---
# Título
```

Reindexá tras crear/editar: `pinky reindex documentation`.
