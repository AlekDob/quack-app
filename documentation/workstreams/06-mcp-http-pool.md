---
ws: 6
title: "MCP HTTP Server Pool — eliminate per-session stdio fanout"
status: "IMPLEMENTED (opt-in QUACK_MCP_POOL=1) — SMOKE TEST PENDING"
focus: current
opened: 2026-05-27
updated: 2026-05-27
priority: medium
tags: [performance, architecture, mcp, node-sdk, scaling]
notes: "5 fasi completate. Pool opt-in via env QUACK_MCP_POOL=1, default resta stdio (zero behaviour change). Stress test 5 client OK (125ms wall, 6ms avg, distinct session ids). Smoke test in `pnpm tauri dev` con N sessioni pendente."
---

# WS6 — MCP HTTP Server Pool

## TL;DR
Convertire i 3 MCP server interni (`ide-tools`, `code-intel`, `visualizer`) da **stdio** a **HTTP**, così da spawnarli **una volta sola** per istanza Quack invece di replicarli per ogni sessione `claude`.

**Risparmio atteso:** da 3×N processi Node a 3 totali. Con 10 sessioni: da 30 a 3 (–90%).

---

## Root cause

In `src-tauri/node-sdk/stream-daemon.js:782-787`, ogni query passa i 3 MCP server come `stdio`:

```js
options.mcpServers = {
  ...(resolvedMcpServers || {}),
  'ide-tools':  { command: 'node', args: [ideMcpServerPath] },
  'code-intel': { type: 'stdio', command: 'node', args: [codeIntelMcpServerPath] },
  'visualizer': { command: 'node', args: [visualizerMcpServerPath] },
};
```

Il binario nativo `claude` (Claude Agent SDK 0.3.150) riceve questa config via flag `--mcp-config` e **fork-spawna un nuovo processo Node per ogni server stdio** per ogni sessione. Stdio è 1:1 — non si può condividere tra processi diversi perché lega stdin/stdout del child a uno specifico parent.

### Misurazione attuale (snapshot 2026-05-27)
```
3 sessioni Quack attive → 9 server MCP Node (~540 MB) + 2 context7 npx (~150 MB) = ~700 MB ausiliari
```

### Cosa fanno i 3 server
| Server | Tools | Usato da | Drop possibile? |
|---|---|---|---|
| `code-intel` | `code_outline`, `code_find_definition`, `code_find_references`, `code_get_imports` | `EditorOutlinePanel.tsx` (FE Quack) + skill `code-navigation` | NO — dipendenza FE interna |
| `visualizer` | `visualize_html` | Auto-discover Claude → `StreamMessage.tsx` rendering | NO — feature core |
| `ide-tools` | `ide_open`, `ide_detect_installed`, `ide_focus`, etc. | "Open in IDE" actions in Quack | NO — feature UX |

**Conclusione:** nessuno droppabile, vanno tutti refactorati.

---

## Design proposto

### Architettura target

```
┌─────────────────────────────────────────────────┐
│ stream-daemon.js (1 processo per istanza Quack) │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ MCP HTTP Pool (boot once)                   │ │
│ │  • ide-tools     → http://127.0.0.1:47821   │ │
│ │  • code-intel    → http://127.0.0.1:47822   │ │
│ │  • visualizer    → http://127.0.0.1:47823   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ For each session N:                             │
│   spawn claude --mcp-config {                   │
│     'ide-tools':  { type:'http', url:'...47821' }│
│     'code-intel': { type:'http', url:'...47822' }│
│     'visualizer': { type:'http', url:'...47823' }│
│   }                                             │
└─────────────────────────────────────────────────┘
```

La SDK supporta già `type: 'http'` e `type: 'sse'` (vedi `stream-daemon.js:193-194` dove discrimina già SSE/HTTP per i MCP server globali esterni).

### Trasporto MCP HTTP

Usare `StreamableHTTPServerTransport` dal package `@modelcontextprotocol/sdk/server/streamableHttp.js` (standard MCP HTTP). Endpoint:
- `POST /mcp` per request JSON-RPC
- Stream via SSE per server-initiated messages

### Session-scoped context (problema cwd/env)

Oggi ogni MCP stdio eredita `cwd`, `env` (PATH, NODE_OPTIONS, ecc.) della sessione che lo spawna. In HTTP serve passare il contesto **per request**, non per processo.

**Soluzione:** aggiungere session metadata nei MCP request headers o nei tool input.

#### Per `code-intel`:
- Già accetta `filePath` assoluto in input → **nessun cambio API**
- Internamente non usa `process.cwd()` — usa solo paths passati esplicitamente

