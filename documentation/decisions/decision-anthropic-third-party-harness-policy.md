---
type: decision
created: 2026-01-11
tags: [anthropic, compliance, sdk, oauth]
---

# decision-anthropic-third-party-harness-policy

## Anthropic Third-Party Harness Crackdown (Jan 2026)

[2026-01-11] Anthropic ha bloccato tool che spoofano Claude Code CLI per usare subscription OAuth senza pagare per token

### Cosa è stato bloccato: Tool come OpenCode che inviavano header fingendo di essere Claude Code CLI, bypassando rate limit con subscription Pro/Max ($200/mese)

### Errore mostrato: 'This credential is only authorized for use with Claude Code.'

### Analisi Quack: Rischio valutato MEDIO - Quack usa @anthropic-ai/claude-agent-sdk (SDK ufficiale) senza spoofing di header

### Differenze chiave Quack vs tool bloccati: 1) Usa SDK ufficiale non chiamate HTTP dirette, 2) Non spoofa User-Agent o client ID, 3) SDK gestisce telemetria, 4) Supporta anche API key pay-per-token

### Raccomandazione: Chiedere conferma esplicita ad Anthropic sulla compliance dell'uso di claude-agent-sdk con OAuth credentials

### Azione alternativa: Se serve certezza immediata, deprecare supporto OAuth e usare solo API key pay-per-token

### Riferimenti: GitHub issue anthropics/claude-code#7410, dichiarazioni di Thariq Shihipar (Anthropic MTS)
