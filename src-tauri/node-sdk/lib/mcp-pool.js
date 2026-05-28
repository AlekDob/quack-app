// Brain: ws6-mcp-http-pool
//
// McpPool — single instance of each internal MCP server (visualizer, code-intel,
// ide-tools) shared by all Quack sessions via HTTP transport.
//
// Why: in the stdio model the binary `claude` forks one Node process per MCP
// server per session. With N sessions → 3·N child processes. The pool spawns
// each server once at daemon boot and exposes its URL to all sessions.
//
// Lifecycle:
//   1. start()        — spawn the 3 servers, read MCP_HTTP_PORT, /health probe
//   2. toMcpConfig()  — return `{ type:'http', url:'http://127.0.0.1:PORT/mcp' }` map
//   3. stop()         — SIGTERM all, fall back to SIGKILL after 3s
//
// Crash recovery:
//   On unexpected exit, backoff-restart up to MAX_RESTARTS in a sliding window.
//   Past the cap the server is marked dead and toMcpConfig() omits it (sessions
//   that depended on it will see fewer tools but stay alive).
//
// Logging:
//   ~/.quack/logs/mcp-pool.log (NDJSON, one event per line) for forensics.

import { spawn } from 'node:child_process';
import { mkdirSync, appendFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import http from 'node:http';

const POOL_LOG = join(homedir(), '.quack', 'logs', 'mcp-pool.log');
const HEALTH_TIMEOUT_MS = 5000;
const STOP_GRACE_MS = 3000;
const MAX_RESTARTS = 5;           // dentro una sliding window
const RESTART_WINDOW_MS = 60_000; // 1 minuto
const BACKOFF_MS = [250, 500, 1000, 2000, 4000];

function logEvent(record) {
  try {
    if (!existsSync(dirname(POOL_LOG))) {
      mkdirSync(dirname(POOL_LOG), { recursive: true });
    }
    appendFileSync(POOL_LOG, JSON.stringify({ ts: new Date().toISOString(), ...record }) + '\n');
  } catch { /* logging never crashes the pool */ }
}

function probeHealth(port, timeoutMs = HEALTH_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const attempt = () => {
      const req = http.get(
        { host: '127.0.0.1', port, path: '/health', timeout: 1000 },
        (res) => {
          if (res.statusCode === 200) {
            res.resume();
            resolve(true);
          } else {
            res.resume();
            retry();
          }
        },
      );
      req.on('error', retry);
      req.on('timeout', () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() >= deadline) return resolve(false);
      setTimeout(attempt, 150);
    };
    attempt();
  });
}

export class McpPool {
  constructor({ scriptPaths, logFn }) {
    // scriptPaths: { 'ide-tools': '/abs/path/ide-mcp-server.js', ... }
    this.scriptPaths = scriptPaths;
    this.log = logFn || ((tag, msg) => console.error(`[MCP-POOL] ${tag}: ${msg}`));
    this.servers = {}; // name → { proc, port, dead, restartTimestamps }
    this.stopping = false;
  }

