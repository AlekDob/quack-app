# Contract: Tauri Commands

## Riuso commands esistenti (NESSUNA modifica al loro schema)

### `save_api_key(name: string, value: string) -> Result<(), String>`
Usato con `name` = `"provider:<providerId>"` (es. `"provider:zai"`).
Vincolo: i namespace pre-esistenti (`"openai"`, `"anthropic"`, ecc.) DEVONO continuare a funzionare identici.

### `get_ai_api_key(name: string) -> Result<Option<String>, String>`
Stesso namespacing.

## Nuovo command

### `test_provider_connection`

```rust
#[tauri::command]
pub async fn test_provider_connection(
    base_url: String,
    auth_token: String,
    model: String,
) -> Result<TestConnectionResult, String>;

#[derive(Serialize)]
pub struct TestConnectionResult {
    pub ok: bool,
    pub latency_ms: u64,
    pub model_echo: Option<String>,    // model field dalla response Anthropic
    pub status_code: Option<u16>,
    pub error: Option<String>,
}
```

**Behavior**:
- HTTP `POST {base_url}/v1/messages`
- Headers: `Authorization: Bearer <auth_token>`, `anthropic-version: 2023-06-01`, `content-type: application/json`
- Body: `{ "model": "<model>", "max_tokens": 1, "messages": [{"role":"user","content":"hi"}] }`
- Timeout: 5s
- Misura latency wall-clock dalla richiesta inviata alla prima risposta completata
- `ok=true` se status 2xx; `model_echo` estratto dal campo `model` della response JSON
- `ok=false` se non-2xx o errore rete; `error` con dettaglio

**Non-blocking constraint**: NON deve modificare nessuno stato app; pura funzione di validazione.
