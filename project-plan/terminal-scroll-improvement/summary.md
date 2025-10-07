# Terminal Scroll Improvement - Smart Auto-Scroll System

**Status**: 📋 Planning Complete - Ready for Implementation
**Created**: 2025-10-07
**Type**: Feature Enhancement
**Estimated Duration**: 1-1.5 giorni

## 🎯 Problema da Risolvere

Quando eseguo comandi che generano output massiccio (come `claude code`), il terminale sfarfalla continuamente cercando di auto-scrollare al bottom ogni 50ms. Questo rende **impossibile scrollare manualmente verso l'alto** per leggere l'output precedente, perché il terminale ti riporta forzatamente giù.

### Comportamento Attuale (Buggy)
- Auto-scroll si attiva ogni 50ms se sei entro 5 righe dal fondo
- NON detecta se l'utente sta scrollando manualmente UP
- Output massiccio → sfarfallamento continuo
- UX frustrante durante comandi verbosi (Claude Code, npm install, logs, etc.)

### Comportamento Desiderato (Come Warp/iTerm2)
- Auto-scroll **solo se utente è già al fondo** (non ha scrollato UP)
- Se utente scrolla UP → **disabilita auto-scroll** automaticamente
- Badge "⬇ Scroll to bottom" visibile quando auto-scroll è off
- Click badge o scroll manuale al bottom → **ri-abilita auto-scroll**

## 🏗️ Architettura Tecnica

### File da Modificare: `src/components/TerminalView.tsx`

#### 1. Nuove Refs per Tracking Scroll State

```typescript
// Aggiungi dopo le refs esistenti (linea 32)
const autoScrollEnabledRef = useRef(new Map<string, boolean>()) // Per terminal: auto-scroll on/off
const userScrollPositionRef = useRef(new Map<string, number>())  // Ultima posizione scroll utente
```

**Spiegazione**:
- `autoScrollEnabledRef`: Traccia se auto-scroll è abilitato per ogni terminale (default: `true`)
- `userScrollPositionRef`: Memorizza l'ultima posizione di scroll per detectare gesture utente

#### 2. Funzione: Detectare User Scroll Gesture

```typescript
// Aggiungi dopo ensureTerminal (linea 191)
const handleUserScroll = useCallback((id: string, terminal: Terminal) => {
  const buffer = terminal.buffer.active
  const distanceFromBottom = buffer.baseY - buffer.viewportY

  // Se utente scrolla UP di più di 10 righe → disabilita auto-scroll
  if (distanceFromBottom > 10) {
    const wasEnabled = autoScrollEnabledRef.current.get(id) ?? true
    if (wasEnabled) {
      console.log(`[Scroll] Auto-scroll disabilitato per ${id} (distanza: ${distanceFromBottom})`)
      autoScrollEnabledRef.current.set(id, false)
    }
  }

  // Se utente torna entro 3 righe dal bottom → ri-abilita auto-scroll
  if (distanceFromBottom <= 3) {
    const wasDisabled = !(autoScrollEnabledRef.current.get(id) ?? true)
    if (wasDisabled) {
      console.log(`[Scroll] Auto-scroll ri-abilitato per ${id}`)
      autoScrollEnabledRef.current.set(id, true)
    }
  }

  // Memorizza posizione corrente
  userScrollPositionRef.current.set(id, buffer.viewportY)
}, [])
```

**Thresholds**:
- **Disabilita**: Distanza > 10 righe dal bottom (utente ha scrollato chiaramente UP)
- **Ri-abilita**: Distanza ≤ 3 righe (utente è tornato al fondo)
- **Perché 10 e 3?** Evita "flicker" - con soglie troppo vicine il sistema oscilla tra on/off

#### 3. Modificare Auto-Scroll Logic Esistente (linee 168-183)

**Prima (comportamento attuale)**:
```typescript
terminal.onWriteParsed(() => {
  if (scrollTimeout) return

  scrollTimeout = setTimeout(() => {
    const buffer = terminal.buffer.active
    const distanceFromBottom = buffer.baseY - buffer.viewportY

    // Auto-scroll se entro 5 righe dal bottom
    if (distanceFromBottom <= 5) {
      terminal.scrollToBottom()
    }
    scrollTimeout = null
  }, 50)
})
```

