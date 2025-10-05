# AI Assistant Integration - OpenAI Command Helper & Error Analyzer

**Status**: 📋 Planning Complete - Ready for Implementation
**Created**: 2025-10-05
**Type**: Feature Implementation
**Estimated Duration**: 4-5 giorni

## 🎯 Obiettivi

1. **AI Command Assistant**: Premere `#` nel terminale → AI capisce l'intento e suggerisce comandi
2. **Auto Error Analyzer**: AI analizza errori del terminale e suggerisce fix automaticamente

## 🏗️ Architettura

### Backend (Rust)

#### Nuovo Modulo: `src-tauri/src/ai.rs`

**Strutture Dati**:
```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct AIRequest {
    pub intent: String,           // "install prettier"
    pub context: TerminalContext, // OS, shell, cwd, history
    pub request_type: String,     // "command" | "error"
}

#[derive(Serialize, Deserialize)]
pub struct TerminalContext {
    pub os: String,              // "macos", "linux", "windows"
    pub shell: String,           // "zsh", "bash", "fish"
    pub cwd: String,             // directory corrente
    pub recent_commands: Vec<String>, // ultimi 5 comandi
    pub error_output: Option<String>, // se type = "error"
}

#[derive(Serialize, Clone)]
pub struct AISuggestion {
    pub command: String,          // "npm install -D prettier"
    pub explanation: String,      // "Installa Prettier come dev dependency"
    pub confidence: f32,          // 0.0 - 1.0
    pub alternative: Option<String>, // comando alternativo
}

#[derive(Serialize, Deserialize)]
struct OpenAIMessage {
    role: String,    // "system" | "user" | "assistant"
    content: String,
}

#[derive(Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<OpenAIMessage>,
    temperature: f32,
    max_tokens: u32,
}

#[derive(Deserialize)]
struct OpenAIResponse {
    choices: Vec<OpenAIChoice>,
    usage: OpenAIUsage,
}

#[derive(Deserialize)]
struct OpenAIChoice {
    message: OpenAIMessage,
}

#[derive(Deserialize)]
struct OpenAIUsage {
    total_tokens: u32,
}
```

**Comandi Tauri**:
- `get_ai_suggestion(request: AIRequest) -> Result<AISuggestion>`
- `analyze_error(error_text: String, context: TerminalContext) -> Result<AISuggestion>`
- `save_api_key(key: String) -> Result<()>`
- `test_api_connection() -> Result<bool>`
- `get_token_usage_stats() -> TokenStats`

**OpenAI Client**:
```rust
use reqwest::Client;
use serde_json::json;

async fn call_openai(prompt: String, context: TerminalContext, model: &str) -> Result<String> {
    let api_key = get_stored_api_key()?;

    let client = Client::new();
    let system_prompt = build_system_prompt(&context);

    let body = OpenAIRequest {
        model: model.to_string(),
        messages: vec![
            OpenAIMessage {
                role: "system".to_string(),
                content: system_prompt,
            },
            OpenAIMessage {
                role: "user".to_string(),
                content: prompt,
            },
        ],
        temperature: 0.3, // più deterministico per comandi
        max_tokens: 500,
    };

    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await?
        .json::<OpenAIResponse>()
        .await?;

    // Save token usage
    track_token_usage(response.usage.total_tokens);

    Ok(response.choices[0].message.content.clone())
}
```

