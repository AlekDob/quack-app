# Data Model

## Types (TypeScript)

```ts
// src/types/providers.ts

export type ProviderKind = "anthropic" | "bedrock" | "custom";

export interface ProviderPreset {
  id: string;                 // "anthropic" | "zai" | "minimax" | "kimi" | "qwen" | "deepseek"
  name: string;               // "Z.AI (GLM-4.6)"
  baseUrl: string;            // "" per Anthropic ufficiale (default SDK)
  sonnetModel: string;
  haikuModel: string;
  defaultModel?: string;
  contextWindow: number;      // bytes / tokens (default 200000)
  docsUrl: string;
  isBuiltIn: true;
}

export interface CustomProvider {
  id: string;                 // uuid o "legacy-custom" per migration
  name: string;
  baseUrl: string;
  sonnetModel: string;
  haikuModel: string;
  defaultModel?: string;
  contextWindow: number;
  notes?: string;
  isBuiltIn: false;
  createdAt: number;          // unix ms
}

export type ProviderEntry = ProviderPreset | CustomProvider;

export type ActiveProviderState =
  | { kind: "anthropic" }
  | { kind: "bedrock"; region: string; modelId: string }
  | { kind: "custom"; providerId: string };

// Lo state del store si estende così:
export interface ClaudeSettingsV12 {
  // ...campi pre-esistenti
  activeProvider: ActiveProviderState;
  customProviders: CustomProvider[];
  // NB: il vecchio campo `provider: LLMProviderType` viene rimosso dopo migration
}

// Per-sessione (non persisted, vive in sessionStore)
export interface SessionProviderOverride {
  providerId: string;         // riferimento a preset.id o CustomProvider.id
  // resolto al momento dello spawn; congelato per tutta la vita della sessione
}
```

## Validation Rules

- `CustomProvider.baseUrl` MUST iniziare con `https://` (o `http://localhost`).
- `CustomProvider.sonnetModel` e `haikuModel` non vuoti.
- `CustomProvider.contextWindow` ≥ 4096.
- `ActiveProviderState.providerId` (se `kind=custom`) MUST esistere in `customProviders` OR in `BUILTIN_PRESETS`. Se invalido → fallback a `{ kind: "anthropic" }`.
- Esattamente UN `ActiveProviderState.kind` può essere attivo per default; per-session override segue stessa regola.

## State Transitions

```
[default: anthropic] --select Z.AI--> [default: custom(zai)] --add custom MyProxy--> [customProviders += MyProxy]
                                                              --switch session A--> [session A override=zai, default still zai]
                                                              --new session B no override--> [session B uses zai]
                                                              --delete zai (built-in NOT deletable)--> NO-OP / error
                                                              --delete MyProxy while default--> [default fallback anthropic]
                                                              --enable Bedrock--> [default: bedrock, custom/zai disabilitati]
```

## Migration v11 → v12

```ts
// src/stores/settingsStore.ts
case 11: {
  const legacyProvider = state.claude.provider; // "Anthropic" | "Ollama" | "Custom"
  let activeProvider: ActiveProviderState;
  const customProviders: CustomProvider[] = [];

  if (legacyProvider === "Custom" && state.claude.customBaseUrl) {
    const legacy: CustomProvider = {
      id: "legacy-custom",
      name: "Legacy Custom",
      baseUrl: state.claude.customBaseUrl,
      sonnetModel: state.claude.customSonnetModel || "claude-sonnet-4-5",
      haikuModel: state.claude.customHaikuModel || "claude-haiku-4-5",
      contextWindow: 200000,
      isBuiltIn: false,
      createdAt: Date.now(),
    };
    customProviders.push(legacy);
    activeProvider = { kind: "custom", providerId: "legacy-custom" };
  } else if (state.claude.useBedrock) {
    activeProvider = { kind: "bedrock", region: state.claude.bedrockRegion, modelId: state.claude.bedrockModel };
  } else {
    activeProvider = { kind: "anthropic" };
  }

  state.claude.activeProvider = activeProvider;
  state.claude.customProviders = customProviders;
  delete state.claude.provider;
  delete state.claude.customBaseUrl;
  // (mantieni customSonnetModel/customHaikuModel come legacy se servono ma non più letti)
}
```

## Entities Relationship

```
ClaudeSettings (1) ─── (1) ActiveProviderState
              (1) ─── (0..N) CustomProvider
ProviderPreset (BUILTIN_PRESETS) ─── (read-only, code-shipped)
Session (1) ─── (0..1) SessionProviderOverride ──► (refs) ProviderPreset | CustomProvider
```
