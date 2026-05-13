# Implementation Plan: Anthropic-Compatible Custom Providers

**Branch**: `037-anthropic-compatible-providers` | **Date**: 2026-05-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/037-anthropic-compatible-providers/spec.md`

## Summary

Estendere il sistema provider di Quack (oggi: `Anthropic` / `Ollama` / `Custom` hardcoded) con un registro di **Anthropic-compatible providers** (z.ai, MiniMax, Kimi, Qwen, DeepSeek) gestibile da UI. Il provider è **per-sessione** con default globale; le API key sono salvate via `save_api_key` namespaced (`provider:<id>`); preset built-in read-only con azione "Duplica come custom"; injection delle env vars (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_DEFAULT_*_MODEL`) allo spawn del processo SDK (`stream-claude.js` / `stream-daemon.js`). Vincolo non-regressione: zero impatto sull'OpenAI key esistente e sull'OAuth Anthropic Pro/Max.

## Technical Context

**Language/Version**: TypeScript strict (React 18 frontend), Rust 1.75+ (Tauri v2 backend), Node.js 18.17.0 (SDK bridge)
**Primary Dependencies**: Tauri v2, Zustand (settings store), `@anthropic-ai/claude-agent-sdk`, Tauri Store plugin, Tauri secure storage (existing `save_api_key`)
**Storage**: OS-level secure storage via Tauri (API keys, namespaced `provider:<id>`); localStorage via Zustand persist (`settings-storage` v11→v12) per provider metadata + default; nessun nuovo file
**Testing**: Vitest (frontend), `cargo test` (Rust); E2E manuale via spec dello UI flow nel quickstart
**Target Platform**: macOS 12+, Windows 10+, Linux (Tauri desktop)
**Project Type**: Desktop app (Tauri + React)
**Performance Goals**: Switch provider applicato in <1s (next-spawn); test connection <3s timeout; zero overhead per sessioni Anthropic native
**Constraints**: No leak env vars verso processi non-target; preset built-in aggiornabili via app update senza migration; coesistenza con Bedrock toggle e OAuth Anthropic Pro/Max
**Scale/Scope**: 6 preset built-in iniziali, lista custom illimitata; ~5 file frontend nuovi/modificati, ~2 file Rust, 2 file Node SDK bridge

## Constitution Check

| Principio | Stato | Note |
|---|---|---|
| I. AI-First Architecture | PASS | Feature core: estende il driver agentic LLM |
| II. Tauri + React Full-Stack | PASS | React+Zustand+Tauri commands, niente nuove dipendenze pesanti |
| III. Domain-Driven Organization | PASS | Nuovo dominio `providers` dentro `settings/` |
| IV. Code Quality Gates | PASS | Tutti i file pianificati <300 LOC, funzioni <20 LOC |
| V. Knowledge-Driven Development | PASS | Feature-doc + diary entry previsti; brain breadcrumb sul wiring env vars |
| VI. Simplicity Over Cleverness | PASS | Riuso `save_api_key`, no nuovo storage, no proxy locale |
| VII. User Experience First | PASS | Selettore in chat input + badge sessione, italiano-first |

Nessuna violazione. Procedo.

## Project Structure

### Documentation (this feature)

```text
specs/037-anthropic-compatible-providers/
├── spec.md
├── plan.md                  # questo file
├── research.md              # Phase 0 — protocollo + env vars + preset URLs
├── data-model.md            # Phase 1 — CustomProvider, ActiveProvider, migration v11→v12
├── quickstart.md            # Phase 1 — flusso utente end-to-end + dev setup
├── contracts/
│   ├── tauri-commands.md    # `save_api_key` namespacing, nuovo `test_provider_connection`
│   └── sdk-env-contract.md  # contratto env vars passate a stream-claude.js / stream-daemon.js
└── tasks.md                 # Phase 2 (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── components/
│   └── settings/
│       └── categories/
│           ├── ClaudeCodeSettings.tsx        # MOD — sostituisce dropdown statica con ProviderManager
│           └── providers/                    # NEW dir
│               ├── ProviderManager.tsx       # NEW — lista preset + custom, selettore default
│               ├── ProviderCard.tsx          # NEW — riga singola provider (icon, name, key field, test)
│               ├── ProviderAddModal.tsx      # NEW — form aggiungi custom provider
│               └── ProviderTestButton.tsx    # NEW — wrapper test connection con spinner/result
├── components/
│   └── chat/
│       ├── NewSessionProviderPicker.tsx      # NEW — dropdown per-sessione (override default)
│       └── SessionProviderBadge.tsx          # NEW — badge nel session header
├── stores/
│   └── settingsStore.ts                       # MOD — estensione ClaudeSettings, migration v11→v12
├── services/
│   ├── providerService.ts                     # NEW — preset, save/load token, test connection
│   └── providerEnvBuilder.ts                  # NEW — costruisce env vars dal provider attivo
├── constants/
│   └── providerPresets.ts                     # NEW — 6 preset built-in (Anthropic/Z.AI/MiniMax/Kimi/Qwen/DeepSeek)
└── types/
    └── providers.ts                           # NEW — CustomProvider, ActiveProvider, ProviderPreset

src-tauri/src/
└── commands/
    └── providers.rs                           # NEW — test_provider_connection command

# Node SDK bridge
node-sdk-bridge/
├── stream-claude.js                           # MOD — accetta QUACK_PROVIDER_CONFIG env
└── stream-daemon.js                           # MOD — idem

tests/
├── unit/
│   ├── providerService.test.ts                # NEW
│   ├── providerEnvBuilder.test.ts             # NEW
│   └── settingsStoreMigration.test.ts         # MOD — aggiunge case v11→v12
```

**Structure Decision**: progetto desktop-app esistente (Quack è Tauri + React monolitico). Niente backend separato. La feature aggiunge un sub-dominio `providers/` dentro `settings/` (UI) e `services/` (logic). Il wiring SDK passa per i file Node esistenti aggiungendo SOLO env vars: zero modifiche al protocollo IPC tra Rust e Node.

## Complexity Tracking

Nessuna violazione del constitution. Tabella vuota.
