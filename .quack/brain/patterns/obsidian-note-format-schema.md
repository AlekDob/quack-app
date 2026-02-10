---
type: pattern
project: quack-app
created: 2026-01-08
migrated: true
---

# Obsidian Note Format Schema

Formato nota standard per Quack Brain → Obsidian sync

FRONTMATTER (YAML): id (UUID), project (opzionale), file (source path opzionale), date (WikiLink [[YYYY-MM-DD]]), author (agent-name), status (active|deprecated|draft|archived), confidence (high|medium|low), aliases (lista opzionale)

BODY inizia con #tag (es: #idea, #component, #pattern)

Se project-scoped: **Project:** [[project-name]] dopo il tag

NO H1 - Obsidian usa il filename come titolo

Sezione ## Observations con bullet list delle osservazioni

WikiLinks [[NoteName]] per collegamenti ad altre note

Esempio completo: ---\nid: "uuid"\nproject: quack-app\ndate: "[[2026-01-08]]"\nauthor: agent-jack\nstatus: active\nconfidence: high\n---\n\n#component\n\n**Project:** [[quack-app]]\n\n## Observations\n\n- Prima osservazione
