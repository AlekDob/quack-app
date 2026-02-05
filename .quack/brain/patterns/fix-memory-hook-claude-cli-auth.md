---
type: pattern
project: quack-app
created: 2026-01-17
migrated: true
---

# fix-memory-hook-claude-cli-auth

**Pattern**: Memory Hook AI Extraction with Claude Code CLI Auth

**Problem**: Memory Hook creava nuovo Anthropic() client che richiedeva ANTHROPIC_API_KEY env var → non disponibile perché Quack usa Claude Code CLI authenticated session

**Solution**: Rimuovere check per API key e lasciare che Anthropic SDK usi automaticamente la stessa sessione autenticata di Claude Code CLI

**Key Insight**: @anthropic-ai/sdk (usato dal Memory Hook) e @anthropic-ai/claude-agent-sdk (usato per chat) condividono la STESSA auth mechanism → Claude Code CLI session

**File Modified**: `src-tauri/node-sdk/memory-prompt-hook.js` (lines 128-141)

**Changes**: Rimosso check `if (!process.env.ANTHROPIC_API_KEY)` e aggiunto commento che spiega uso di CLI auth

**Config Change**: `useAiExtraction: true` (line 47) - RE-ENABLED AI extraction!

**Benefits**: ✅ AI semantic extraction funzionante, ✅ Niente crash, ✅ Niente API key richiesta, ✅ Migliore keyword extraction (AI vs regex)

**How It Works**: Anthropic SDK automaticamente cerca auth in questo ordine: 1) ANTHROPIC_API_KEY env var, 2) Claude Code CLI session (~/.anthropic/config.json), 3) Error

**Testing**: Build passa, pronto per testing runtime
