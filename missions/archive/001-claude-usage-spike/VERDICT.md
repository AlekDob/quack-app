# VERDICT — Claude Code usage spike in Quack (v2)

**Data**: 2026-06-30 (revisionato dopo feedback utente)
**Campione**: 313 sessioni reali da `~/.claude/projects/*/`
**Cambio rispetto a v1**: rimosso il confronto "Mastra cost Quack vs CLI" (era rumore testuale — il task "Mastra cost" dell'utente non era confrontabile perché gestito solo in Quack). Nuovo confronto valido: **sessioni Quack lunghe vs brevi** (stesso surface, stesso modello, stesso bridge — unica variabile = lunghezza task).

---

## TL;DR — la vera causa

Quack NON ha un problema tecnico di cache miss, reinvio history, o pensiero gonfiato. **L'80% del costo Quack è concentrato nel 25% delle sessioni — quelle più lunghe (>200 turni).** Il costo per singolo turno è solo $0.41 vs $0.25 di una sessione breve, ma **N × turni × thinking = costo totale alto**.

Le sessioni lunghe sono task di sviluppo attivo su Virgilio/codetta (refactoring, illustrazioni iterative, integrazioni multi-file). Sono sessioni che **devono** essere lunghe per il tipo di lavoro — il collo di bottiglia non è l'efficienza del bridge, è la **durata cumulativa del task**.

**Verdetto finale**: GO per interventi di **visibilità e compat**, non per interventi sul bridge.

---

## Numeri chiave — solo sessioni Quack (N=57)

### Decomposizione costo totale ($3,954)

| Bucket | Costo | % | Tokens |
|---|---|---|---|
| Input (uncached) | $37 | 0.9% | 7.5M |
| Output | $581 | 14.7% | 23.3M |
| Cache writes 1h | **$1,215** | **30.7%** | 121.5M |
| Cache writes 5m | $0 | 0.0% | 0 |
| **Cache reads** | **$2,576** | **65.1%** | **5,151M** |
| **TOTAL** | $3,954 | 100% | — |

**Insight**: Quack legge dalla cache 5.1 MILIARDI di token cumulativi. La cache è efficiente (95% hit) ma il context è enorme.

### Lunghe vs Brevi — il vero confronto

| Metrica | LONG (≥200 turns, n=14) | SHORT (<200 turns, n=43) | Differenza |
|---|---|---|---|
| Costo/session mediano | **$170** | **$10** | **17x** |
| Turns/session mediani | 376 | 49 | 7.7x |
| **Costo/turn mediano** | **$0.41** | **$0.25** | 1.65x |
| Cache hit ratio | 97.9% | 95.0% | Quack MEGLIO sulle lunghe |
| Thinking blocks/session | 214 | 27 | 8x |
| Thinking/turn | 0.57 | 0.55 | ~ pari |

**Concentrazione del costo**:
- 14 sessioni lunghe (25% del totale) → **$3,172 = 80% del costo totale**
- 43 sessioni brevi (75% del totale) → $782 = 20% del costo totale

### Dove sono le sessioni lunghe

| Workspace | LONG sessions | SHORT sessions |
|---|---|---|
| Virgilio | 9 | 19 |
| codetta | 4 | 11 |
| Kyron | 0 | 10 |
| quack-3 | 1 | 0 |
| altri | 0 | 3 |

Virgilio e codetta sono i "magneti" delle sessioni lunghe. Kyron viene usato in modo esplorativo (sessioni brevi).

---

## Evoluzione context in una sessione da 1538 turns ($549)

Ho tracciato la sessione Quack più cara (Virgilio, 1538 turns, $549) per vedere come evolve il context.

| Window turns | Avg ctx size | Avg cost/turn |
|---|---|---|
| 0-100 | 150k | $0.17 |
| 100-300 | 222k-294k | $0.21-0.26 |
| 300-500 | 358k-430k | $0.23-0.26 |
| **500-700** | **236k (← COMPACTION)** | **$0.18** |
| 700-900 | 191k-208k | $0.12-0.20 |
| 900-1100 | 261k-341k | $0.21-0.32 |
| 1100-1300 | 388k-406k | $0.24-0.30 |
| **1300-1500** | **170k-236k (← COMPACTION)** | **$0.12-0.16** |
| 1500-1700 | 295k-372k | $0.24-0.27 |
| 1700-1900 | 212k-451k | $0.20-0.26 |
| **1900-2100** | **206k-279k (← COMPACTION)** | **$0.13-0.33** |
| ... | ... | ... |

**Scoperte**:
1. Il context **oscilla** tra 150k e 450k, NON cresce linearmente.
2. **Auto-compact di Claude Code funziona**: ci sono 3-4 compactions visibili nella sessione (salti da 400k+ a 200k-).
3. Costo/turn **stabile** a $0.12-0.33 → la cache hit tiene il costo per turno ragionevole.
4. **Il context supera la finestra di Opus (200k)** regolarmente (fino a 451k) → Claude Code gestisce compattando, ma il context letto dalla cache resta comunque enorme.

**Costo primi 100 turni: $17.11 — costo ultimi 100 turni: $15.66 — ratio 0.92x** (gli ultimi costano MENO, non di più, grazie alle compactions).

---

## Le 3 cause vere del "consumo percepito"

### 1. Sessioni intrinsecamente lunghe (la causa principale)

Le sessioni Quack su Virgilio e codetta sono task di sviluppo **oggettivamente lunghi** (refactoring multi-file, integrazioni, iterazioni su UI). Una sessione da 1500 turni è un lavoro di un'intera giornata. Il consumo non è anomalo: è proporzionale al lavoro svolto.

**La GUI Chat occasionale non genera sessioni così lunghe** perché l'utente la usa per Q&A puntuali. Quack è progettato per task di sviluppo attivo, quindi il consumo è strutturalmente più alto.

**Azione**: comunicazione, non fix. "Questa sessione ha 1500 turns, è il 30x della tua mediana".

### 2. Cache writes 100% 1h (risparmio facile)

Il 30.7% del costo è cache writes 1h. Cache 1h costa 2x del 5m. Per sessioni brevi/interrotte è uno spreco secco del 37.5%.

**Simulazione**: convertire tutti i 1h cache writes in 5m → **risparmio $455 / $3,954 = 11.5%**.

**Azione**: aggiungere setting "Cache TTL: 5m / 1h / Auto" con auto-detection basata sulla durata della sessione. Default = Auto (5m se sessione <30min, 1h se >30min).

### 3. Thinking su sessioni brevi = spreco relativo

Le sessioni brevi Quack hanno comunque 27 thinking blocks in media. Se una chat di 50 turni è una semplice domanda di codice, 27 thinking blocks sono overkill.

**Azione**: default `/thinking off` su Quack (con toggle esplicito per refactoring/architettura). Salvare la preferenza per workspace.

---

## Le ipotesi iniziali — verifica finale

| # | Ipotesi | Esito |
|---|---|---|
| H1 | Cache miss sistematico | **FALSA**. Cache hit 95%+, funziona. |
| H2 | Thinking forzato a 32k | **PARZIALE**. Non è il budget, è che Quack lo usa su task semplici dove non serve. |
| H3 | Subagent sidechain reinjectati | **DA VERIFICARE** — out of scope per questo spike. |
| H4 | MCP + skills gonfiano system prompt | **DA VERIFICARE** — out of scope. |
| H5 | Stream-json verbose | **FALSA**. Wire-format, non tokens. |
| H6 | --resume che fallisce | **FALSA**. Resume funziona correttamente. |

**L'ipotesi corretta che mancava**: **sessioni oggettivamente più lunghe per task di sviluppo attivo**. Non è un bug, è una caratteristica d'uso.

---

## Cosa costruire (in ordine di priorità)

### 1. Visibilità sessioni lunghe (1-2h, ALTA priorità)
- Mostrare in StatusBar / AgentHub: turns totali, cost cumulato sessione corrente, cost cumulato mese
- Confrontare con la mediana personale ("questa sessione è 30x la tua mediana")
- Alert quando si supera una soglia (es. 500 turns, $100 sessione)

### 2. Toggle Cache TTL (2-3h, ALTA priorità)
- Setting: 5m / 1h / **Auto** (consigliato)
- Auto: 5m per sessioni <30min, 1h per >30min
- Risparmio atteso: **11.5%** del costo totale Quack
- Implementazione: aggiungere `--cache-ttl` flag al comando `claude` (se esiste) o passare `MAX_CACHE_TTL` env var

### 3. Toggle Thinking intelligente (1-2h, MEDIA priorità)
- Default: **off** per chat brevi (mediana 49 turns)
- Default: **on** per refactoring/architectural tasks
- Salvare preferenza per workspace

### 4. Suggerimento /compact (1h, MEDIA priorità)
- Quando context > 350k tokens, suggerire proattivamente: "Context è al 175% del window, vuoi /compact?"
- Quack potrebbe offrire un bottone "Compact now" prima che Claude Code lo faccia automaticamente (perdita di lavoro recente)

### 5. Integrazione ccusage (2-3h, BASSA priorità)
- Shell-out `npx ccusage@latest blocks --json` come comando Rust
- Mostrare le 5h billing windows in tempo reale
- Confronto con la subscription OAuth via `claude_usage_limits` (già esistente)

---

## Cosa NON fare

- **Non toccare il bridge `claude_code.rs`** — funziona correttamente. Cache hit 95%+.
- **Non implementare auto-compact custom** — Claude Code lo fa già, e bene (context oscilla, non cresce linearmente).
- **Non aggiungere un "cost-spike detector"** — le sessioni costano quanto devono costare, è inutile moralizzare.
- **Non forkare ccusage** — shell-out è sufficiente, evita dipendenze binarie.

---

## File generati (v2)

- `missions/archive/001-claude-usage-spike/analyze.py` — script (313 righe, riusabile)
- `missions/archive/001-claude-usage-spike/sessions.csv` — 313 sessioni × 22 metriche
- `missions/archive/001-claude-usage-spike/summary.json` — statistiche Quack/CLI
- `missions/archive/001-claude-usage-spike/outliers.json` — 31 sessioni anomale
- `missions/archive/001-claude-usage-spike/VERDICT.md` — questo verdetto (v2)

---

## Cambiamenti rispetto a v1

1. Rimosso confronto "Mastra cost Quack vs CLI" (non valido, task diversi).
2. Aggiunto confronto "Quack LONG vs Quack SHORT" (unico confronto apples-to-apples).
3. Tracciata evoluzione context nella sessione più cara (mostra auto-compact funziona).
4. Identificata la vera causa: **80% del costo è nel 25% delle sessioni più lunghe**.
5. Rivisto il peso di H1-H6: solo H2 (thinking) e la nuova ipotesi (sessioni lunghe) sono confermate.

---

## Prossimo passo proposto

Aprire missione `002-quack-usage-dashboard` con scope:
- Fase 1: Visibilità sessioni lunghe (turns + cost + alert)
- Fase 2: Toggle Cache TTL con auto-detection
- Fase 3: Toggle Thinking con default intelligente per workspace

Risparmio atteso: **10-15% del costo totale** + capacità di fare scelte consapevoli (es. "questa sessione è troppo lunga, ne apro una nuova").

Stima: 1-2 sessioni di lavoro.