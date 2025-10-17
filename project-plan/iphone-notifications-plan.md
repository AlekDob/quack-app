# 📱 Piano: Notifiche iPhone per Chat AI Completate

**Creato**: 2025-01-XX
**Obiettivo**: Implementare notifiche push su iPhone quando una chat AI finisce di rispondere
**Canali**: Telegram Bot + ntfy.sh
**Tempo stimato**: ~2 ore

---

## Architettura Overview

### Flow Completo
```
Chat AI Completa (useClaudeChat)
  ↓
Tauri Command: send_ai_completion_notification
  ↓
Backend Rust (notifications.rs)
  ↓
[Telegram Bot API] + [ntfy.sh API] in parallelo
  ↓
📱 iPhone riceve notifiche push
```

---

## Implementazione - 5 Fasi

### **Phase 1: Backend Notification Module** (~30 min)

**Creare**: `src-tauri/src/notifications.rs`

**Funzionalità**:
- `send_telegram_message(token, chat_id, text)` → POST a `https://api.telegram.org/bot{token}/sendMessage`
- `send_ntfy_notification(topic, title, message)` → POST a `https://ntfy.sh/{topic}`
- `send_ai_completion_notification(app, content)` → Tauri command che orchestra entrambi
- Error handling con logging (non blocca l'app se fallisce)

**Modificare**: `src-tauri/src/lib.rs`
- Aggiungere `mod notifications;`
- Registrare command `send_ai_completion_notification` in `invoke_handler!`

---

### **Phase 2: Preferences Storage** (~20 min)

**Modificare**: `src-tauri/src/preferences.rs`

**Estendere `AppPreferences` struct**:
```rust
pub telegram_bot_token: Option<String>,
pub telegram_chat_id: Option<String>,
pub ntfy_topic: Option<String>,
pub enable_mobile_notifications: bool,
```

**Nuovi Tauri Commands**:
- `set_telegram_config(token, chat_id)`
- `get_telegram_config()`
- `set_ntfy_topic(topic)`
- `get_ntfy_topic()`
- `set_mobile_notifications_enabled(enabled)`

---

### **Phase 3: React Hook Integration** (~15 min)

**Modificare**: `src/hooks/useClaudeChat.ts`

**Linea ~111-129** (quando `chunk.type === 'complete'`):
```typescript
// After setting status to 'complete'

// 🆕 Trigger mobile notification
try {
  await invoke('send_ai_completion_notification', {
    content: assistantContent.substring(0, 100) || 'Chat completed!'
  });
} catch (err) {
  console.warn('[Mobile Notification] Failed:', err);
}

if (options?.onComplete) {
  options.onComplete();
}
```

---

### **Phase 4: UI Settings Panel** (~30 min)

**Creare**: `src/components/NotificationSettings.tsx`

**UI Structure**:
1. **Toggle**: "Enable Mobile Notifications" (master switch)
2. **Telegram Section**:
   - Input: Bot Token (password field)
   - Input: Chat ID
   - Button: "Test Telegram" + Help link "How to setup bot"
3. **ntfy.sh Section**:
   - Input: Topic Name
   - Button: "Test ntfy" + Help link "ntfy.sh docs"

**Integrare in**: `src/components/AISettingsPanel.tsx`
- Aggiungere nuova tab/sezione "Notifications"

**Test Commands** (Rust):
- `send_telegram_test()` → manda "🦆 Quack! Test notification from Quack"
- `send_ntfy_test()` → manda test via ntfy.sh

---

### **Phase 5: Testing & Polish** (~20 min)

**Test Checklist**:
- [ ] Setup Telegram bot via @BotFather
- [ ] Configurare credentials in UI
- [ ] Click "Test Telegram" → verificare notifica iPhone
- [ ] Setup ntfy.sh topic e subscribe da app iOS
- [ ] Click "Test ntfy" → verificare notifica iPhone
- [ ] Mandare messaggio a Claude → aspettare risposta completa → verificare entrambe le notifiche
- [ ] Testare error handling (token errato, topic inesistente)
- [ ] UI polish: loading states, success/error feedback

---

## Setup Guide per Testing

### **1. Telegram Bot** (5 minuti)
1. Aprire Telegram → cercare `@BotFather`
2. Mandare `/newbot` e seguire wizard
3. Copiare il **Bot Token** (es: `123456789:ABC...xyz`)
4. Mandare `/start` al tuo nuovo bot
5. Ottenere **Chat ID**:
   ```bash
   curl https://api.telegram.org/bot<TOKEN>/getUpdates
   ```
   (Cercare il campo `"chat":{"id":12345678}`)
6. Inserire Token e Chat ID in Quack Settings → Notifications

### **2. ntfy.sh** (2 minuti)
1. Installare app **ntfy** da App Store
2. Aprire app → Subscribe → scegliere nome topic unico:
   - Es: `quack-alek-ai-2025` (deve essere univoco)
3. Inserire stesso topic name in Quack Settings → Notifications
4. Done! 🦆

---

## Dependencies

✅ **Già presenti** in `Cargo.toml`:
- `reqwest = { version = "0.12", features = ["json"] }`
- `tokio = { ... }`
- `serde_json = "1.0"`

❌ **Nessuna nuova dependency richiesta!**

---

## Tempo Totale
⏱️ **~2 ore** (implementazione + testing completo)

---

## Vantaggi Soluzione Doppia

| Feature | Telegram | ntfy.sh |
|---------|----------|---------|
| Setup time | 5 min (BotFather) | 2 min (solo topic) |
| Affidabilità | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Interattività | ✅ (button, comandi) | ❌ |
| Storico | ✅ | ❌ |
| Privacy | ✅ (self-hosted bot) | ✅ (self-hostable) |
| App iOS | ✅ Telegram | ✅ ntfy app |

---

## Bonus Features (Future - Opzionali)

- 🔔 **Smart notifications**: Solo se risposta > 30 secondi
- 📊 **Stats panel**: Tempi medi di risposta, token usage
- 🔗 **Deep links**: Tap notifica → apre Quack direttamente
- 🎨 **Rich notifications**: Preview code blocks, immagini
- 🌍 **Multi-device**: Sincronizza notifiche su iPad, Apple Watch

---

## Note Implementazione

### Error Handling Strategy
- Notifiche sono "best effort" - non devono mai bloccare l'app
- Se Telegram fallisce, prova comunque ntfy.sh
- Log errori ma non mostrare alert invasivi all'utente
- Toast discreto se entrambi i canali falliscono

### Security Considerations
- Token Telegram e topic ntfy salvati in `tauri-plugin-store` (criptato)
- Non loggare mai token completi nei log
- Validazione input per prevenire injection

### Performance
- Chiamate HTTP asincrone non bloccanti
- Timeout di 5 secondi per ogni richiesta
- Retry logic con exponential backoff (opzionale per v2)

---

**Quack quack! Piano pronto per l'implementazione! 🦆**
