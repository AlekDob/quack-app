# Contract: SDK Env Vars Injection

## Da Rust al child Node process

Quando si spawna il processo SDK (`stream-claude.js` o `stream-daemon.js`), Rust risolve l'`ActiveProviderState` (incluso override sessione se presente) e setta SOLO una env var Quack-specifica:

```
QUACK_PROVIDER_CONFIG={"baseUrl":"https://api.z.ai/api/anthropic","authToken":"sk-...","sonnetModel":"glm-4.6","haikuModel":"glm-4.5-air","contextWindow":200000}
```

**Casi**:
- `ActiveProviderState.kind === "anthropic"` → NON settare `QUACK_PROVIDER_CONFIG`. Il processo Node usa l'env Anthropic standard (OAuth o `ANTHROPIC_API_KEY` dal Tauri secure storage, già wired oggi).
- `ActiveProviderState.kind === "bedrock"` → wiring esistente Bedrock (env `CLAUDE_CODE_USE_BEDROCK=1` + AWS env). Custom provider env NON co-presenti.
- `ActiveProviderState.kind === "custom"` → setta `QUACK_PROVIDER_CONFIG` con il JSON sopra.

## Da Node child a Anthropic SDK

In testa a `stream-claude.js` / `stream-daemon.js` (DOPO il setup esistente, PRIMA dell'import dell'SDK):

```js
const providerConfig = process.env.QUACK_PROVIDER_CONFIG;
if (providerConfig) {
  try {
    const cfg = JSON.parse(providerConfig);
    process.env.ANTHROPIC_BASE_URL = cfg.baseUrl;
    process.env.ANTHROPIC_AUTH_TOKEN = cfg.authToken;
    if (cfg.sonnetModel) process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = cfg.sonnetModel;
    if (cfg.haikuModel) process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = cfg.haikuModel;
    if (cfg.defaultModel) process.env.ANTHROPIC_MODEL = cfg.defaultModel;
    delete process.env.ANTHROPIC_API_KEY; // evita conflitti (Bearer vs x-api-key)
  } catch (err) {
    console.error("[provider-config] parse error:", err);
    process.exit(1);
  }
}
```

## Invarianti

1. `QUACK_PROVIDER_CONFIG` MAI presente in processi con `ActiveProviderState.kind=anthropic|bedrock`.
2. Settarlo NON modifica il PATH, PWD, o altre env critiche al ChildProcess.
3. `authToken` MAI loggato — quando il child logga `QUACK_PROVIDER_CONFIG`, MUST mascherare (`***`).
4. Override per-sessione vince sul default globale al momento dello spawn. Una volta spawnato, il provider è frozen per quella sessione fino al kill.
