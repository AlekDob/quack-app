# WhatsApp Watcher for Quack

Sistema robusto e flessibile per monitorare messaggi WhatsApp e inoltrarli agli agenti AI di Quack.

## Quick Start

### 1. Avvia il Go Bridge

```bash
cd ~/Desktop/Dev/Personal/whatsapp-mcp/whatsapp-bridge
ulimit -n 4096  # Aumenta limite file descriptors
go run main.go
```

Scansiona il QR code con WhatsApp sul telefono.

### 2. Avvia il Watcher

**Modalità Production** (processa solo messaggi ricevuti):
```bash
cd ~/Desktop/Dev/Personal/quack-app
npm run whatsapp:watch
```

**Modalità Test** (processa anche i TUOI messaggi):
```bash
npm run whatsapp:watch:test
```

**Modalità Dry-Run** (solo log, nessun invio):
```bash
npm run whatsapp:watch:dry
```

### 3. Testa l'Integrazione

**In production mode:**
- Fatti mandare un messaggio con `@quack ciao`

**In test mode:**
- Manda TU un messaggio con `@quack ciao`

## Trigger Patterns

### Pattern di Base

```
@quack <query>                    → Default agent, default project (quack-app)
@quack:sophie <query>             → Agent Sophie, default project (quack-app)
@quack@flow-bi <query>            → Default agent, progetto flow-bi
@quack:sophie@quack-app <query>   → Agent Sophie, progetto quack-app
@quack:jack@flow-bi <query>       → Agent Jack, progetto flow-bi
@duck <query>                     → Trigger alternativo
```

**Note:**
- Se non specifichi il progetto, usa `defaultProject` dal config (default: `quack-app`)
- Se non specifichi l'agente, usa `defaultAgent` dal config (default: `sophie`)
- Il matching del progetto è case-insensitive e usa `includes()` (es: `flow` trova `flow-bi`)

### Fuzzy Matching

Il watcher usa fuzzy matching per trovare gli agenti:
- `@quack:jack` → trova "Agent Jack"
- `@quack:sophie` → trova "Agent Sophie"
- `@quack:magnus` → trova "Agent Magnus"

## Configurazione

### File di Config

Auto-creato in `~/.quack/whatsapp-watcher.json` al primo avvio.

**Esempio di configurazione:**

```json
{
  "messagesDb": "/Users/alekdob/Desktop/Dev/Personal/whatsapp-mcp/whatsapp-bridge/store/messages.db",
  "whatsappApiUrl": "http://localhost:8080",
  "whatsappApiPort": 8080,

  "pollInterval": 5000,
  "maxPollRetries": 3,
  "backoffMultiplier": 2,

  "defaultAgent": "sophie",
  "agentTimeout": 120000,

  "triggerPatterns": ["@quack", "@duck"],

  "thinkingMessage": true,
  "maxResponseLength": 4000,
  "errorEmoji": "❌",
  "successEmoji": "🦆",

  "enableContext": true,
  "contextMessageCount": 5,
  "contextTimeWindow": 3600000,

  "allowedChats": [],
  "blockedChats": [],
  "allowedSenders": [],
  "blockedSenders": []
}
```

### Opzioni CLI

```bash
--config <path>        # Custom config file
--verbose              # Debug logging
--dry-run              # Non inviare messaggi
--allow-own-messages   # Processa anche messaggi tuoi (test)
--help                 # Mostra aiuto
```

## Features

### 1. Robustezza

- ✅ **Reconnection automatica** al database con exponential backoff
- ✅ **Retry logic** per invio messaggi (3 tentativi)
- ✅ **Health check** periodico del bridge WhatsApp
- ✅ **Graceful shutdown** con timeout di sicurezza
- ✅ **Error handling** completo (uncaught exceptions, unhandled rejections)

### 2. Context Support

Il watcher include **contesto conversazionale** nelle richieste:

- Ultimi N messaggi della chat (default: 5)
- Time window configurabile (default: 1 ora)
- L'agente ha più informazioni per rispondere

**Esempio:**
```
User: @quack che ore sono?
Agent: Sono le 14:30

[10 minuti dopo]
User: @quack e ora?
Agent: [con context] Sono le 14:40 (10 minuti dopo l'ultima volta che hai chiesto)
```

### 3. Logging

