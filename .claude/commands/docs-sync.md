---
name: docs-sync
description: Sincronizza le modifiche alla documentazione Quack con quack-docs e deploya su quack.build
arguments:
  - name: message
    description: Messaggio di commit per le modifiche alla documentazione
    required: true
---

Usa la skill **quack-docs-sync** per sincronizzare la documentazione.

## AZIONE: Sincronizza e Deploya Docs

### 1. Verifica Modifiche
Prima controlla se ci sono modifiche nel submodule docs/guide:

```bash
cd /Users/alekdob/Desktop/Dev/Personal/quack-app/docs/guide
git status
```

Se non ci sono modifiche, avvisa l'utente e fermati.

### 2. Commit e Push a quack-docs
Committa le modifiche al submodule quack-docs:

```bash
cd /Users/alekdob/Desktop/Dev/Personal/quack-app/docs/guide
git add .
git commit -m "docs: $ARGUMENTS"
git push origin main
```

### 3. Aggiorna Riferimento in quack-app
Aggiorna il riferimento del submodule nel progetto principale:

```bash
cd /Users/alekdob/Desktop/Dev/Personal/quack-app
git add docs/guide
git commit -m "docs: update quack-docs submodule - $ARGUMENTS"
```

### 4. Sincronizza con quackagency-website
Pull le modifiche nel sito web e deploya su Vercel:

```bash
cd /Users/alekdob/Desktop/Dev/Personal/quackagency-website/docs/guide
git pull origin main
cd ../..
git add docs/guide
git commit -m "docs: sync quack-docs - $ARGUMENTS"
git push origin main
```

### 5. Output Finale
Mostra all'utente:
- Commit hash in quack-docs
- Commit hash in quack-app
- Commit hash in quackagency-website
- Link: https://quack.build/docs (deploy in 30-60 secondi)

## Workflow Completo (Esegui in sequenza)

```bash
# Step 1: Commit to quack-docs submodule
cd /Users/alekdob/Desktop/Dev/Personal/quack-app/docs/guide && git add . && git commit -m "docs: $ARGUMENTS" && git push origin main

# Step 2: Update quack-app reference
cd /Users/alekdob/Desktop/Dev/Personal/quack-app && git add docs/guide && git commit -m "docs: update quack-docs submodule"

# Step 3: Sync to website and deploy
cd /Users/alekdob/Desktop/Dev/Personal/quackagency-website/docs/guide && git pull origin main && cd ../.. && git add docs/guide && git commit -m "docs: sync quack-docs submodule" && git push origin main
```

## Note
- Il push a `quackagency-website` triggera automaticamente il deploy su Vercel
- Le modifiche saranno live su https://quack.build/docs in 30-60 secondi
- Il webhook Vercel è configurato ma richiede comunque l'aggiornamento manuale del submodule