**Dopo (con smart scroll-lock)**:
```typescript
terminal.onWriteParsed(() => {
  if (scrollTimeout) return

  scrollTimeout = setTimeout(() => {
    // ⚠️ CHECK CRITICO: Solo se auto-scroll è abilitato!
    const autoScrollEnabled = autoScrollEnabledRef.current.get(id) ?? true
    if (!autoScrollEnabled) {
      scrollTimeout = null
      return // Skip auto-scroll se utente ha scrollato UP
    }

    const buffer = terminal.buffer.active
    const distanceFromBottom = buffer.baseY - buffer.viewportY

    // Auto-scroll solo se già vicino al bottom (≤ 5 righe)
    if (distanceFromBottom <= 5) {
      terminal.scrollToBottom()
    }
    scrollTimeout = null
  }, 50)
})
```

#### 4. Registrare Listener per User Scroll

```typescript
// Aggiungi dopo terminal.onData() in ensureTerminal (linea 166)
terminal.onScroll(() => {
  handleUserScroll(id, terminal)
})
```

**Cosa fa `terminal.onScroll()`?**
- Si attiva ogni volta che la viewport del terminale cambia posizione
- Include scroll da mouse wheel, trackpad, drag scrollbar
- **Non** si attiva per `scrollToBottom()` programmatico (perfetto!)

#### 5. Badge "Scroll to Bottom" (Opzionale ma Consigliato)

**Componente Badge in TerminalView**:
```typescript
// Aggiungi state per mostrare badge
const [scrollBadgeVisible, setScrollBadgeVisible] = useState<string | null>(null)

// Nel render, dopo il container (linea 450):
return (
  <div ref={containerRef} className="terminal-surface" style={{ overflow: 'hidden' }}>
    {scrollBadgeVisible === activeId && (
      <button
        className="scroll-to-bottom-badge"
        onClick={() => {
          const terminal = terminalMapRef.current.get(activeId)
          if (terminal) {
            terminal.scrollToBottom()
            autoScrollEnabledRef.current.set(activeId, true)
            setScrollBadgeVisible(null)
          }
        }}
      >
        ⬇ Scroll to bottom
      </button>
    )}
  </div>
)
```

**Styling CSS (App.css)**:
```css
.scroll-to-bottom-badge {
  position: absolute;
  bottom: 16px;
  right: 16px;
  z-index: 10;

  padding: 8px 16px;
  background: rgba(242, 140, 82, 0.9);
  border: 1px solid rgba(242, 140, 82, 0.3);
  border-radius: 8px;

  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
  cursor: pointer;

  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

.scroll-to-bottom-badge:hover {
  background: rgba(242, 140, 82, 1);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}
```

**Quando mostrare il badge?**
- Aggiorna state quando auto-scroll viene disabilitato
- Nascondi quando auto-scroll viene ri-abilitato
- Solo per terminale attivo (non per background terminals)

#### 6. Cleanup: Reset Scroll State alla Chiusura

```typescript
// Nel cleanup effect (linea 336), aggiungi:
Array.from(terminalMapRef.current.keys()).forEach((id) => {
  if (!validIds.has(id)) {
    // ... cleanup esistente ...

    // Nuovi cleanup per scroll state
    autoScrollEnabledRef.current.delete(id)
    userScrollPositionRef.current.delete(id)
  }
})
```

## 📋 Flow di Implementazione

### Fase 1: Core Scroll Detection (0.5 giorni)

**Obiettivi**:
1. ✅ Aggiungere refs per scroll state tracking
2. ✅ Implementare `handleUserScroll()` con thresholds (10 / 3 righe)
3. ✅ Registrare `terminal.onScroll()` listener
4. ✅ Modificare auto-scroll logic esistente con check `autoScrollEnabled`
5. ✅ Aggiungere logging per debug

