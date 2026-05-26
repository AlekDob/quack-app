---
type: gotcha
created: 2026-01-08
last_verified: 2026-05-26
tags: [mcp, timeout, agent-startup, performance, sdk-0.3]
---

# gotcha_mcp_server_timeout_slow_agent_startup

> **Update 2026-05-26 (WS01 SDK 0.3.150)** — SDK `0.3.142` ha introdotto MCP non-blocking startup di default: la sessione parte immediatamente e i server lenti riportano `status: "pending"` in `init` finché non sono pronti. Questo dovrebbe **mitigare** (non eliminare) il sintomo "agenti lenti su progetto specifico" — il timeout non blocca più il `System Initialized`. Per ripristinare il vecchio comportamento bloccante: env `MCP_CONNECTION_NONBLOCKING=0`. Per forzare un server critico nel turno 1: `alwaysLoad: true` nella sua config. Da verificare empiricamente con uno smoke test su un progetto Flow-BI (Postgres VPN). Workaround originale (rinominare `.mcp.json.disabled`) resta valido come escape rapido.

[2026-01-08] MCP servers non raggiungibili causano ritardi enormi all'avvio degli agenti. Il 'System Initialized' può impiegare 30+ secondi se un MCP server (es. Postgres) tenta di connettersi a un host non raggiungibile e aspetta il timeout.

Sintomo: agenti lenti SOLO su un progetto specifico, veloci su altri

Causa: .mcp.json con server che puntano a IP non raggiungibili (es. server locale/VPN non connessa)

Diagnosi: controllare .mcp.json del progetto e fare ping agli host configurati

Soluzione rapida: rinominare .mcp.json in .mcp.json.disabled quando non serve il server

Caso reale: flow-bi con Postgres su 192.168.10.162 (rete locale C&C) - timeout connessione quando fuori ufficio