**Prompt Templates**:
```rust
fn build_system_prompt(context: &TerminalContext) -> String {
    format!(
        r#"Sei un assistente esperto di comandi terminal per {os}.
Shell: {shell}
Directory: {cwd}

Il tuo compito è suggerire comandi terminal precisi basati sull'intento dell'utente.

Rispondi SOLO in formato JSON:
{{
  "command": "comando esatto da eseguire",
  "explanation": "breve spiegazione (max 100 caratteri)",
  "confidence": 0.95,
  "alternative": "comando alternativo (opzionale)"
}}

Esempi:
- Intent: "install prettier" → {{"command": "npm install -D prettier", "explanation": "Installa Prettier come dev dependency", "confidence": 0.98}}
- Intent: "list files" → {{"command": "ls -la", "explanation": "Mostra tutti i file inclusi nascosti", "confidence": 1.0}}
- Intent: "run dev server" → {{"command": "npm run dev", "explanation": "Avvia development server", "confidence": 0.90}}

Contesto comandi recenti:
{recent_commands}
"#,
        os = context.os,
        shell = context.shell,
        cwd = context.cwd,
        recent_commands = context.recent_commands.join("\n")
    )
}

fn build_error_analysis_prompt(error: &str, context: &TerminalContext) -> String {
    format!(
        r#"Analizza questo errore terminal e suggerisci una soluzione:

ERRORE:
{error}

CONTESTO:
OS: {os}
Shell: {shell}
Directory: {cwd}
Comandi recenti: {recent_commands}

Rispondi in formato JSON:
{{
  "command": "comando per risolvere (se applicabile)",
  "explanation": "spiegazione chiara del problema e della soluzione",
  "confidence": 0.85
}}
"#,
        error = error,
        os = context.os,
        shell = context.shell,
        cwd = context.cwd,
        recent_commands = context.recent_commands.join(" → ")
    )
}
```

**API Key Storage** (secure con tauri-plugin-store):
```rust
use tauri_plugin_store::StoreExt;

fn save_api_key(app: AppHandle, key: String) -> Result<()> {
    let store = app.store("ai-config.json")?;

    // Encode base64 per basic obfuscation
    let encoded = base64::encode(key.as_bytes());
    store.set("openai_api_key", json!(encoded));
    store.save()?;

    Ok(())
}

fn get_stored_api_key(app: &AppHandle) -> Result<String> {
    let store = app.store("ai-config.json")?;

    let encoded = store
        .get("openai_api_key")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("API key not configured"))?;

    let decoded = base64::decode(encoded)?;
    Ok(String::from_utf8(decoded)?)
}
```

**Rate Limiting & Caching**:
```rust
use std::collections::HashMap;
use std::time::{Duration, Instant};

struct RateLimiter {
    requests: Vec<Instant>,
    max_per_minute: usize,
}

impl RateLimiter {
    fn can_proceed(&mut self) -> bool {
        let now = Instant::now();
        let one_minute_ago = now - Duration::from_secs(60);

        // Rimuovi richieste vecchie
        self.requests.retain(|&time| time > one_minute_ago);

        if self.requests.len() < self.max_per_minute {
            self.requests.push(now);
            true
        } else {
            false
        }
    }
}

static RATE_LIMITER: Lazy<Mutex<RateLimiter>> = Lazy::new(|| {
    Mutex::new(RateLimiter {
        requests: Vec::new(),
        max_per_minute: 10,
    })
});

// Cache semplice (intent → suggestion)
static SUGGESTION_CACHE: Lazy<Mutex<HashMap<String, (AISuggestion, Instant)>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

fn get_cached_suggestion(intent: &str) -> Option<AISuggestion> {
    let cache = SUGGESTION_CACHE.lock().unwrap();
    if let Some((suggestion, timestamp)) = cache.get(intent) {
        // Cache valida per 1 ora
        if timestamp.elapsed() < Duration::from_secs(3600) {
            return Some(suggestion.clone());
        }
    }
    None
}
```

#### Estensione: `src-tauri/src/terminal.rs`

**Tracking comandi eseguiti**:
```rust
struct TerminalSession {
    // ... campi esistenti
    command_history: Vec<String>,  // ultimi 10 comandi
    last_error: Option<String>,    // ultimo errore rilevato
}
```

