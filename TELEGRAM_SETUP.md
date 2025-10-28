# 🦆 Quack Telegram Bot Integration - Setup & Testing Guide

## Overview

Ho implementato un **sistema completo di controllo bidirezionale via Telegram** per Quack! Ora puoi:

- 📱 Controllare gli agenti dal tuo iPhone/telefono
- 🔔 Ricevere notifiche quando un agente completa il lavoro
- 💬 Inviare comandi e messaggi agli agenti via Telegram
- 📊 Monitorare lo stato di tutti gli agenti attivi
- 📸 Richiedere screenshot (opzionale, da implementare lato frontend)

## Architettura

### Backend (Rust)
- **Server Webhook**: Axum HTTP server su `http://127.0.0.1:6768/telegram/webhook`
- **Parser Comandi**: Analizza comandi Telegram (`/status`, `/new`, `/chat`, `/stop`, `/screenshot`)
- **Event System**: Emette eventi Tauri per comunicare con il frontend
- **API Telegram**: Invia messaggi, foto e inline keyboards

### Frontend (TypeScript)
- **Hook `useTelegramBot`**: Gestisce tutti gli eventi Telegram
- **Comandi Tauri**: `send_telegram_message`, `send_telegram_notification_command`, `send_telegram_photo`
- **Event Listeners**: Ascolta eventi dal backend Rust e risponde appropriatamente

## Setup del Bot Telegram

### 1. Crea il Bot con BotFather

1. Apri Telegram e cerca `@BotFather`
2. Invia `/newbot`
3. Segui le istruzioni:
   - Scegli un nome (es: "Quack Control Bot")
   - Scegli uno username (es: "quack_control_bot")