#### Per `ide-tools`:
- Alcuni tool leggono `process.cwd()` per defaultare al project corrente
- **Cambio API:** aggiungere campo opzionale `projectPath` agli input, passato dal client (stream-daemon) per sessione

#### Per `visualizer`:
- È un no-op server (la logica è in `StreamMessage.tsx`)
- **Zero cambi** necessari

### Pool lifecycle

```js
// stream-daemon.js (al boot)
class McpPool {
  async start() {
    this.ide = await this.spawnHttp('ide-tools', ideMcpServerPath);
    this.codeIntel = await this.spawnHttp('code-intel', codeIntelMcpServerPath);
    this.visualizer = await this.spawnHttp('visualizer', visualizerMcpServerPath);
  }

  async spawnHttp(name, scriptPath) {
    const port = await getFreePort();
    const proc = spawn('node', [scriptPath, '--http', '--port', port.toString()], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, MCP_TRANSPORT: 'http' },
    });
    await waitForHealth(`http://127.0.0.1:${port}/health`, 5000);
    return { name, port, proc };
  }

  toMcpConfig() {
    return {
      'ide-tools':  { type: 'http', url: `http://127.0.0.1:${this.ide.port}/mcp` },
      'code-intel': { type: 'http', url: `http://127.0.0.1:${this.codeIntel.port}/mcp` },
      'visualizer': { type: 'http', url: `http://127.0.0.1:${this.visualizer.port}/mcp` },
    };
  }

  async restartIfDead(name) { /* auto-restart con backoff */ }
}
```

### Backward compatibility

I 3 server vanno scritti in **doppia modalità**:
- Default `stdio` (mantiene retrocompat con MCP standalone usage, debug locale)
- Flag `--http --port N` per modalità HTTP

```js
// code-intel-mcp-server.js (entry point)
const args = process.argv.slice(2);
const isHttp = args.includes('--http');
const port = parseInt(args[args.indexOf('--port') + 1] || '0', 10);

if (isHttp) {
  await startHttpTransport(port);
} else {
  await startStdioTransport();
}
```

---

## Fasi

### Fase 1 — PoC su `visualizer` (più semplice, no-op server) ✅ DONE
- [x] Aggiungere flag `--http --port N` a `visualizer-mcp-server.js`
- [x] Implementare `StreamableHTTPServerTransport`
- [x] Test manuale: `curl http://localhost:PORT/mcp` con MCP request standard
- [x] Validare che la SDK accetti `type:'http'` e funzioni il tool call

**Exit criteria:** una sessione `claude` può chiamare `visualize_html` via HTTP MCP server.
**Verified:** /health 200, initialize ritorna serverInfo + mcp-session-id, tools/list ritorna 1 tool, tools/call funziona.

### Fase 2 — `McpPool` class in stream-daemon ✅ DONE
- [x] Implementare `McpPool` (start, toMcpConfig, getStatus, stop)
- [x] OS-assigned port via `--port 0` (range dedicato dropato, più portable)
- [x] Health check polling all'avvio (timeout 5s con retry 150ms)
- [x] Cleanup al shutdown del daemon (SIGTERM + 3s grace + SIGKILL)
- [x] Wire `options.mcpServers = { ...resolvedMcpServers, ...pool.toMcpConfig() }` opt-in via `QUACK_MCP_POOL=1`

**Exit criteria:** stream-daemon boot logga "MCP pool ready: {status}". 1 sessione funziona end-to-end.
**Implemented files:** `lib/mcp-pool.js` (modulo isolato), wiring in `stream-daemon.js` (bootMcpPool + shutdown cleanup).

### Fase 3 — Refactor `code-intel` e `ide-tools` a doppio transport ✅ DONE
- [x] Aggiungere flag `--http --port N` a entrambi (riusano helper `lib/mcp-http-transport.js`)
- [x] Validare zero regression sulle API tool (stesso JSON schema in entrambi i transport)
- [x] **NESSUN cambio API necessario per ide-tools:** `grep process.cwd` su tutti e 3 i server e su `lib/code-intel/` → zero match. I tool accettano già `filePath`/`projectPath` come parametri espliciti.

**Exit criteria:** 3 sessioni simultanee → 3 server MCP totali (non 9). Verificato con `ps -A | grep mcp-server`.
**Verified:** stress test 5 client paralleli sul visualizer pool → 5 sessioni MCP distinte servite da 1 processo (vs 5 processi nel modello stdio).