**Error Pattern Detection**:
```rust
fn detect_error_patterns(output: &str) -> Option<String> {
    let error_patterns = [
        r"error:|ERROR:",
        r"command not found",
        r"npm ERR!",
        r"fatal:",
        r"panic!",
        r"Exception",
        r"Traceback",
    ];

    for pattern in &error_patterns {
        if let Ok(regex) = Regex::new(pattern) {
            if regex.is_match(output) {
                // Estrai le ultime 10 righe come contesto errore
                let lines: Vec<&str> = output.lines().collect();
                let context_lines = lines.iter().rev().take(10).rev().collect::<Vec<_>>();
                return Some(context_lines.join("\n"));
            }
        }
    }
    None
}
```

### Frontend (React + TypeScript)

#### Nuovo File: `src/types.ts` (estensione)

```typescript
export interface AISuggestion {
  command: string;
  explanation: string;
  confidence: number;
  alternative?: string;
}

export interface AISettings {
  apiKey: string;
  model: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo';
  enableCommandAssistant: boolean;
  enableErrorAnalyzer: boolean;
}

export interface TokenStats {
  totalTokensUsed: number;
  estimatedCost: number; // in USD
  requestCount: number;
}
```

#### Componenti (vedere file separati per codice completo)

1. **`src/components/AIAssistant.tsx`** - Modal per suggestions
2. **`src/components/ErrorAnalyzer.tsx`** - Analisi errori inline
3. **`src/components/AISettings.tsx`** - Panel settings AI
4. **`src/components/TerminalView.tsx`** - Modifiche per trigger `#`

### Styling (CSS)

Vedere `src/App.css` - sezione AI Components per:
- `.ai-assistant-overlay` - Modal overlay
- `.ai-suggestion` - Card suggestions
- `.error-analyzer-inline` - Errori inline
- `.ai-settings-panel` - Settings panel

## 📋 Flow di Implementazione

### Fase 1: Backend AI Core (1 giorno)
1. ✅ Aggiungere dipendenze Rust (`reqwest`, `base64`)
2. ✅ Creare `src-tauri/src/ai.rs` con strutture dati
3. ✅ Implementare OpenAI client e prompt templates
4. ✅ Implementare API key storage (tauri-plugin-store)
5. ✅ Implementare rate limiting & caching
6. ✅ Registrare comandi in `lib.rs`
7. ✅ Testing con curl/Postman

**Testing**:
- Test connessione OpenAI con API key
- Test rate limiting (>10 req/min → blocco)
- Test caching (stessa query → no nuova chiamata)

### Fase 2: Command Assistant UI (1 giorno)
1. ✅ Creare `AIAssistant.tsx` component
2. ✅ Modificare `TerminalView.tsx` per intercettare `#`
3. ✅ Input buffer tracking per catturare "intent"
4. ✅ Integration backend → frontend
5. ✅ Styling modal e animazioni
6. ✅ Keyboard shortcuts (Esc to close, Enter to execute)

**Testing**:
- `#install prettier` → mostra comando `npm install -D prettier`
- `#run dev server` → mostra `npm run dev` o `npm run tauri:dev`
- `#list files hidden` → mostra `ls -la`

### Fase 3: Error Analyzer (1 giorno)
1. ✅ Implementare error pattern detection in `terminal.rs`
2. ✅ Creare `ErrorAnalyzer.tsx` component
3. ✅ Auto-trigger on error detection
4. ✅ Inline suggestions UI sotto errori
5. ✅ Copy to clipboard functionality

**Testing**:
- Eseguire comando errato (`npm run nonexistent`) → AI spiega errore
- Error `MODULE_NOT_FOUND` → AI suggerisce `npm install`
- Python traceback → AI analizza e suggerisce fix

### Fase 4: Settings & Polish (1 giorno)
1. ✅ Creare `AISettings.tsx` panel
2. ✅ API key input con test connection
3. ✅ Model selection dropdown
4. ✅ Enable/disable toggles
5. ✅ Token usage tracking e cost display
6. ✅ Integrate settings in App sidebar

**Testing**:
- Salva API key → test connection → success/error feedback
- Toggle features → verify enabled/disabled
- View token usage stats

