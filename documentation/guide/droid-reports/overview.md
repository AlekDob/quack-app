# Rapporti Droid - Panoramica

Quando un agente AI (droid) completa il suo lavoro, il risultato viene mostrato come un **report card** formattato — non come JSON grezzo. Questa guida spiega come funziona e come leggere i rapporti.

## Cos'e' un Rapporto Droid?

Un rapporto droid e' la risposta finale di un subagente (droid) invocato dall'agente principale. Contiene:

- **Contenuto markdown** — tabelle, code blocks, heading, liste — tutto formattato
- **Metadata** — durata, token usati, numero di strumenti utilizzati
- **Identita' del droid** — avatar, nome, colore personalizzato

## Come si presenta

```
+----------------------------------------------------------+
| [Avatar] Code Reviewer  "Second opinion"  [Rapporto]     |
|                                    47s  23.4k tok  6 str  |
|                                                    [>]   |
+----------------------------------------------------------+
|                                                          |
|  ## Risultati della verifica                             |
|                                                          |
|  | # | Issue | Verdetto |                                |
|  |---|-------|----------|                                |
|  | 1 | Dep array mancante | CONFERMATO |                 |
|  | 2 | Side effect in setter | CONFERMATO |               |
|  ...                                                     |
+----------------------------------------------------------+
```

### Header (sempre visibile)

| Elemento | Descrizione |
|----------|-------------|
| **Avatar** | L'icona del droid (configurata nel file `.claude/agents/`) |
| **Nome** | Il nome formattato del droid (es. "Code Reviewer") |
| **Descrizione** | Cosa gli e' stato chiesto di fare |
| **Badge "Rapporto"** | Indica che il droid ha completato il lavoro |
| **Pills metadata** | Durata (es. "47s"), token (es. "23.4k tok"), strumenti usati (es. "6 str") |
| **Chevron** | Clicca per espandere/collassare il contenuto |

### Body (collapsabile)

Il contenuto del rapporto renderizzato come markdown. Supporta:
- Tabelle
- Code blocks con syntax highlighting
- Heading (h1-h6)
- Liste ordinate e non ordinate
- Blockquote
- Link e testo formattato

## Ciclo di vita

```
1. L'utente chiede qualcosa all'agente principale
2. L'agente decide di delegare a un droid
3. Compare il widget TaskWidget con spinner
4. Il droid lavora in background
5. Al completamento, il TaskWidget viene sostituito dal Rapporto Droid
6. L'utente puo' espandere il rapporto per leggere i dettagli
```

## Tool dell'orchestratore vs tool del subagente

> Questo e' un punto chiave che spesso genera confusione.

Mentre un droid lavora, potresti vedere altri tool (Read, Grep, Write) apparire nella chat. **Questi tool appartengono all'agente principale**, non al droid.

Il droid esegue i suoi tool internamente — non sono visibili nella tua chat. Solo il risultato finale viene mostrato.

### Come distinguerli

I tool dell'agente principale che girano durante l'esecuzione di un droid sono **indentati con una barra laterale viola**:

```
Agent Leo
  "Lancio il code reviewer..."
  +-- using Agent on Code review ●●●
  |
  |  using Read on App.tsx        ✓ >    <-- Orchestratore
  |  using Grep on handleEvent    ✓ >    <-- Orchestratore
  |
  +-- [Rapporto Droid]                   <-- Risultato del droid

Agent Leo
  "Ecco cosa ho trovato..."
```

La barra viola indica: "questi strumenti li sta usando l'agente principale, in parallelo al lavoro del droid".

## Personalizzazione dei droid

Ogni droid puo' avere:
- **Avatar personalizzato** — immagine custom nella configurazione del droid
- **Colore brand** — il bordo e lo sfondo del rapporto usano il colore del droid
- **Nome** — visualizzato nell'header del rapporto

Questi si configurano nel file YAML del droid in `.claude/agents/`.
