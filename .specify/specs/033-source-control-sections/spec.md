# Feature Specification: Source Control Sections (Branches, Worktrees, Remotes)

**Feature Branch**: `033-source-control-sections`
**Created**: 2026-04-04
**Status**: Draft
**Input**: Espandere il Changes Panel con sezioni sub-accordion per Branches, Worktrees e Remotes (stile VS Code Source Control).

## User Scenarios & Testing

### User Story 1 - Visualizzare e gestire branches dal pannello Changes (Priority: P1)

L'utente apre il pannello Changes e vede una sezione collassabile "Branches" sotto i tab esistenti (Pending/Committed/History). Espandendola, vede la lista dei branch locali con indicazione del branch corrente, e puo switchare, creare o eliminare un branch direttamente dal sidebar senza aprire un componente separato.

**Why this priority**: I branch sono l'operazione git piu frequente. Il BranchManager.tsx esiste gia ma e' standalone — integrarlo nel Changes Panel centralizza il workflow source control.

**Independent Test**: Aprire Changes Panel, espandere sezione Branches, verificare lista branch corretta, switchare branch e confermare il cambio nel context bar.

**Acceptance Scenarios**:

1. **Given** un repo con 3 branch, **When** espando la sezione Branches, **Then** vedo tutti e 3 i branch con asterisco sul corrente
2. **Given** la sezione Branches espansa, **When** clicco su un branch diverso, **Then** il branch viene switchato e il context bar si aggiorna
3. **Given** la sezione Branches espansa, **When** clicco "+" per creare un branch, **Then** un input inline appare e posso creare il branch
4. **Given** un branch non-corrente, **When** clicco delete, **Then** il branch viene eliminato con conferma

---

### User Story 2 - Visualizzare worktrees attivi (Priority: P2)

L'utente vede una sezione "Worktrees" collassabile nel pannello Changes. Mostra la lista dei worktree attivi con path, branch associato e stato. Puo creare un nuovo worktree o rimuoverne uno esistente.

**Why this priority**: I worktree sono utili per lavoro parallelo con agenti. Quack li usa internamente (Claude Code crea worktree per subagent). Visibilita sullo stato dei worktree e' importante.

**Independent Test**: Con almeno un worktree attivo, aprire la sezione Worktrees e verificare che lista path, branch e hash correttamente.

**Acceptance Scenarios**:

1. **Given** un repo con 2 worktree, **When** espando la sezione Worktrees, **Then** vedo entrambi con path e branch
2. **Given** la sezione Worktrees espansa, **When** clicco "+" per aggiungere, **Then** una modale chiede path e branch per il nuovo worktree
3. **Given** un worktree non-bare, **When** clicco rimuovi, **Then** il worktree viene rimosso con conferma

---

### User Story 3 - Visualizzare remotes configurati (Priority: P3)

L'utente vede una sezione "Remotes" collassabile che mostra i remote configurati con nome e URL. Azioni base: visualizzazione della lista, nessun CRUD avanzato nella v1.

**Why this priority**: I remotes cambiano raramente. La visibilita e' utile per orientarsi nel repo ma non richiede interattivita avanzata.

**Independent Test**: In un repo con remote "origin", aprire la sezione Remotes e verificare che mostra nome e URL.

**Acceptance Scenarios**:

1. **Given** un repo con remote "origin", **When** espando la sezione Remotes, **Then** vedo "origin" con URL fetch/push
2. **Given** un repo senza remote, **When** espando la sezione Remotes, **Then** vedo "Nessun remote configurato"

---

### Edge Cases

- Cosa succede se l'utente e' in un worktree (non nel repo principale)? I branch e remotes devono comunque funzionare.
- Cosa succede se `git_list_branches` fallisce (repo corrotto)? Mostrare errore inline, non crashare.
- Cosa succede durante un merge in corso? La sezione branches deve indicarlo.
- Cosa succede se il rootPath e' null (nessun progetto aperto)? Sezioni disabilitate con messaggio.

## Clarifications

### Q1: Dove posizionare le nuove sezioni?

**Context**: Il layout determina l'intera architettura del componente.
**Answer**: Come tab aggiuntivi accanto a Pending/Committed/History. Il pannello avra 6 tab: `Pending | Committed | History | Branches | Worktrees | Remotes`.

### Q2: Ordine delle sezioni?

**Context**: L'ordine riflette la frequenza d'uso.
**Answer**: Branches > Worktrees > Remotes (dopo History).

### Q3: Filtri branch nella versione embedded?

**Context**: BranchManager.tsx ha filtri (All, Current, Agent Branches, With Remote).
**Answer**: Solo lista semplice, niente filtri. Azioni su hover/click.

## Requirements

### Functional Requirements

- **FR-001**: Il pannello Changes DEVE avere 6 tab: Pending, Committed, History, Branches, Worktrees, Remotes
- **FR-002**: Ogni tab DEVE mostrare un badge con il conteggio degli elementi (es. "Branches 3")
- **FR-003**: La sezione Branches DEVE riutilizzare la logica di BranchManager.tsx adattata per rendering embedded
- **FR-004**: La sezione Branches DEVE supportare: visualizzare lista, switchare branch, creare branch, eliminare branch
- **FR-005**: La sezione Worktrees DEVE mostrare path, branch e commit hash per ogni worktree
- **FR-006**: La sezione Worktrees DEVE supportare: creare e rimuovere worktree
- **FR-007**: La sezione Remotes DEVE mostrare nome e URL per ogni remote configurato
- **FR-008**: Il backend Rust DEVE implementare `git_list_remotes` per la sezione Remotes
- **FR-009**: Ogni sezione DEVE gestire errori gracefully con messaggio inline
- **FR-010**: Le sezioni DEVONO aggiornarsi quando il branch cambia (via reconcileWithGit o focus event)

### Key Entities

- **GitBranch**: name, is_current, has_remote, upstream, behind (gia definito in Rust)
- **GitWorktree**: path, branch, commit_hash, is_bare, is_detached (gia definito in Rust)
- **GitRemote**: name, fetch_url, push_url (da definire — nuovo struct Rust)

## Success Criteria

### Measurable Outcomes

- **SC-001**: L'utente puo visualizzare branches, worktrees e remotes senza uscire dal pannello Changes
- **SC-002**: Lo switch di branch dal pannello funziona e aggiorna tutto il contesto (context bar, pending changes, history)
- **SC-003**: Le sezioni si caricano in < 500ms per repo con < 50 branch
- **SC-004**: Nessun crash o errore non gestito quando le operazioni git falliscono
- **SC-005**: Il file ChangesPanel.tsx resta sotto 300 righe grazie all'estrazione dei sub-componenti