  async start() {
    logEvent({ event: 'pool_start', servers: Object.keys(this.scriptPaths) });
    const entries = await Promise.all(
      Object.entries(this.scriptPaths).map(([name, path]) => this.#spawnOne(name, path)),
    );
    const ok = entries.filter((e) => e && e.port).length;
    this.log('POOL', `started ${ok}/${entries.length} MCP servers: [${
      entries.filter((e) => e?.port).map((e) => `${e.name}=${e.port}`).join(', ')
    }]`);
    if (ok === 0) {
      throw new Error('McpPool: no MCP server became healthy');
    }
  }

  async #spawnOne(name, scriptPath) {
    // Preserve restart timestamps across spawn attempts so the sliding-window cap
    // keeps working even after a successful restart.
    const prevTimestamps = this.servers[name]?.restartTimestamps || [];

    return new Promise((resolve) => {
      const proc = spawn('node', [scriptPath, '--http', '--port', '0'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, MCP_TRANSPORT: 'http' },
      });

      let stdoutBuf = '';
      let portResolved = false;

      const onPort = async (port) => {
        if (portResolved) return;
        portResolved = true;
        const healthy = await probeHealth(port);
        if (!healthy) {
          this.log('POOL', `${name} port ${port} did not become healthy in ${HEALTH_TIMEOUT_MS}ms`);
          logEvent({ event: 'health_fail', name, port });
          try { proc.kill('SIGTERM'); } catch { /* ignore */ }
          this.servers[name] = { proc: null, port: null, dead: true, restartTimestamps: prevTimestamps };
          resolve({ name, port: null });
          return;
        }
        this.servers[name] = { proc, port, dead: false, restartTimestamps: prevTimestamps };
        logEvent({ event: 'server_up', name, port, pid: proc.pid });
        resolve({ name, port });
      };

      proc.stdout.on('data', (chunk) => {
        stdoutBuf += chunk.toString();
        const m = stdoutBuf.match(/MCP_HTTP_PORT=(\d+)/);
        if (m) onPort(parseInt(m[1], 10));
      });

      proc.stderr.on('data', (chunk) => {
        // Forward stderr to daemon stderr with prefix, for debug
        const text = chunk.toString().trimEnd();
        if (text) {
          // Brain: ws6-mcp-http-pool — stderr is debug-only, never machine-parsed
          process.stderr.write(`[POOL:${name}] ${text}\n`);
        }
      });

      proc.on('exit', (code, signal) => {
        const entry = this.servers[name];
        logEvent({ event: 'server_exit', name, code, signal, stopping: this.stopping });
        if (this.stopping) return;
        if (entry) entry.dead = true;
        this.#scheduleRestart(name, scriptPath);
      });

      proc.on('error', (err) => {
        logEvent({ event: 'spawn_error', name, error: String(err) });
        if (!portResolved) {
          portResolved = true;
          this.servers[name] = { proc: null, port: null, dead: true, restartTimestamps: prevTimestamps };
          resolve({ name, port: null });
        }
      });

      // safety net: if no MCP_HTTP_PORT in 10s, mark as failed
      setTimeout(() => {
        if (!portResolved) {
          this.log('POOL', `${name} did not announce MCP_HTTP_PORT in 10s, treating as failed`);
          try { proc.kill('SIGKILL'); } catch { /* ignore */ }
          portResolved = true;
          this.servers[name] = { proc: null, port: null, dead: true, restartTimestamps: prevTimestamps };
          resolve({ name, port: null });
        }
      }, 10_000).unref();
    });
  }

  #scheduleRestart(name, scriptPath) {
    const entry = this.servers[name] || { restartTimestamps: [] };
    const now = Date.now();
    // sliding window of restart timestamps
    entry.restartTimestamps = (entry.restartTimestamps || []).filter((t) => now - t < RESTART_WINDOW_MS);
    if (entry.restartTimestamps.length >= MAX_RESTARTS) {
      this.log('POOL', `${name} exceeded ${MAX_RESTARTS} restarts in ${RESTART_WINDOW_MS}ms — giving up`);
      logEvent({ event: 'restart_cap', name, count: entry.restartTimestamps.length });
      this.servers[name] = { proc: null, port: null, dead: true, restartTimestamps: entry.restartTimestamps };
      return;
    }
    const delayIdx = Math.min(entry.restartTimestamps.length, BACKOFF_MS.length - 1);
    const delay = BACKOFF_MS[delayIdx];
    entry.restartTimestamps.push(now);
    this.servers[name] = entry;
    this.log('POOL', `${name} crashed — restart in ${delay}ms (attempt ${entry.restartTimestamps.length}/${MAX_RESTARTS})`);
    logEvent({ event: 'restart_scheduled', name, delay, attempt: entry.restartTimestamps.length });
    setTimeout(() => {
      if (this.stopping) return;
      this.#spawnOne(name, scriptPath).catch((err) => {
        this.log('POOL', `${name} restart failed: ${err.message}`);
        logEvent({ event: 'restart_error', name, error: String(err) });
      });
    }, delay).unref();
  }

  toMcpConfig() {
    const config = {};
    for (const [name, entry] of Object.entries(this.servers)) {
      if (!entry.dead && entry.port) {
        config[name] = { type: 'http', url: `http://127.0.0.1:${entry.port}/mcp` };
      }
    }
    return config;
  }

  getStatus() {
    const status = {};
    for (const [name, entry] of Object.entries(this.servers)) {
      status[name] = {
        port: entry.port,
        dead: entry.dead,
        pid: entry.proc?.pid ?? null,
        restartCount: entry.restartTimestamps?.length ?? 0,
      };
    }
    return status;
  }

  async stop() {
    this.stopping = true;
    logEvent({ event: 'pool_stop' });
    const procs = Object.values(this.servers).map((s) => s.proc).filter(Boolean);
    for (const p of procs) {
      try { p.kill('SIGTERM'); } catch { /* ignore */ }
    }
    // wait for graceful exit, then SIGKILL stragglers
    await new Promise((resolve) => setTimeout(resolve, STOP_GRACE_MS));
    for (const p of procs) {
      try { if (!p.killed) p.kill('SIGKILL'); } catch { /* ignore */ }
    }
  }
}
