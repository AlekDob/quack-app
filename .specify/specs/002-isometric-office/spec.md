# Feature Specification: Isometric Office View

**Feature Branch**: `002-isometric-office`
**Created**: 2026-03-03
**Status**: Implemented
**Input**: User description: "Vista isometrica dei miei progetti dove ogni progetto e' una stanza dell'ufficio e dentro ci sono le papere a lavorare"

## User Scenarios & Testing

### User Story 1 - Aprire la vista Office (Priority: P1)

L'utente vuole visualizzare tutti i suoi progetti e agenti in un'unica vista isometrica, come un ufficio virtuale dove ogni progetto e' una stanza.

**Why this priority**: E' la funzionalita' core — senza la vista, nulla funziona.

**Independent Test**: Click sull'icona Office nella barra → si apre la vista isometrica a pieno schermo con sidebar nascosta.

**Acceptance Scenarios**:

1. **Given** l'utente ha agenti attivi su diversi progetti, **When** clicca l'icona Office, **Then** si apre una tab "Office" con una scena isometrica contenente una stanza per ogni progetto
2. **Given** la vista Office e' aperta, **When** clicca "Torna alla Chat", **Then** torna alla vista chat con sidebar visibile

---

### User Story 2 - Visualizzare stato agenti come duck animate (Priority: P1)

Ogni agente appare come una papera animata nella stanza del suo progetto. L'animazione riflette lo stato: typing (busy), thinking (waiting), breathing (idle).

**Why this priority**: La visualizzazione animata dello stato e' il cuore dell'esperienza.

**Independent Test**: Con agenti in diversi stati, verificare che i duck abbiano animazioni diverse.

**Acceptance Scenarios**:

1. **Given** un agente e' busy, **When** guardo il suo duck, **Then** ha un bobbing rapido e particelle di typing
2. **Given** un agente e' idle, **When** guardo il suo duck, **Then** ha un leggero effetto "respiro"
3. **Given** un agente cambia status da idle a busy, **When** guardo l'ufficio, **Then** l'animazione del duck cambia in tempo reale

---

### User Story 3 - Navigare e interagire (Priority: P2)

L'utente puo' zoomare e pannare la mappa, vedere tooltip sugli agenti, e navigare ai progetti/chat.

**Why this priority**: L'interattivita' rende la vista utile, non solo bella.

**Independent Test**: Zoom con scroll wheel, hover su duck mostra tooltip, click su stanza naviga al progetto.

**Acceptance Scenarios**:

1. **Given** la vista e' aperta, **When** scroll con la rotella, **Then** la mappa zooma in/out (0.3-2.0x)
2. **Given** la vista e' aperta, **When** hover su un duck, **Then** appare tooltip con nome, status e task corrente
3. **Given** la vista e' aperta, **When** click su una stanza, **Then** naviga alla chat del primo agente di quel progetto
4. **Given** la vista e' aperta, **When** click su un duck, **Then** appare menu con "Vai alla Chat"

### Edge Cases

- Nessun agente attivo → la vista mostra solo il canvas vuoto con header
- Agente senza progetto (cwd vuoto) → raggruppato sotto "unknown"
- Molti progetti (>10) → la griglia si espande automaticamente con righe aggiuntive

## Requirements

### Functional Requirements

- **FR-001**: Sistema DEVE mostrare una stanza isometrica per ogni progetto attivo
- **FR-002**: Sistema DEVE mostrare un duck animato per ogni agente nella stanza del suo progetto
- **FR-003**: Duck DEVONO animarsi in base allo status dell'agente (busy/idle/waiting)
- **FR-004**: Utente DEVE poter zoomare (0.3x-2.0x) e pannare la mappa
- **FR-005**: Utente DEVE vedere tooltip con dettagli agente su hover
- **FR-006**: Click su stanza DEVE navigare al progetto
- **FR-007**: Click su duck DEVE mostrare menu azione con "Vai alla Chat"
- **FR-008**: Vista DEVE aprirsi senza sidebar destra (come Kanban)

### Key Entities

- **Room**: Stanza isometrica rappresentante un progetto (projectPath, projectName, agents[])
- **Duck**: Rappresentazione visiva di un agente (TerminalInfo + animazione status-driven)
- **Viewport**: Stato zoom/pan della mappa (zoom, panX, panY)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Build TypeScript compila senza errori
- **SC-002**: La vista si apre in <500ms dal click
- **SC-003**: Animazioni a 60fps con <=20 agenti
- **SC-004**: Zero nuovi Zustand store (derivazione da dati esistenti)
