---
type: decision
project: quack-app
created: 2026-05-15
last_verified: 2026-05-15
status: proposed
tags: [architecture, sdk, multi-vendor, codex, claude-agent-sdk, vercel-ai-sdk, abstraction, adapter]
---

# Decision: il layer di astrazione Quack va al LIVELLO AGENTE, non al livello modello

## Status

**Proposed** (2026-05-15). Reply formale al doc di Antonio
`decision-quack-sdk-abstraction-multi-vendor.md` (2026-05-14). Non lo contraddice:
lo **raffina** fissando il livello dove mettere il confine di proprietà Quack, sulla
base di evidenza empirica già in repo (branch `036-vercel-ai-sdk-multi-provider`).

## Context

Tre forze convergono:

1. **15 giugno 2026** — Anthropic separa l'uso Agent SDK dal piano Pro/Max (credito
   dedicato $20–$200/mese, hard pause a esaurimento). I power user di Quack
   esauriranno il credito SDK in fretta. Serve un'alternativa.
2. **Doc Antonio (2026-05-14)** — propone un layer "Quack SDK" multi-vendor con
   adapter Claude/Codex. Architettura corretta, ma lascia aperta una domanda non
   dichiarata: *a che livello di astrazione sta il confine Quack?*
3. **Codex SDK** supporta auth via abbonamento ChatGPT (OAuth `codex login`,
   token in `~/.codex/auth.json`; più API key; più external-token sperimentale).
   Verificato su `developers.openai.com/codex/auth` il 2026-05-15. Significa
   parità economica con Claude Pro pre-15-giugno per il segmento ChatGPT.

## Decisione

**Il layer di astrazione Quack-owned sta al LIVELLO AGENTE.**

- Quack possiede: `interface QuackSDK` (contratto), capability registry, event
  translator → `QuackEvent`, cost normalizer, orchestrazione multi-step.
- Ogni backend sotto il layer è un **harness agentico già completo**: Claude Agent
  SDK, Codex SDK. Loop dell'agente, permission, MCP, planning li fa l'SDK vendor.
- Gli adapter sono **wrapper sottili** sopra SDK agentici, NON reimplementazioni di
  primitive agentiche sopra model API grezze.

**Scartato esplicitamente: il livello modello** (Vercel AI SDK / HTTP raw come base
universale vendor-neutral).

## Evidenza empirica: branch `036-vercel-ai-sdk-multi-provider`

Abbiamo già tentato il livello modello. Il branch `036` ha provato l'astrazione
sul Vercel AI SDK come base vendor-neutrale. Dati misurati (`git diff main...origin/036`):

- **4.601 righe aggiunte**, mai arrivate in main.
- `src-tauri/node-sdk/vercel-tools.js` — **418 righe** che reimplementano a mano
  `safePath`, `grepFiles`, `applyUnifiedPatch`, `stripHtml` = i tool Read / Bash /
  Grep / Edit / WebFetch da zero.
- `src-tauri/node-sdk/vercel-mcp.js` — **150 righe** di bridge MCP custom.

Causa strutturale del fallimento, non di esecuzione:

> Il Vercel AI SDK è un SDK di **completion + tool-calling**, non un **harness
> agentico**. Dà "prompt in → testo + tool-call JSON". Loop dell'agente, sistema
> di permission, orchestrazione MCP, subagent, planning, hook: tutto da
> ricostruire. 4.600 righe dopo, ancora incompleto.

**Aggravante (2026-05-15):** le parti del 036 che sembravano riusabili
(`providerService.ts` fetch-based, `ModelsSettings.tsx` 437 righe) sono **già
superate** dal lavoro 037-anthropic-compatible-providers di ieri. Main ha ora un
`providerService.ts` Tauri-backed con chiavi namespaced, più `providerEnvBuilder.ts`,
`sessionProviderOverrides.ts` e UI completa (`ProviderManager`, `ProviderCard`,
`ProviderAddModal`, `ProviderTestButton`). Del 036 non si recupera codice: si
recupera **solo la lezione**.

## I due livelli, formalizzati

| | Livello MODELLO (036) | Livello AGENTE (questa decisione) |
|---|---|---|
| Cosa Quack possiede | TUTTO l'agente | Solo contratto + normalizzazione |
| Base sottostante | Model API / Vercel AI SDK | Claude Agent SDK, Codex SDK |
| Da ricostruire | loop, permission, MCP, subagent, planning, hook | nulla — lo fa l'SDK vendor |
| Costo misurato | 4.600 righe, incompleto, non shippato | interface + translator + capability gates |
| Vendor-neutrality | totale | per-capability (gate dinamici) |
| Verdetto | **scartato** | **adottato** |

## Implicazioni sui limiti Codex (eredita dal doc Antonio)

I limiti Codex restano e si gestiscono con **capability gates**, non con
reimplementazione:

- `customTools` in-process: NO su Codex → tutti i tool custom Quack via MCP.
- `canUseTool` per-chiamata: assente su Codex → UX permission degradata
  (mappa Plan = sandbox `read-only` + approval `on-request`). Fedeltà ridotta accettata.
- subagent / Task tool: assente su Codex → team mode, background agents restano
  **Claude-only**, nascosti via capability gate quando l'adapter è Codex.
- Event mapping lossy (turn.*/item.* più coarse dei content block Claude).
- Codex SDK = wrapper di CLI → bundle binario per-piattaforma (~100–200MB),
  notarization Apple, auto-update separato. **Unico vero collo di bottiglia umano.**

