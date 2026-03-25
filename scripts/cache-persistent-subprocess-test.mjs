#!/usr/bin/env node

// Brain: bug-post-fix-cache-breakage-investigation
// Prototype: validate whether keeping a single CLI subprocess alive across
// multiple turns produces healthy cache behavior (matching native CLI).
//
// Theory: query() spawns a fresh subprocess per call, destroying in-memory
// state (skills, cache markers, message decorations). If we keep one
// subprocess alive, the SDK maintains state and cache breaks should stop.

import { spawn } from 'child_process';
import { createInterface } from 'readline';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUACK_DIR = resolve(__dirname, '..');
const CLI_JS = resolve(QUACK_DIR, 'src-tauri/node-sdk/node_modules/@anthropic-ai/claude-agent-sdk/cli.js');

// --- Configuration ---
// The CLI expects a UUID-format session ID (the Claude session UUID, not Quack's internal key).
// Default to the investigation session from the flow project.
const SESSION_ID = process.argv[2] || 'ae0a6c1a-0790-4492-a4a8-ed7dcf7f0c61';
const MODEL = process.argv[3] || 'claude-haiku-4-5-20251001';
// CWD must match the project where the session lives
const CWD = process.argv[4] || '/Users/fredric/Dev/flow';
const PROMPT = 'Test message - Answer with ok';
const NUM_TURNS = 4;

console.log(`\n═══ Persistent Subprocess Cache Test ═══\n`);
console.log(`Session:  ${SESSION_ID}`);
console.log(`Model:    ${MODEL}`);
console.log(`Prompt:   "${PROMPT}"`);
console.log(`Turns:    ${NUM_TURNS}`);
console.log(`CWD:      ${CWD}`);
console.log(`CLI:      ${CLI_JS}\n`);

// --- Spawn the CLI subprocess ONCE ---
const args = [
  CLI_JS,
  '--output-format', 'stream-json',
  '--input-format', 'stream-json',
  '--verbose',
  '--model', MODEL,
  '--resume', SESSION_ID,
  '--permission-mode', 'dontAsk',
  // Minimize startup overhead: no filesystem settings, no MCP discovery
  '--setting-sources', '',
  '--tools', 'default',
  '--betas', 'context-1m-2025-08-07',
];

console.log(`Spawning: node ${args.slice(1).join(' ')}\n`);

const child = spawn('node', args, {
  cwd: CWD,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: {
    ...process.env,
    CLAUDE_CODE_ENTRYPOINT: 'sdk-ts',
  },
});

// Capture stderr for debugging
let stderrBuffer = '';
child.stderr.on('data', (data) => {
  stderrBuffer += data.toString();
});

// --- Read stdout as JSON lines ---
const rl = createInterface({ input: child.stdout });
const eventQueue = [];
let eventResolve = null;

rl.on('line', (line) => {
  if (!line.trim()) return;
  try {
    const event = JSON.parse(line);
    if (eventResolve) {
      const r = eventResolve;
      eventResolve = null;
      r(event);
    } else {
      eventQueue.push(event);
    }
  } catch {
    // Non-JSON line, ignore
  }
});

function nextEvent() {
  if (eventQueue.length > 0) return Promise.resolve(eventQueue.shift());
  return new Promise((resolve) => { eventResolve = resolve; });
}

// --- Send a user message ---
function sendMessage(text) {
  const msg = JSON.stringify({
    type: 'user',
    session_id: '',
    message: { role: 'user', content: [{ type: 'text', text }] },
    parent_tool_use_id: null,
  });
  child.stdin.write(msg + '\n');
}

// --- Wait for a result event, collecting usage ---
const TURN_TIMEOUT_MS = 30_000;