**Strutturato con livelli:**
- `INFO` - Eventi importanti
- `WARN` - Warning non bloccanti
- `ERROR` - Errori critici
- `DEBUG` - Dettagli tecnici (solo con `--verbose`)

**Log file:** `~/.quack/whatsapp-watcher.log`

**Stats tracking:**
- Messaggi processati
- Errori totali
- Ultimo successo

### 4. Whitelist/Blacklist

Controlla chi può usare @quack:

```json
{
  "allowedChats": ["393496711176@s.whatsapp.net"],
  "blockedChats": [],
  "allowedSenders": [],
  "blockedSenders": ["spam@s.whatsapp.net"]
}
```

## Troubleshooting

### Il messaggio non viene processato

**Verifica:**
1. Il bridge è connesso? (vedi log Go)
2. Il messaggio è nel database?
   ```bash
   sqlite3 ~/Desktop/Dev/Personal/whatsapp-mcp/whatsapp-bridge/store/messages.db
   SELECT * FROM messages ORDER BY timestamp DESC LIMIT 5;
   ```
3. Il watcher sta facendo polling? (vedi log Node.js)
4. Stai usando `--allow-own-messages` se mandi TU il messaggio?

### "Too many open files" (EMFILE)

**Problema:** Il bridge Go non gestisce bene le connessioni HTTP.

**Soluzione rapida:**
```bash
ulimit -n 4096
```

**Soluzione permanente:** Vedi `docs/02-bug-fixes/whatsapp-bridge-file-descriptors.md`

### Il watcher si disconnette dal database

**Problema:** Database locked o Go bridge crashato.

**Soluzione:** Il watcher si riconnette automaticamente con exponential backoff.

### Nessuna risposta dall'agente

**Verifica:**
1. L'agente esiste in `~/.quack/quack-agents.json`?
2. Il timeout è sufficiente? (default: 2 minuti)
3. Vedi errori nel log?

## Architettura

```
WhatsApp → Go Bridge → SQLite DB → Node.js Watcher → Claude CLI → WhatsApp API
                           ↓                ↓
                    messages.db      Quack Agents
```

**Flow completo:**

1. **Messaggio in arrivo** → Go bridge scrive in SQLite
2. **Polling** → Watcher legge nuovi messaggi ogni 5s
3. **Pattern matching** → Cerca `@quack` nel contenuto
4. **Agent routing** → Trova agente con fuzzy matching
5. **Context loading** → Carica ultimi N messaggi
6. **Claude processing** → Invoca `claude --print` con context
7. **Response** → Invia risposta via WhatsApp API

## npm Scripts

| Script | Descrizione |
|--------|-------------|
| `whatsapp:watch` | Modalità production (solo messaggi ricevuti) |
| `whatsapp:watch:test` | Modalità test (anche tuoi messaggi) |
| `whatsapp:watch:dry` | Dry-run (solo log, nessun invio) |

## Files

| Path | Descrizione |
|------|-------------|
| `src-tauri/node-sdk/whatsapp-watcher.cjs` | Main watcher script |
| `~/.quack/whatsapp-watcher.json` | User config |
| `~/.quack/whatsapp-watcher.log` | Log file |
| `~/.quack/whatsapp-processed.json` | Processed message IDs + stats |
| `~/.quack/quack-agents.json` | Quack agents |

## Best Practices

### Development

1. **Usa `--allow-own-messages`** per testare senza bisogno di altri
2. **Usa `--verbose`** per vedere cosa succede
3. **Usa `--dry-run`** per verificare matching senza inviare

### Production

1. **NON usare `--allow-own-messages`** (rischio loop)
2. **Configura whitelist** se necessario
3. **Monitora il log file** per errori
4. **Aumenta `ulimit -n`** prima di avviare il bridge

### Performance

1. **Poll interval**: 5s è un buon compromesso
2. **Context window**: 1 ora evita troppa history
3. **Agent timeout**: 2 minuti per query complesse

## Roadmap

- [ ] Event-driven architecture (webhook invece di polling)
- [ ] Multi-instance support (scaling orizzontale)
- [ ] Metrics & monitoring (Prometheus/Grafana)
- [ ] Message queue (Redis/RabbitMQ)
- [ ] Rich media support (immagini, audio, video)

## Related Docs

- [WhatsApp Bridge File Descriptors Bug](../02-bug-fixes/whatsapp-bridge-file-descriptors.md)
- [Architecture Overview](../01-architecture.md)
- [Background Tasks](./background-tasks.md)