Nessuno di questi giustifica il livello modello: ricostruire l'agente per evitare
i gate Codex costa molto di più dei gate stessi (vedi 036).

> **Addendum — RETTIFICATO (2026-05-18).** Una versione precedente di questo
> addendum (2026-05-17) affermava che "subagent assente su Codex" era
> *empiricamente confermato*. **Era sbagliato**: il test girava su un `codex
> 0.42.0` obsoleto (Homebrew-stale; ultima 0.130.0) con spike mal
> configurato. Ri-verificato dal vivo su **codex-cli 0.130.0**: i **subagent
> FUNZIONANO** in `codex exec` (`.codex/agents/*.toml` → eventi
> `collab_tool_call`/`spawn_agent`/`wait`, thread figli). Quindi: il confine
> resta agent-level, ma "subagent su Codex" NON è più un'impossibilità da
> gate — è una scelta di prodotto. Le **skill** non hanno discovery nativa
> locale in `exec` (ma 0.130 le espone via risorse MCP); **AGENTS.md** ok.
> Matrice completa, version-pinned, + i 4 breaking change 0.42→0.130 (flag
> `--json`, stdin da chiudere, schema `thread/turn/item.type`, usage
> in-stream): `documentation/research/codex-exec-capability-matrix.md`.
> Lezione: **mai dichiarare una capability Codex senza fissare la versione.**

## Cosa si salva e cosa si butta

| Artefatto | Origine | Destino |
|---|---|---|
| `providerService.ts` (Tauri, namespaced) | main 037 | **tieni** — base per adapter auth |
| `providerEnvBuilder.ts`, `sessionProviderOverrides.ts` | main 037 | **tieni** |
| `ProviderManager/Card/AddModal/TestButton` | main 037 | **tieni** — UI provider già pronta |
| `vercel-tools.js` (418 righe) | branch 036 | **butta** — primitive che SDK danno gratis |
| `vercel-mcp.js` (150 righe) | branch 036 | **butta** — MCP lo fa l'SDK |
| `ModelsSettings.tsx` (437 righe) | branch 036 | **butta** — superato da ProviderManager 037 |
| Lezione "no livello modello" | branch 036 | **questo documento** |

## Roadmap (AI-velocity, ricalibrata)

Lo stack 037 di ieri è la fondazione. Sopra:

| Giorno | Output |
|---|---|
| 1 | Spike Codex CLI: spawn `codex exec --json`, validare schema eventi + OAuth ChatGPT |
| 1–2 | OpenAI-compatible providers (DeepSeek, Qwen, Groq) — riuso pattern 037, copre il 15 giugno |
| 3–4 | Refactor daemon: estrarre `QuackSDK`/`AgentBackend` interface + `ClaudeAdapter` + `MockAdapter` (zero feature nuove, zero regressioni Claude) |
| 5–7 | `CodexAdapter` end-to-end con OAuth ChatGPT subscription + event translator |
| 8–9 | Capability gates UI + cost tracker unificato + Settings 2-vendor |
| 10–12 | `QuackOrchestrator` manual mode (single backend/sessione, switch tra sessioni) |
| 13–14 | Bundle `codex` binario per-piattaforma + notarization Apple (collo di bottiglia umano) |

## Open Questions (ereditate, da chiudere prima del 15 giugno)

| Domanda | Quando |
|---|---|
| API key Console pay-as-you-go è fuori dal credit-cap SDK? (telefonata/email Anthropic, non codice) | Pre-Fase 3, urgente |
| Posizionamento: "best Claude UX con fallback" vs "IDE universale"? | Post-spike |
| Domanda reale utenti per Codex o scelta difensiva? (waitlist toggle in Settings come signal) | Pre-Fase 4 |
| Auto-fallback su exhaustion: automatico o consenso utente? | Fase orchestrator |

## Decisioni alternative scartate

- **Livello modello (Vercel AI SDK / HTTP raw)** — branch 036: 4.600 righe,
  incompleto, parti riusabili già superate da 037. Evidenza empirica decisiva.
- **Restare mono-vendor Claude** — incassa lock-in dopo il 15 giugno, non risolve
  TCO power user.
- **Astrazione in Rust (N daemon)** — raddoppia manutenzione, SDK vendor TS-native.

## Sources

- Codex auth (subscription): https://developers.openai.com/codex/auth (verificato 2026-05-15)
- Codex pricing/plan: https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan
- Anthropic billing change: https://www.xda-developers.com/anthropics-claude-subscriptions-no-longer-include-agent-sdk-and-claude-p-usage/
- Brain correlati:
  - `documentation/decisions/decision-quack-sdk-abstraction-multi-vendor.md` (doc Antonio, questo lo raffina)
  - `documentation/decisions/decision-anthropic-third-party-harness-policy.md`
  - `documentation/patterns/pattern-anthropic-compatible-providers.md` (stack 037)
  - `documentation/patterns/pattern-multi-provider-llm.md`
- Evidenza in-repo: branch `origin/036-vercel-ai-sdk-multi-provider` (`git diff main...origin/036`)

## Brain breadcrumb

Quando si scriverà il codice di Fase 3+, marcare con
`// Brain: decision-quack-abstraction-agent-level-not-model-level` i punti:
- definizione `QuackSDK` / `AgentBackend` interface
- `ClaudeAdapter` constructor (refactor daemon esistente)
- `CodexAdapter` constructor
- capability gates in React UI (punti dove si nasconde team/subagent su Codex)