**Testing**:
```bash
# Test 1: Scroll UP disabilita auto-scroll
1. Esegui comando verboso: `npm install --verbose`
2. Durante output, scrolla UP di ~15 righe con mouse wheel
3. ✅ Verifica: Auto-scroll si ferma (output continua ma viewport resta UP)
4. ✅ Console log: "[Scroll] Auto-scroll disabilitato per terminal-abc (distanza: 15)"

# Test 2: Scroll DOWN ri-abilita auto-scroll
1. Con auto-scroll disabilitato, scrolla manualmente verso il bottom
2. Quando sei entro 3 righe dal fondo
3. ✅ Verifica: Auto-scroll si riattiva (viewport torna a seguire output)
4. ✅ Console log: "[Scroll] Auto-scroll ri-abilitato per terminal-abc"

# Test 3: Output massiccio senza touch
1. Esegui `claude code` o `ls -laR /`
2. NON toccare scroll (resta al bottom)
3. ✅ Verifica: Auto-scroll continua normalmente (come prima)
```

### Fase 2: Badge UI "Scroll to Bottom" (0.5 giorni)

**Obiettivi**:
1. ✅ Aggiungere state `scrollBadgeVisible` per tracking badge
2. ✅ Mostrare badge quando `autoScrollEnabled = false` per active terminal
3. ✅ Click badge → `scrollToBottom()` + re-enable auto-scroll
4. ✅ Animazioni hover e transitions
5. ✅ CSS styling con accent color (orange `#f28c52`)

**Testing**:
```bash
# Test 1: Badge appare quando scrolli UP
1. Durante output massiccio, scrolla UP
2. ✅ Verifica: Badge "⬇ Scroll to bottom" appare in basso a destra
3. ✅ Badge ha sfondo arancione semi-trasparente con ombra

# Test 2: Click badge riporta al bottom
1. Con badge visibile, clicca il badge
2. ✅ Verifica: Viewport scrolla istantaneamente al fondo
3. ✅ Verifica: Auto-scroll si riattiva
4. ✅ Verifica: Badge scompare

# Test 3: Badge non appare per terminal in background
1. Apri 2 terminali (A e B)
2. Terminal A = attivo con auto-scroll disabilitato
3. Switcha a terminal B
4. ✅ Verifica: Badge NON appare su terminal B (anche se A è disabilitato)
```

### Fase 3: Edge Cases & Polish (0.5 giorni)

**Obiettivi**:
1. ✅ Cleanup scroll state quando terminale viene chiuso
2. ✅ Reset auto-scroll a `true` quando switchi terminali
3. ✅ Testare con terminali multipli in parallelo
4. ✅ Rimuovere logging debug (o rendere configurabile)
5. ✅ Update documentazione in CLAUDE.md

**Testing**:
```bash
# Test 1: Switch terminals preserva scroll state
1. Terminal A: Disabilita auto-scroll (scrolla UP)
2. Switch a Terminal B
3. Switch indietro a Terminal A
4. ✅ Verifica: Auto-scroll resta disabilitato in A (stato preservato)

# Test 2: Close terminal pulisce scroll state
1. Apri Terminal A, disabilita auto-scroll
2. Chiudi Terminal A
3. ✅ Verifica: Nessun memory leak (refs pulite)
4. ✅ Console: No errori su terminal ID inesistenti

# Test 3: Resize terminale non rompe scroll
1. Disabilita auto-scroll
2. Resize finestra app (cambia dimensioni terminale)
3. ✅ Verifica: Scroll state preservato (resta disabilitato)
4. ✅ Verifica: Badge resta visibile e funziona
```

## 🎯 Dettagli Tecnici: Thresholds Ottimali

### Perché 10 righe per disabilitare?
- **Troppo basso (es. 3)**: Ogni piccolo movimento accidentale disabilita auto-scroll → frustrante
- **Troppo alto (es. 50)**: Devi scrollare moltissimo prima che si disabiliti → lento a reagire
- **10 righe = sweet spot**: Chiaramente intenzionale ma non eccessivo

### Perché 3 righe per ri-abilitare?
- **Diverso da threshold disabilita**: Evita oscillazione (enable/disable/enable rapido)
- **3 righe = "sei tornato al bottom"**: Abbastanza vicino che output nuovo è visibile immediatamente
- **Hysteresis pattern**: Threshold diversi in/out prevengono flicker

### Perché 50ms di throttling resta OK?
- Con il check `autoScrollEnabled`, **solo i terminali con auto-scroll ON** eseguono `scrollToBottom()`
- Se auto-scroll è OFF, il throttling si skippa immediatamente → zero overhead
- 50ms è fluido per chi resta al bottom, ma non causa sfarfallamento per chi è UP

## 📊 Success Metrics