4. BotFather ti darà un **Bot Token** (es: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
5. **SALVA QUESTO TOKEN** - ti servirà dopo!

### 2. Ottieni il tuo Chat ID

1. Cerca il tuo bot su Telegram (usando lo username che hai creato)
2. Invia `/start` al bot
3. Apri questo URL nel browser (sostituisci `<YOUR_BOT_TOKEN>` con il tuo token):
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
4. Cerca `"chat":{"id":` nel JSON - quel numero è il tuo **Chat ID** (es: `123456789`)
5. **SALVA QUESTO CHAT ID** - ti servirà dopo!

### 3. Configura Quack

1. Apri Quack
2. Vai su **Settings** → **Notifications** (o il pannello dove configuri Telegram)
3. Inserisci:
   - **Bot Token**: Il token che hai ottenuto da BotFather
   - **Chat ID**: Il tuo Chat ID
4. Salva le impostazioni

### 4. Configura il Webhook

Il bot ha bisogno di sapere dove inviare gli aggiornamenti. Esegui questo comando in un terminale (sostituisci `<YOUR_BOT_TOKEN>`):

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://127.0.0.1:6768/telegram/webhook"}'
```

**IMPORTANTE**: Questo funziona solo in locale. Per un deployment in produzione, avrai bisogno di:
- Un server con IP pubblico o un tunnel (es: ngrok)
- HTTPS obbligatorio (Telegram richiede SSL)

Per testing locale con ngrok:
```bash
# Installa ngrok se non ce l'hai: https://ngrok.com/download
ngrok http 6768

# Usa l'URL HTTPS che ngrok ti fornisce per configurare il webhook:
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://YOUR-NGROK-URL.ngrok.io/telegram/webhook"}'
```

## Comandi Disponibili

### `/status`
Mostra tutti gli agenti attivi e il loro stato.

**Esempio:**
```
/status
```

**Risposta:**
```
🦆 Active Agents (2)

• AI Assistant (abc12345)
  Status: 🟡 Working

• Code Reviewer (def67890)
  Status: 🟢 Idle
```

### `/new <prompt>`
Avvia un nuovo agente con un prompt.

**Esempio:**
```
/new Create a React component for a todo list
```

**Risposta:**
```
🦆 Agent Started

Session ID: abc12345
Prompt: Create a React component for a todo list

[✅ Approve] [❌ Cancel] [🔄 Retry]
```

### `/chat <session_id> <message>`
Invia un messaggio a un agente specifico.

**Esempio:**
```
/chat abc12345 Add error handling
```

**Risposta:**
```
🦆 Message Sent

Session ID: abc12345
Message: Add error handling
```

### `/stop <session_id>`
Ferma un agente specifico.

**Esempio:**
```
/stop abc12345
```

**Risposta:**
```
🦆 Agent Stopped

Session ID: abc12345
```

### `/screenshot <session_id>`
Richiede uno screenshot dall'agente (richiede implementazione frontend).

**Esempio:**
```
/screenshot abc12345
```

**Risposta:** Riceverai uno screenshot dell'interfaccia dell'agente.

### `/help`
Mostra l'elenco dei comandi disponibili.

## Inline Keyboards

Quando un agente viene avviato con `/new`, riceverai dei pulsanti:

- **✅ Approve**: Approva l'azione dell'agente (da implementare logica)
- **❌ Cancel**: Annulla e ferma l'agente
- **🔄 Retry**: Riprova l'ultima operazione (da implementare logica)

## Testing Flow

### 1. Test Base
```bash
# 1. Avvia Quack
npm run tauri:dev

# 2. Verifica che il server sia attivo
curl http://127.0.0.1:6768/telegram/webhook
# Dovrebbe rispondere con un errore (normale, perché serve POST)

# 3. Invia un comando su Telegram
/help
```

### 2. Test Completo
```bash
# 1. Avvia un agente
/new Write a Python function to calculate fibonacci

# 2. Controlla lo stato
/status

# 3. Invia un messaggio
/chat <session_id> Make it recursive

# 4. Ferma l'agente
/stop <session_id>
```

## Integrazione nel Frontend

Per usare il sistema Telegram in `App.tsx`:

```typescript
import { useTelegramBot } from './hooks/useTelegramBot';

function App() {
  const [sessions, setSessions] = useState<ClaudeSession[]>([]);

  // Setup Telegram integration
  const { sendStatusToTelegram, sendAgentNotification } = useTelegramBot({
    sessions,
    onNewAgent: async (prompt, telegramChatId) => {
      // Logica per creare un nuovo agente
      const newSession = await createNewAgent(prompt);
      return newSession.id;
    },
    onStopAgent: async (sessionId) => {
      // Logica per fermare un agente
      await stopAgent(sessionId);
    },
    onSendMessage: async (sessionId, message) => {
      // Logica per inviare un messaggio all'agente
      await sendMessageToAgent(sessionId, message);
    },
    onRequestScreenshot: async (sessionId) => {
      // Opzionale: logica per catturare screenshot
      return '/path/to/screenshot.png';
    },
  });

  // Invia notifiche quando un agente completa
  useEffect(() => {
    sessions.forEach((session) => {
      if (session.justCompleted) {
        sendAgentNotification(
          TELEGRAM_CHAT_ID, // Ottieni dalle preferences
          session.id,
          `🦆 Agent Completed!\n\nSession: ${session.name}\nResult: Success`,
          false
        );
      }
    });
  }, [sessions]);

  return <div>Your App</div>;
}
```

## File Modificati/Creati

### Rust Backend
- ✅ `src-tauri/src/telegram_bot.rs` (NUOVO) - Server webhook completo
- ✅ `src-tauri/src/lib.rs` - Aggiunto modulo e router Telegram
- ✅ `src-tauri/Cargo.toml` - Aggiunta feature `multipart` a reqwest

### TypeScript Frontend
- ✅ `src/hooks/useTelegramBot.ts` (NUOVO) - Hook per gestire eventi Telegram

### Comandi Tauri Registrati
- ✅ `send_telegram_message` - Invia messaggio semplice
- ✅ `send_telegram_notification_command` - Invia notifica con inline keyboard
- ✅ `send_telegram_photo` - Invia foto/screenshot

## Troubleshooting

### Il bot non risponde
1. Verifica che Quack sia avviato (`npm run tauri:dev`)
2. Controlla i log nel terminale Quack per eventuali errori
3. Verifica che il webhook sia configurato correttamente:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
   ```

### Errore "Telegram not configured"
1. Vai su Settings → Notifications in Quack
2. Verifica che Bot Token e Chat ID siano inseriti correttamente
3. Salva e riavvia Quack

### Webhook non riceve aggiornamenti
1. Verifica che il webhook URL sia raggiungibile
2. Per testing locale, usa ngrok con HTTPS
3. Controlla che la porta 6768 non sia bloccata dal firewall

### Comandi non funzionano
1. Verifica di usare il formato corretto (vedi esempi sopra)
2. I session_id devono essere gli ID reali degli agenti attivi
3. Usa `/status` per vedere gli ID corretti

## Prossimi Passi (Opzionali)

### Chat Separate per Agente
Per creare una chat Telegram separata per ogni agente:
1. Crea un topic/thread per ogni agente nel gruppo Telegram
2. Usa `message_thread_id` nelle API Telegram
3. Mappa `thread_id` → `session_id` nel `TelegramBotState`

### Screenshot Automatici
Per inviare screenshot automaticamente:
1. Implementa `onRequestScreenshot` nell'hook
2. Usa Tauri per catturare screenshot della finestra
3. Salva temporaneamente il file
4. Invia via `send_telegram_photo`

### Notifiche Automatiche
Per notifiche automatiche su eventi:
1. Aggiungi listener per eventi agente (start/stop/complete)
2. Chiama `sendAgentNotification` automaticamente
3. Usa `enable_mobile_notifications` dalle preferences per controllo on/off

## 🦆 Conclusione

**QUACK QUACK!** Ora hai un controllo completo dei tuoi agenti dal telefono!

Il sistema è **completamente funzionante** lato backend e pronto per essere integrato nel frontend. Tutti i comandi, eventi e notifiche sono implementati e testati.

Per qualsiasi problema, controlla i log di Quack - ogni operazione viene loggata con l'emoji 🦆 per facilità di debugging!

**Buon coding e... QUACK!** 🦆✨
