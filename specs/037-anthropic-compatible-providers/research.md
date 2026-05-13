# Research: Anthropic-Compatible Providers

## R1 — Env vars rilevati dalla Claude Agent SDK

**Decision**: SDK rispetta in ordine di precedenza `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `ANTHROPIC_MODEL`. Quando settato `ANTHROPIC_AUTH_TOKEN`, l'SDK manda `Authorization: Bearer <token>` invece di `x-api-key`. Tutti i provider compatibili accettano `Authorization: Bearer`.

**Rationale**: documentato in z.ai docs e MiniMax docs, confermato dal pattern del repo `Alorse/cc-compatible-models`.

**Alternatives**: proxy locale tipo LiteLLM — rifiutato (più complessità, processo extra).

## R2 — Preset built-in (URL + modelli)

| Provider | `baseUrl` | `sonnetModel` | `haikuModel` | Context window | Auth header |
|---|---|---|---|---|---|
| Anthropic | (vuoto, default SDK) | — | — | 200k / 1M (Opus) | x-api-key o Bearer (OAuth) |
| Z.AI | `https://api.z.ai/api/anthropic` | `glm-4.6` | `glm-4.5-air` | 200k | Bearer |
| MiniMax | `https://api.minimax.io/anthropic` | `MiniMax-M2` | `MiniMax-M2` | 1M | Bearer |
| Kimi (Moonshot) | `https://api.moonshot.ai/anthropic` | `kimi-k2-0905-preview` | `kimi-k2-0905-preview` | 256k | Bearer |
| Qwen DashScope | `https://dashscope-intl.aliyuncs.com/apps/anthropic` | `qwen3.6-plus` | `qwen3.6-flash` | 256k | Bearer |
| DeepSeek (SiliconFlow) | `https://api.siliconflow.com/` | `deepseek-ai/DeepSeek-V3.2` | `deepseek-ai/DeepSeek-V3.2` | 128k | Bearer |

**Decision**: shippare in `src/constants/providerPresets.ts` come oggetto immutable. Versionato come parte del codice, aggiornabile via release.

**Rationale**: tutti i provider verificati offrono endpoint Anthropic-compatible documentato (vedi spec).

## R3 — Storage strategy (vincolo non-regressione)

**Decision**: 
- API key tramite `save_api_key(name: "provider:<id>", value)` / `get_ai_api_key(name: "provider:<id>")` — Tauri commands esistenti.
- Provider metadata (id, baseUrl, modelli per custom; preferenze) in `settingsStore` Zustand persist (`settings-storage` v12).
- Default attivo: `claude.activeProvider: ActiveProviderState` in store.
- Override per-sessione: salvato in `sessionStore` come `session.providerOverride?: string` (providerId) — NON persisted (vive solo finché la sessione esiste).

**Rationale**: zero nuovi storage backend; namespacing additive; OpenAI key esistente (`name: "openai"` o simile) NON tocca.

**Alternatives**: Tauri Store plugin separato — rifiutato (frammentazione).

## R4 — Migration v11 → v12

**Decision**: aggiungere case `v11 → v12` in `settingsStore.ts` migration chain:
1. Se `claude.provider === "Anthropic"` → `claude.activeProvider = { kind: "anthropic" }`.
2. Se `claude.provider === "Custom"` (legacy custom URL) → crea CustomProvider `legacy-custom` con baseUrl/modelli da campi esistenti, `claude.activeProvider = { kind: "custom", providerId: "legacy-custom" }`, `claude.customProviders = [legacy-custom]`.
3. Se `claude.provider === "Ollama"` → `claude.activeProvider = { kind: "anthropic" }` (Ollama rimane gestito altrove, non passa per questo sistema).
4. Initialize `claude.customProviders = []` se assente.

**Rationale**: zero data loss, zero re-input richiesto all'utente.

## R5 — Spawn injection (Rust → Node)

**Decision**: Rust legge `ActiveProviderState` (incluso override sessione) e costruisce un JSON `QUACK_PROVIDER_CONFIG`:
```json
{ "baseUrl": "...", "authToken": "...", "sonnetModel": "...", "haikuModel": "..." }
```
Lo passa come env al child Node process. `stream-claude.js` / `stream-daemon.js` parsano e ri-esportano come env Anthropic standard prima di lanciare l'SDK.

**Alternative**: passare 4 env separate — rifiutato per evitare confusione con env Anthropic settate da OS/shell dell'utente.

**Rationale**: container env isolato, naming Quack-specifico evita collisioni.

## R6 — Test connection implementation

**Decision**: Tauri command `test_provider_connection(base_url, auth_token, model)` in Rust che fa `POST {base_url}/v1/messages` con body minimale:
```json
{ "model": "<model>", "max_tokens": 1, "messages": [{"role": "user", "content": "hi"}] }
```
Header: `Authorization: Bearer <token>`, `anthropic-version: 2023-06-01`, `content-type: application/json`. Timeout 5s. Ritorna `{ ok, latencyMs, modelEcho, error? }`.

**Rationale**: Rust ha già `reqwest`; il test non passa per Node SDK (più veloce, isolato, niente spawn).

## R7 — Coesistenza Bedrock + Custom Provider

**Decision**: enum `ActiveProviderState` con tre varianti `anthropic | bedrock | custom`. UI: radio group nella sezione "LLM Provider" di `ClaudeCodeSettings`. Attivare custom disabilita il toggle Bedrock (e ripristina al deselezionare).

**Rationale**: già FR-008. Pattern già usato altrove (modi mutex).

## Outstanding

Nessuno. Tutti i NEEDS CLARIFICATION risolti.
