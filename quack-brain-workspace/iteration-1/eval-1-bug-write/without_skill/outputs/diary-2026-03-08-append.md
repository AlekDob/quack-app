---
type: diary
project: quack-app
date: 2026-03-08
---

- [HH:MM] (Alek) fix: token tracking — input_tokens con prompt caching includeva solo i token non-cached, causando stamina bar a mostrare 100%. Soluzione: context_fill = input_tokens + cache_read_input_tokens + cache_creation_input_tokens. Fix in App.tsx (handleTokenUpdate) e useClaudeChat.ts. Brain: bug-token-input-includes-cached-stamina-100.
