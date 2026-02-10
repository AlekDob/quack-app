---
type: pattern
project: quack-app
created: 2026-01-10
migrated: true
---

# store-caching-pattern

[2026-01-10] Pattern per cachare istanze Tauri Store ed evitare letture disco ripetute

Problema: Store.load('quack-chats.json') chiamato ad ogni task switch (~100-200ms)

Soluzione: getCachedStore() a livello modulo con Map<string, Promise<Store>>

La Promise viene cachata, non il risultato - evita race conditions

Riuso: applicabile a tutti i file Store (settings, sessions, etc.)

File: App.tsx - sezione cache stores