✅ **Funzionalità Core**:
- Scroll UP > 10 righe → auto-scroll si disabilita automaticamente
- Scroll DOWN a ≤ 3 righe dal bottom → auto-scroll si riabilita
- Output massiccio NON causa più sfarfallamento se utente scrolla UP

✅ **User Experience**:
- Badge "Scroll to bottom" appare quando auto-scroll è OFF
- Click badge riporta istantaneamente al fondo + riabilita auto-scroll
- Comportamento simile a Warp, iTerm2, VS Code integrated terminal

✅ **Performance**:
- Zero overhead se auto-scroll è disabilitato (skip throttling immediato)
- Nessun memory leak (cleanup refs alla chiusura terminali)
- Scroll gesture detection < 5ms (xterm.js `onScroll` è ottimizzato)

## 📦 Deliverables

✅ **Modifiche Code**:
- `src/components/TerminalView.tsx`:
  - Nuove refs: `autoScrollEnabledRef`, `userScrollPositionRef`
  - Funzione: `handleUserScroll()`
  - Listener: `terminal.onScroll()`
  - Modifica: auto-scroll logic con check `autoScrollEnabled`
  - Componente: Badge "Scroll to bottom"
  - Cleanup: Reset scroll state alla chiusura

✅ **Styling**:
- `src/App.css`:
  - `.scroll-to-bottom-badge` (button floating con accent color)
  - Hover effects e transitions

✅ **Testing**:
- Scroll UP disabilita auto-scroll ✅
- Scroll DOWN ri-abilita auto-scroll ✅
- Badge appare/scompare correttamente ✅
- Multiple terminals mantengono scroll state indipendente ✅
- Cleanup memoria alla chiusura ✅

✅ **Documentazione**:
- `project-plan/terminal-scroll-improvement/summary.md` ✅
- `CLAUDE.md`: Update sezione "Terminal Management" con nuova scroll feature

## 🚀 Rollout Strategy

### Pre-Deploy Checks
- [ ] Test su comandi verbosi reali: `npm install --verbose`, `ls -laR /`, `claude code`
- [ ] Test con 3+ terminali aperti in parallelo
- [ ] Test resize finestra durante scroll disabilitato
- [ ] Verify no console errors in production build

### Deployment
1. ✅ Implementa Fase 1 (core logic)
2. ✅ Test manuale estensivo
3. ✅ Implementa Fase 2 (badge UI)
4. ✅ Test integrazione completa
5. ✅ Implementa Fase 3 (edge cases)
6. ✅ Final QA pass
7. ✅ Commit con messaggio descrittivo
8. ✅ Update docs

### Rollback Plan
Se ci sono problemi:
1. **Immediato**: Commentare listener `terminal.onScroll()` → torna a comportamento vecchio
2. **Parziale**: Disabilitare badge UI ma mantenere core logic
3. **Full rollback**: Git revert commit se breaking bugs

## 🔄 Future Enhancements (Post-MVP)

1. **Scroll Lock Indicator**:
   - Icona 🔒 nella status bar quando auto-scroll è disabilitato
   - Tooltip: "Scroll locked - new output hidden"

2. **Smart Badge con Line Count**:
   - Badge mostra "⬇ 127 new lines" invece di solo "Scroll to bottom"
   - Calcola `buffer.baseY - buffer.viewportY` come righe non lette

3. **Keyboard Shortcut**:
   - `Cmd+End` / `Ctrl+End` → scrolla al bottom + re-enable auto-scroll
   - `Cmd+Home` → scrolla al top (mantiene auto-scroll disabilitato)

4. **Smooth Scroll Animation**:
   - Invece di `scrollToBottom()` istantaneo, smooth scroll animato
   - xterm.js supporta `scrollLines()` incrementale

5. **Per-Terminal Preferences**:
   - Toggle in terminal settings: "Always lock scroll" vs "Smart auto-scroll"
   - Per utenti che preferiscono controllo manuale totale

---

**Status**: 📋 Planning Complete - Ready for Implementation
**Team**: Jack (coordination) + Alek (implementation)
**Complexity**: 🦆🦆🦆 (Medium Duck Energy - straightforward UX fix)
**Impact**: 🎯🎯🎯🎯🎯 (High - risolve frustrante UX bug quotidiano!)