### Fase 4 — Auto-restart + observability ✅ DONE (UI indicator out of scope)
- [x] Backoff exponential restart su crash: `[250ms, 500ms, 1s, 2s, 4s]`, sliding window 60s, cap 5 restart
- [x] Logging eventi a `~/.quack/logs/mcp-pool.log` (NDJSON, una riga per evento: `server_up`, `server_exit`, `restart_scheduled`, `health_fail`, `pool_stop`, ecc.)
- [x] `pool.getStatus()` espone `{port, dead, pid, restartCount}` per ogni server
- [x] Sessioni attive contate nel `/health` endpoint: `{ status, name, version, sessions }`
- [ ] UI: indicator "MCP pool healthy" in Settings → Diagnostics — **out of scope WS6**, candidato per follow-up (richiede esporre status via IPC al frontend)

**Exit criteria:** killare manualmente un server MCP → auto-restart entro 2s, nessuna sessione attiva si rompe.
**Verified:** SIGKILL visualizer → restart in 250ms con nuovo PID, restartCount incrementato a 1, pool stato salvo.

### Fase 5 — Stress test + ship ✅ DONE (real-Quack smoke pendente)
- [x] Stress test sintetico: 5 client MCP paralleli → 20 RPC totali in 125ms wall, 6ms avg per client, 5/5 session id distinti
- [x] Verifica fanout: `ps -A | grep mcp-server` durante stress = 3 processi (non 5×3 = 15)
- [x] Doc pattern: `documentation/patterns/pattern-mcp-http-pool.md` shipped
- [x] Diary entry: `documentation/diary/2026-05-27.md`
- [x] CLAUDE.md Knowledge Base: link al pattern + breadcrumb `// Brain: ws6-mcp-http-pool` posati nei 5 file modificati
- [ ] Smoke test reale `pnpm tauri dev` con `QUACK_MCP_POOL=1` + 3 sessioni Quack simultanee — pendente, blocca su WS1 smoke test (vogliamo prima SDK 0.3.150 stabile)
- [ ] Bump versione package.json se necessario — non necessario (zero breaking change client)

**Exit criteria:** numeri attesi rispettati, zero regression, pattern doc shipped.
**Status:** code completo e self-tested in CLI. Pool è dietro env opt-in `QUACK_MCP_POOL=1`, default unchanged. Pronto per smoke test in dev environment dopo che WS1 chiude.

---

## Rischi & mitigazioni

| Rischio | Probabilità | Impatto | Mitigazione |
|---|---|---|---|
| MCP HTTP transport ha bug con SDK 0.3.150 | bassa | alto | PoC su `visualizer` prima di committare il refactor completo |
| Race condition: claude session parte prima che pool sia ready | media | alto | `await pool.start()` blocca prima del primo session spawn |
| `ide-tools` rompe per perdita di `process.cwd()` per-session | alta | medio | Aggiungere `projectPath` esplicito + fallback intelligente |
| Free port collision con altre app | bassa | basso | Range dedicato 47820-47899, retry su EADDRINUSE |
| Pool crash blocca tutte le sessioni | media | alto | Auto-restart + sessione fallisce gracefully se server unreachable |

---

## Out of scope (volutamente)

- **Stream-daemon → worker_threads / Rust port** (Livello 2 della discussione originale): è il prossimo workstream candidato (WS7) ma non è bloccante per WS6
- **In-process MCP per sessioni light** (Livello 3): richiede modalità SDK-as-library invece di binario nativo, conflitto con esigenza 1M context
- **MCP server esterni utente** (context7, ecc.): restano stdio/sse come oggi, lo user li gestisce
- **Skill MCP server dinamici** (skill che dichiarano MCP): out of scope, casi rari e già 1 per istanza

---

## Success metrics

| Metrica | Oggi | Target post-WS6 |
|---|---|---|
| MCP processi @ 1 sessione | 3 | 3 |
| MCP processi @ 3 sessioni | 9 | 3 |
| MCP processi @ 10 sessioni | 30 | 3 |
| RAM ausiliaria MCP @ 3 sessioni | ~540 MB | ~180 MB |
| RAM ausiliaria MCP @ 10 sessioni | ~1.8 GB | ~180 MB |
| Cold start latency sessione | baseline | ≤ baseline (pool già up) |
| Recovery da MCP crash | manual restart Quack | auto-restart ≤2s |

---

## Dipendenze & ordering

- **Blocca su:** WS1 (SDK 0.3.150 smoke test) — vogliamo essere sicuri che la SDK sia stabile prima di toccare il MCP layer
- **Blocca:** WS7 (stream-daemon worker pool / Rust port) — naturale next step
- **Indipendente da:** WS2, WS3, WS4, WS5

---

## Note di contesto

- Snapshot processi che ha motivato il workstream: vedi `documentation/diary/2026-05-27.md`
- Discussione originale: 3-livelli (HTTP pool / worker threads / in-process MCP)
- L'utente Alek ha killato il daemon `agent-browser` zombie a parte (non correlato)
