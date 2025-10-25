# 🦆 Test Plan: Multi-Listener Fix per Concurrent Agents

## ✅ Fix Implementato

**File modificato**: `src/App.tsx` (linee 555-661)

**Cambiamento principale**:
- ❌ **PRIMA**: Listener singolo per `activeId` (veniva rimosso ad ogni switch)
- ✅ **DOPO**: Listener multipli per TUTTI gli agenti con sessioni attive (persistenti)

---

## 🧪 Test Cases

### Test 1: Setup Base ✅
**Obiettivo**: Verificare che i listener vengano creati correttamente

**Steps**:
1. Apri DevTools (F12) → Console
2. Apri Quack app
3. Crea primo agente/chat "Test Agent 1"
4. Verifica in console:
   ```
   [Multi-Listener] Setting up listeners for agents: ['agent-1']
   [Multi-Listener] Listener registered for agent: agent-1
   ```

**Expected**: ✅ Log conferma registrazione listener

---

### Test 2: Multi-Agent Setup ✅
**Obiettivo**: Verificare che vengano creati listener per tutti gli agenti

**Steps**:
1. Con "Test Agent 1" già aperto
2. Crea secondo agente "Test Agent 2"
3. Verifica in console:
   ```
   [Multi-Listener] Setting up listeners for agents: ['agent-1', 'agent-2']
   [Multi-Listener] Listener registered for agent: agent-1
   [Multi-Listener] Listener registered for agent: agent-2
   ```

**Expected**: ✅ Due listener registrati contemporaneamente

---

### Test 3: Concurrent Streaming (CRITICAL) 🔥
**Obiettivo**: Verificare che lo streaming funzioni su entrambi gli agenti contemporaneamente

**Steps**:
1. Apri "Test Agent 1"
2. Invia messaggio: "List all files in current directory"
3. **IMMEDIATAMENTE** switcha su "Test Agent 2"
4. Invia messaggio: "Show me the package.json"
5. Switcha velocemente tra i due agenti MENTRE stanno streamando
6. Verifica in console:
   ```
   [Multi-Listener] Event received for agent agent-1: assistant
   [Multi-Listener] Event received for agent agent-2: assistant
   [Multi-Listener] Event received for agent agent-1: result
   [Multi-Listener] Event received for agent agent-2: result
   ```

**Expected**:
✅ Entrambi gli agenti ricevono eventi
✅ Entrambi completano con `result` event
✅ Nessun stream interrotto

**Failure Indicators**:
❌ Solo un agente completa
❌ Log mostrano eventi solo per un agente
❌ Messaggio rimane in stato "streaming" indefinitamente

---

### Test 4: Switch Durante Streaming 🔥
**Obiettivo**: Verificare che il listener NON venga rimosso quando switchi tab

**Steps**:
1. Apri "Test Agent 1"
2. Invia messaggio lungo (es. "Analyze the entire codebase structure")
3. Dopo 2 secondi, switcha su "Test Agent 2"
4. Aspetta 5 secondi
5. Torna su "Test Agent 1"
6. Verifica che lo streaming sia ancora attivo

**Expected**:
✅ "Test Agent 1" continua a streamare durante lo switch
✅ Eventi arrivano in background anche quando tab non è attivo
✅ Stream completa normalmente

**Failure Indicators**:
❌ Stream si blocca quando switchi
❌ Console mostra: `[Multi-Listener] Cleaning up listeners for: ['agent-1']` durante lo switch
❌ Messaggio rimane incompleto

---

### Test 5: Listener Cleanup ✅
**Obiettivo**: Verificare che i listener vengano rimossi solo quando chiudi l'agente

**Steps**:
1. Apri "Test Agent 1" e "Test Agent 2"
2. Verifica in console: 2 listener attivi
3. Chiudi "Test Agent 1" (click su X)
4. Verifica in console:
   ```
   [Multi-Listener] Cleaning up listeners for: ['agent-1', 'agent-2']
   [Multi-Listener] Listener removed for agent: agent-1
   [Multi-Listener] Listener removed for agent: agent-2
   [Multi-Listener] Setting up listeners for agents: ['agent-2']
   [Multi-Listener] Listener registered for agent: agent-2
   ```

