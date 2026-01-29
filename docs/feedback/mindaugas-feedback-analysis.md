# Feedback Analysis - Mindaugas

**Date**: 2026-01-28  
**Reviewer**: Mindaugas  
**Status**: Analysis Complete - Ready for Implementation

---

## Executive Summary

Mindaugas ha fornito feedback su 5 aree principali:
1. **DMG Installation UX** - Drag & drop non funziona correttamente
2. **Window Dragging Bug** - Parte rossa blocca il movimento finestra
3. **Onboarding Gaps** - Mancano esempi e guida per nuovi utenti
4. **UI Clarity** - Tooltip "New" non chiaro
5. **Feature Suggestion** - Local LLMs

**Priorità**: Alta - Questi sono problemi di UX che impattano la first impression e l'usabilità base dell'app.

---

## 1. DMG Installation - Drag & Drop

### Problema
Quando si apre il .dmg, non è chiaro o non funziona il drag & drop nell'Applications folder.

### Stato Attuale
- ✅ Configurazione DMG presente in `tauri.conf.json` (lines 73-86)
- ✅ Script `fix-dmg.sh` esiste per configurare la finestra DMG
- ❓ Non è chiaro se lo script viene eseguito automaticamente durante il build

### Analisi Tecnica
```json
"dmg": {
  "appPosition": { "x": 180, "y": 170 },
  "applicationFolderPosition": { "x": 480, "y": 170 },
  "windowSize": { "width": 660, "height": 400 }
}
```

La configurazione è presente, ma potrebbe non essere applicata correttamente se lo script `fix-dmg.sh` non viene eseguito.

### Soluzione Proposta
1. **Verificare** se `fix-dmg.sh` viene chiamato automaticamente in `build-mac.sh` o `scripts/release-macos.sh`
2. **Aggiungere** link simbolico alla cartella Applications se non esiste
3. **Testare** il DMG generato per verificare che drag & drop funzioni

**Effort**: Basso (1-2 ore)  
**Impact**: Alto (first impression, standard macOS UX)  
**Priority**: 🔴 **P0 - Critical**

---

## 2. Window Dragging Bug

