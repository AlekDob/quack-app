---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React 18)
created: 2026-05-26
last_verified: 2026-05-26
tags: [changes-panel, attribution, multi-agent, avatars, pending-tab]
---

## Changes Panel — Agent Attribution
**Purpose:** Mostra avatar + nome dell'agente (o degli agenti) che ha modificato ogni file pending nel Changes panel, così l'utente capisce a colpo d'occhio chi ha toccato cosa. Supporta multi-agent: se più sessioni nello stesso progetto hanno editato lo stesso file, mostra avatar stacked.
**Stack:** React 18, Zustand, TypeScript

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Store | `src/stores/fileAttributionStore.ts` | Zustand store `useFileAttributionStore`: `Map<absPath, Map<sessionId, Entry>>` con `recordEdits`, `clearForSession`, selector `getAttributions(absPath)` |
| Component | `src/components/FileAttributionAvatars.tsx` | Renderizza stack di avatar (max 3 + overflow `+N`) con tooltip "agentName · NN edits" |
| Component | `src/components/FileRow.tsx` | Integra `<FileAttributionAvatars>`; row click → `onOpenDiff` (apre `DiffDrawer`) invece di toggle inline |
| Component | `src/components/ChatView.tsx` | useEffect chiama `recordEdits(sessionInfo, allFileEdits)` ad ogni cambio di edits |
| Component | `src/components/PendingTab.tsx` | Pipa `onOpenDiff` (e `rootPath` per abs path) al FileRow |
| Component | `src/components/ChangesPanel.tsx` + `src/components/SidePanelAccordion.tsx` | Catena prop `onOpenDiff?: (filePath, status) => void` da App fino al FileRow |
| Component | `src/components/DiffDrawer.tsx` | Header "commento" con avatar+nome+editCount+relTime per ogni session che ha modificato il file. Legge `useFileAttributionStore.byPath` con abs path ricostruito da `selected.path` + nuovo prop `rootPath` |
| Style | `src/components/ChangesPanel.css` | Classi `.changes-file-avatars`, `.changes-file-avatar`, `.changes-file-avatars-more` |
| Style | `src/components/DiffDrawer.css` | Classi `.diff-drawer-attribution*` per il blocco commento in cima al diff |

### Data Flow
```
[ChatView (per session)] --> scanMessagesForEdits(messages) --> allFileEdits[]
[ChatView useEffect] --> useFileAttributionStore.recordEdits({sessionId, agentId, agentName, agentAvatar}, allFileEdits)
[Store] --> byPath: Map<absPath, Map<sessionId, {agentId, agentName, agentAvatar, lastTs, editCount}>>
[FileRow] --> useFileAttributionStore.getAttributions(absPath) --> AttributionEntry[]
[FileAttributionAvatars] --> stack avatars (max 3) + "+N" overflow + tooltip

[FileRow click] --> onOpenDiff(absPath, status)
                --> App.handleDiffClick --> setShowDiffDrawer(true) + git_diff
[DiffDrawer] --> riceve rootPath + selected (relative path)
            --> ricostruisce absPath --> store.byPath.get(absPath)
            --> render <AttributionComments> (commento in cima al diff)
```

### Key Functions
- `useFileAttributionStore.recordEdits(session: {id, agentId, agentName, agentAvatar}, edits: {filePath, editCount}[])` — replace tutte le entries di quella session per la lista corrente di edits. Pull-model: il chiamante invia lo stato corrente, lo store sostituisce.
- `useFileAttributionStore.clearForSession(sessionId)` — rimuove tutte le entries di una session (chiamato quando una session viene cancellata).
- `useFileAttributionStore.getAttributions(absPath) --> AttributionEntry[]` — restituisce la lista ordinata per `lastTs DESC`.

### State
- `byPath`: `Map<string, Map<string, AttributionEntry>>` — outer key = absolute file path, inner key = sessionId, value = `{agentId, agentName, agentAvatar?, lastTs, editCount}`. Inner map serve a deduplicare per sessione (un agente che ha editato 5 volte → 1 entry, non 5).

### Multi-Agent Handling
- **Stessa session, N edit dello stesso file** → 1 entry, `editCount` incrementato.
- **N session diverse stessa filePath** → N entries, mostrate come avatar stacked.
- **Stesso agent in 2 session diverse** → 2 entries (sessione è la chiave) ma in UI possiamo aggregare per agentId nel componente avatar — scelta iniziale: NO aggregazione, mostriamo per session (più trasparente: 2 puntini = 2 lavori paralleli).

### Limitations (documented, accepted)
- **Attribution solo per session caricate in chatStore** (sessione mai aperta in questa run di Quack → no avatar). Fallback: nessun avatar = "modificato fuori Quack o non ancora osservato".
- **Modifiche fatte a mano** (editor esterno, terminal `vim`) → no attribution. Tooltip nel componente vuoto: "Modified outside Quack".
- **Bash `rm`** → tracciato come `FileDeleted`, ma non passa per `recordEdits` (sono edits, non delete). Scope iniziale: solo Edit/Write. Estendibile.

### Path Normalization
- Lo store usa `filePath` così come arriva da Edit/Write (sempre absolute path da Claude SDK).
- Git status entries hanno `entry.path` relativo a `rootPath`. Il `FileRow` riceve già `toAbsolute(rootPath, entry.path)` come `filePath` → match diretto con lo store.

### Performance
- `recordEdits` fa 1 set Zustand per cambio messaggi (già throttled da `useMemo` su `messages` in ChatView).
- `getAttributions` è un lookup O(1) + iterazione su mappa interna piccola (<10 sessioni di solito).
- Render: max 3 avatar (24px) per riga, lazy-loaded `<img>`.

### Visual Design
- Avatars: 18×18px circolari, border 1px `rgba(255,255,255,0.15)`, overlap `-6px` (stack a sinistra).
- Tooltip nativo `title="{agentName} · {editCount} edits · {relativeTime}"`.
- Posizione: tra `.changes-file-dir` e `.changes-file-actions`.
- "+N" badge: stessa shape avatar, sfondo `var(--bg-hover)`, font 10px.

### Config
- `MAX_VISIBLE_AVATARS = 3` (costante in `FileAttributionAvatars.tsx`).