**Expected**:
✅ Cleanup di tutti i listener
✅ Setup di nuovi listener solo per agenti rimasti
✅ Memoria liberata correttamente

---

### Test 6: Stress Test con 3+ Agenti 🔥
**Obiettivo**: Verificare stabilità con molti agenti concorrenti

**Steps**:
1. Apri 3 agenti: "Agent A", "Agent B", "Agent C"
2. Invia messaggi a tutti e tre in rapida successione:
   - Agent A: "List files"
   - Agent B: "Show git status"
   - Agent C: "Read package.json"
3. Switcha rapidamente tra tutti e tre MENTRE streamano
4. Verifica che tutti e tre completino

**Expected**:
✅ Tutti e 3 completano senza errori
✅ Console mostra eventi per tutti e 3
✅ Nessuna interruzione o perdita di eventi

**Failure Indicators**:
❌ Uno o più agenti si bloccano
❌ Console mostra errori
❌ Performance degradation

---

## 🔍 Debug Checklist

Se i test falliscono, controlla:

### 1. Console Logs
- [ ] Listener vengono registrati per tutti gli agenti?
- [ ] Eventi arrivano per l'agente corretto (`agentId` nel log)?
- [ ] Cleanup viene chiamato solo quando necessario?

### 2. Network Tab (DevTools)
- [ ] Rust backend invia eventi su canale corretto (`claude-event:agent-id`)?
- [ ] Eventi arrivano ma non vengono processati?

### 3. React DevTools
- [ ] `chatSessions` Map contiene tutti gli agenti?
- [ ] `activeId` cambia correttamente quando switchi?
- [ ] State viene aggiornato per tutti gli agenti?

### 4. Tauri DevTools
- [ ] Eventi Tauri vengono emessi correttamente dal backend?
- [ ] Listener Tauri sono effettivamente registrati?

---

## 🐛 Known Issues & Limitations

### Issue 1: Dependency su chatSessions
**Problema**: `useEffect` si triggera ogni volta che `chatSessions` cambia (anche durante streaming)

**Soluzione attuale**: Listeners vengono ri-creati, ma questo è OK perché:
- Closure cattura `agentId` corretto
- Eventi in arrivo vengono comunque processati
- Nuovi listener sostituiscono i vecchi senza perdita

**Improvement futuro**: Usare `useRef` per tracciare listener senza triggerare re-render

### Issue 2: Memory Leak Potenziale
**Problema**: Se `chatSessions` cambia rapidamente, potremmo creare molti listener

**Mitigazione attuale**: Cleanup esplicito in `return ()` del useEffect

**Improvement futuro**: Debounce sul setup dei listener

---

## ✅ Success Criteria

Il fix è considerato **COMPLETO** se:
- ✅ Test 1-2: Listener vengono creati correttamente
- ✅ Test 3-4: **CRITICAL** - Streaming concorrente funziona
- ✅ Test 5: Cleanup funziona correttamente
- ✅ Test 6: Stress test passa
- ✅ Console non mostra errori
- ✅ Performance rimane accettabile

---

## 📊 Metriche di Successo

### Prima del Fix
- ❌ Concurrent streaming: **50% success rate**
- ❌ Switch durante streaming: **Fallisce sempre**
- ❌ 3+ agenti: **Alta probabilità di crash**

### Dopo il Fix (Expected)
- ✅ Concurrent streaming: **100% success rate**
- ✅ Switch durante streaming: **Funziona sempre**
- ✅ 3+ agenti: **Stabile**

---

## 🦆 Testing Notes

**Tester**: Alek
**Date**: 2025-01-XX
**Environment**:
- OS: macOS
- Node: 18.17.0
- Tauri: v2
- Quack Version: Current

**Results**:
- [ ] Test 1: PASS / FAIL
- [ ] Test 2: PASS / FAIL
- [ ] Test 3: PASS / FAIL (CRITICAL)
- [ ] Test 4: PASS / FAIL (CRITICAL)
- [ ] Test 5: PASS / FAIL
- [ ] Test 6: PASS / FAIL

**Notes**:
[Inserisci qui osservazioni durante i test]

---

Quack quack! 🦆