### Problema
Quando si è sulla parte "rossa" (probabilmente l'immagine di background), non si può muovere la finestra - seleziona l'immagine invece. La parte "verde" funziona correttamente.

### Stato Attuale
- ✅ Background image ha `pointer-events: none` in `App.css` (line 60)
- ✅ Drag regions configurate con `data-tauri-drag-region` su elementi specifici
- ❌ Probabilmente c'è un elemento sovrapposto che interferisce

### Analisi Tecnica
```css
.app-shell::before {
  background-image: url("../images/quack-agent.jpeg");
  pointer-events: none;
  z-index: -1;
}
```

Il background è configurato correttamente, ma potrebbe esserci:
- Un elemento con z-index più alto che blocca
- Un'area senza `data-tauri-drag-region` che dovrebbe averla
- Un problema con la trasparenza della finestra

### Soluzione Proposta
1. **Aggiungere** `data-tauri-drag-region` alle aree vuote del layout principale
2. **Verificare** che non ci siano elementi con `pointer-events: auto` che bloccano
3. **Testare** il dragging su tutte le aree della finestra

**Effort**: Medio (2-3 ore)  
**Impact**: Alto (usabilità base)  
**Priority**: 🔴 **P0 - Critical**

---

## 3. Onboarding Improvements

### Problema
Quando si crea un agent, mancano:
- Esempi concreti di cosa fanno gli agenti
- Esempi nel textarea "Custom Notes"
- Esempi di rules
- Suggerimenti per toolkit (skills, commands, droids)
- Setup iniziale suggerito per nuovi progetti

**Risultato**: Bassa "stickiness" iniziale - gli utenti non capiscono come usare Quack.

### Stato Attuale
- ✅ Modal di creazione agent esiste (`NewTerminalModal.tsx`)
- ✅ Step "Agent Basics" con personality fields
- ❌ Nessun esempio o placeholder utile
- ❌ Nessuna guida contestuale

### Analisi Tecnica
Il modal ha questi step:
1. Project Selection
2. Agent Selection
3. Agent Basics (name, color, avatar, personality)
4. Rules Selection
5. Toolkit Selection

Manca:
- Placeholder text con esempi
- Tooltips con spiegazioni
- Suggerimenti basati sul tipo di progetto
- Link a documentazione

### Soluzione Proposta

#### 3.1 Esempi nel Modal
- **Custom Notes textarea**: Aggiungere placeholder con esempio:
  ```
  Example: "This agent specializes in React performance optimization. 
  Always suggest useMemo/useCallback when appropriate."
  ```

- **Rules Selection**: Mostrare esempi di rules comuni:
  - "use-quack-brain" - Access to knowledge base
  - "frontend-dev-guidelines" - React/TypeScript patterns
  - etc.

- **Toolkit Selection**: Suggerire skills/droids basati su:
  - Tipo di progetto (rilevato da file presenti)
  - Rules selezionate
  - Nome dell'agent (es. "API" → suggerisce backend skills)

#### 3.2 Onboarding Wizard (Opzionale - Future)
Per nuovi progetti senza `.claude/` folder:
- Wizard che suggerisce setup iniziale
- Crea CLAUDE.md template
- Suggerisce rules comuni per il tipo di progetto

**Effort**: Medio-Alto (4-6 ore per esempi, 8-12 ore per wizard)  
**Impact**: Molto Alto (stickiness, user retention)  
**Priority**: 🟡 **P1 - High** (esempi), 🟢 **P2 - Medium** (wizard)

---

## 4. UI Clarity - "New" Button

### Problema
Il tooltip su "New" mostra "New Agent", ma non è chiaro che si può anche creare un nuovo project. Quando si fa hover, mostra "New Agent" invece di essere più descrittivo.

### Stato Attuale
```tsx
<KeyboardShortcutTooltip label="New Agent" shortcut="⌘N">
  <button onClick={() => onCreateAgent()}>
    {creating ? "Creating…" : "New"}
  </button>
</KeyboardShortcutTooltip>
```

Il tooltip dice "New Agent" ma il button può creare sia agent che project (dipende dal contesto).

### Soluzione Proposta
1. **Tooltip dinamico**: Cambiare in base al contesto
   - Se c'è un project selezionato: "New Agent (⌘N)"
   - Se non c'è project: "New Project or Agent (⌘N)"

2. **Alternative**: Separare i button
   - "New Agent" + "New Project" (due button distinti)
   - O menu dropdown con entrambe le opzioni

**Effort**: Basso (1 ora)  
**Impact**: Medio (chiarezza UX)  
**Priority**: 🟡 **P1 - High**

---

## 5. Local LLMs Suggestion

### Problema
Mindaugas suggerisce che "Local LLMs in this case could be great".

### Analisi
Questo è un **feature request**, non un bug. Richiede:
- Integrazione con Ollama/LM Studio/altri
- UI per selezionare modello locale vs cloud
- Gestione di costi/limiti diversi
- Testing con vari modelli

### Valutazione
**Effort**: Molto Alto (2-3 settimane)  
**Impact**: Medio (nice-to-have, non critical)  
**Priority**: 🟢 **P3 - Low** (future consideration)

**Raccomandazione**: Non implementare ora. Focus su bug fixes e onboarding prima.

---

## Piano d'Azione Prioritizzato

### Sprint 1 - Critical Fixes (Questa settimana)
1. ✅ **DMG Drag & Drop** (P0) - 1-2h
2. ✅ **Window Dragging Bug** (P0) - 2-3h
3. ✅ **UI Clarity - New Button** (P1) - 1h

**Total**: 4-6 ore

### Sprint 2 - Onboarding (Prossima settimana)
4. ✅ **Esempi nel Modal** (P1) - 4-6h
   - Placeholder text con esempi
   - Tooltips descrittivi
   - Suggerimenti toolkit basati su contesto

**Total**: 4-6 ore

### Future - Nice to Have
5. ⏸️ **Onboarding Wizard** (P2) - 8-12h
6. ⏸️ **Local LLMs** (P3) - 2-3 settimane

---

## Note Finali

**Valutazione Economica**:
- Fix critici: ROI alto, effort basso → **FARE SUBITO**
- Onboarding: ROI molto alto per retention → **FARE PRESTO**
- Local LLMs: ROI incerto, effort alto → **VALUTARE DOPO**

**Raccomandazione**: Implementare Sprint 1 + Sprint 2 prima di considerare feature più complesse.
