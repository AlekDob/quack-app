---
type: gotcha
project: quack-app
created: 2026-01-08
migrated: true
---

# gotcha_mcp_server_timeout_slow_agent_startup

[2026-01-08] MCP servers non raggiungibili causano ritardi enormi all'avvio degli agenti. Il 'System Initialized' può impiegare 30+ secondi se un MCP server (es. Postgres) tenta di connettersi a un host non raggiungibile e aspetta il timeout.

Sintomo: agenti lenti SOLO su un progetto specifico, veloci su altri

Causa: .mcp.json con server che puntano a IP non raggiungibili (es. server locale/VPN non connessa)

Diagnosi: controllare .mcp.json del progetto e fare ping agli host configurati

Soluzione rapida: rinominare .mcp.json in .mcp.json.disabled quando non serve il server

Caso reale: flow-bi con Postgres su 192.168.10.162 (rete locale C&C) - timeout connessione quando fuori ufficio