function nextEventWithTimeout(ms) {
  return Promise.race([
    nextEvent(),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Turn timeout after ${ms}ms`)), ms)),
  ]);
}

async function waitForResult(turnNum) {
  let usage = null;
  let modelUsage = null;
  let eventCount = 0;
  let sessionId = null;

  while (true) {
    const event = await nextEventWithTimeout(TURN_TIMEOUT_MS);
    eventCount++;

    if (event.type === 'system' && event.subtype === 'init') {
      sessionId = event.session_id;
      const toolCount = Array.isArray(event.tools) ? event.tools.length : '?';
      const mcpCount = Array.isArray(event.mcp_servers) ? event.mcp_servers.length : '?';
      console.log(`  [init] session=${sessionId}, tools=${toolCount}, mcp=${mcpCount}`);
    }

    if (event.type === 'result') {
      usage = event.usage || null;
      modelUsage = event.modelUsage || event.model_usage || null;
      console.log(`  [result] subtype=${event.subtype}, is_error=${event.is_error}, has_usage=${!!usage}`);
      if (event.is_error) {
        console.log(`  [result] errors: ${JSON.stringify(event.errors || event.result || 'unknown').slice(0, 500)}`);
      }
      if (!usage) {
        console.log(`  [result] full event keys: ${Object.keys(event).join(', ')}`);
        console.log(`  [result] event snippet: ${JSON.stringify(event).slice(0, 500)}`);
      }
      break;
    }

    // Also capture usage from assistant messages
    if (event.type === 'assistant' && event.message?.usage) {
      usage = event.message.usage;
      modelUsage = event.modelUsage || event.model_usage || null;
    }
  }

  return { usage, modelUsage, eventCount, sessionId };
}

// --- Main ---
const results = [];

try {
  for (let turn = 1; turn <= NUM_TURNS; turn++) {
    console.log(`\n─── Turn ${turn} ───`);
    const startTime = Date.now();

    sendMessage(PROMPT);
    const { usage, modelUsage, eventCount, sessionId } = await waitForResult(turn);

    const elapsed = Date.now() - startTime;
    const cacheRead = usage?.cache_read_input_tokens ?? usage?.cacheReadInputTokens ?? 0;
    const cacheCreation = usage?.cache_creation_input_tokens ?? usage?.cacheCreationInputTokens ?? 0;
    const inputTokens = usage?.input_tokens ?? usage?.inputTokens ?? 0;
    const effectiveFill = inputTokens + cacheRead + cacheCreation;

    // Extract contextWindow from modelUsage
    let contextWindow = null;
    if (modelUsage) {
      for (const [, mu] of Object.entries(modelUsage)) {
        if (mu?.contextWindow) contextWindow = mu.contextWindow;
      }
    }

    console.log(`  cacheRead:     ${cacheRead.toLocaleString()}`);
    console.log(`  cacheCreation: ${cacheCreation.toLocaleString()}`);
    console.log(`  effectiveFill: ${effectiveFill.toLocaleString()}`);
    console.log(`  contextWindow: ${contextWindow?.toLocaleString() || '?'}`);
    console.log(`  events:        ${eventCount}`);
    console.log(`  elapsed:       ${elapsed}ms`);

    results.push({ turn, cacheRead, cacheCreation, effectiveFill, contextWindow, elapsed });
  }

  // Close stdin to let the subprocess exit gracefully
  child.stdin.end();

  // --- Summary ---
  console.log(`\n\n═══ Summary ═══\n`);
  console.log('| Turn | cacheReadTokens | cacheCreationTokens | effectiveContextFill | contextWindow |');
  console.log('|---:|---:|---:|---:|---:|');
  for (const r of results) {
    console.log(`| ${r.turn} | ${r.cacheRead.toLocaleString()} | ${r.cacheCreation.toLocaleString()} | ${r.effectiveFill.toLocaleString()} | ${r.contextWindow?.toLocaleString() || '?'} |`);
  }

  // --- Comparison ---
  console.log(`\n═══ Comparison ═══\n`);
  const steadyStateCreation = results.slice(1).map(r => r.cacheCreation);
  const avgCreation = steadyStateCreation.reduce((a, b) => a + b, 0) / steadyStateCreation.length;
  console.log(`Steady-state avg cacheCreation (turns 2-${NUM_TURNS}): ${Math.round(avgCreation).toLocaleString()}`);
  console.log('');
  console.log('Expected if theory correct (persistent subprocess):  < 1,000');
  console.log('Expected if theory wrong (same as daemon baseline):  ~28,000-33,000');
  console.log('Native Claude Code CLI reference:                    ~300');
  console.log('');

  if (avgCreation < 1000) {
    console.log('✓ THEORY CONFIRMED — persistent subprocess fixes cache behavior');
  } else if (avgCreation < 10000) {
    console.log('~ PARTIAL IMPROVEMENT — persistent subprocess helps but doesn\'t fully fix');
  } else {
    console.log('✗ THEORY NOT CONFIRMED — persistent subprocess does not fix cache behavior');
  }

} catch (err) {
  console.error('\nError:', err.message);
}

// Always print stderr
if (stderrBuffer) {
  console.error('\nSubprocess stderr (last 3000 chars):');
  console.error(stderrBuffer.slice(-3000));
}

// Force exit after summary is printed — the subprocess may linger due to MCP cleanup
setTimeout(() => {
  child.kill('SIGTERM');
  setTimeout(() => process.exit(0), 500);
}, 2000);

// Timeout safety
setTimeout(() => {
  console.error('\nTimeout: test took too long (120s). Killing subprocess.');
  child.kill('SIGTERM');
  process.exit(1);
}, 120_000);