### Fase 5: Testing & Docs (0.5 giorni)
1. ✅ Test completi su comandi reali
2. ✅ Edge cases (API down, invalid key, rate limit)
3. ✅ Update `CLAUDE.md` documentation
4. ✅ Create usage examples in `resources/`

## 🎯 Modelli OpenAI Consigliati

### GPT-4o Mini (RECOMMENDED)
- **Prezzo**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **Use case**: Command suggestions (veloce, economico, accurato)
- **Latency**: < 1 secondo
- **Costo stimato**: ~$0.10/giorno con 50 query

### GPT-4o
- **Prezzo**: ~$2.50 per 1M input tokens, ~$10.00 per 1M output tokens
- **Use case**: Error analysis complessi (più potente)
- **Latency**: 1-2 secondi
- **Costo stimato**: ~$0.50/giorno con 20 error analysis

### GPT-3.5 Turbo (Budget)
- **Prezzo**: ~$0.50 per 1M input tokens, ~$1.50 per 1M output tokens
- **Use case**: Fallback se budget limitato
- **Accuratezza**: ~80% vs 95% di GPT-4o-mini

## 🛡️ Sicurezza & Privacy

1. **API Key Storage**:
   - Base64 encoding (obfuscation, non encryption vera)
   - Stored in `tauri-plugin-store` (locale, non cloud)
   - Mai inviata a server esterni

2. **Rate Limiting**:
   - Max 10 richieste/minuto
   - Cache aggressive (1 ora per stessa query)
   - Evita costi imprevisti

3. **Error Handling**:
   - Fallback graceful se API down
   - No block del terminale se AI fallisce
   - User feedback chiaro su errori

## 📊 Success Metrics

✅ **Funzionalità**:
- `#<intent>` → AI suggestion in < 2 secondi
- Error detection → Auto-analysis con 90%+ accuracy
- API key management → Secure storage & validation

✅ **Performance**:
- Latency < 2s per command suggestions
- Latency < 3s per error analysis
- Cache hit rate > 40%

✅ **Costi**:
- < $1/giorno con uso normale (50-100 queries)
- Token tracking preciso
- User control su spesa (rate limits)

## 📦 Deliverables

✅ **Backend**:
- `src-tauri/src/ai.rs` (nuovo)
- `src-tauri/Cargo.toml` (dipendenze aggiunte: reqwest, base64)
- `src-tauri/src/lib.rs` (comandi registrati)

✅ **Frontend**:
- `src/components/AIAssistant.tsx` (nuovo)
- `src/components/ErrorAnalyzer.tsx` (nuovo)
- `src/components/AISettings.tsx` (nuovo)
- `src/components/TerminalView.tsx` (modificato)
- `src/types.ts` (esteso)

✅ **Styling**:
- `src/App.css` (AI components styles)

✅ **Documentazione**:
- `project-plan/ai-assistant-integration/summary.md` ✅
- `project-plan/ai-assistant-integration/prompts.md` ✅
- `project-plan/ai-assistant-integration/testing.md` ✅
- `CLAUDE.md` (updated con AI features)

## 🔄 Future Enhancements (Post-MVP)

1. **Context-Aware Suggestions**:
   - Analisi `package.json` per suggerire comandi npm disponibili
   - Git status integration per suggerimenti git context-aware
   - Project type detection (React/Vue/Node/Rust) per comandi specifici

2. **Learning System**:
   - Track user selections (accepted vs rejected suggestions)
   - Fine-tune prompt templates basati su feedback
   - Personal command history per suggestions migliorate

3. **Multi-Language Support**:
   - Italiano per AI responses
   - Automatic language detection

4. **Advanced Error Fixing**:
   - Auto-fix con conferma user (not just suggestions)
   - Multi-step fix procedures
   - Integration con GitHub Issues search per errori comuni

---

**Status**: 📋 Planning Complete - Ready for Implementation
**Team**: Jack (coordination) + John (Rust backend) + Julie (React UI)
**Quack Level**: 🦆🦆🦆🦆🦆 (Maximum Duck Energy!)
