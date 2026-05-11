#!/usr/bin/env node
/**
 * Cache Bisection Test — Find What Breaks query()-per-message Caching
 *
 * Run from: cd src-tauri/node-sdk && node ../../scripts/cache-test-incremental.mjs
 *
 * Tests each SDK option incrementally to isolate which one degrades prompt caching.
 * Each level runs 3 turns (new + 2 resumed). Turn 2-3 should show high cache hit rates.
 */

// Polyfill Symbol.dispose for Node.js < 22
Symbol.dispose ??= Symbol('Symbol.dispose');
Symbol.asyncDispose ??= Symbol('Symbol.asyncDispose');

import { query } from '@anthropic-ai/claude-agent-sdk';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const CWD = '/Users/fredric/Dev/quack-app';
const MODEL = 'claude-haiku-4-5-20251001';
const PROMPT = 'Test — answer with OK';
const TURNS_PER_LEVEL = 3;
const PAUSE_BETWEEN_LEVELS_MS = 5000;
const TURN_TIMEOUT_MS = 120_000;

const ASK_USER_APPEND = `

## Interactive Questions (AskUserQuestion Tool)

You have access to the AskUserQuestion tool. USE IT when you need user input to make a decision instead of asking in plain text.

**ALWAYS use AskUserQuestion when:**
- User must choose between 2-4 implementation approaches
- Selecting technologies, libraries, or patterns
- Confirming potentially destructive actions
- Getting preferences for ambiguous requirements
- The user asks you to help them choose something

**Do NOT use it for:**
- Open-ended questions needing detailed text responses
- Questions with more than 4 options
- Simple confirmations inferrable from context

**Example:** If user asks "help me choose a database", you MUST use AskUserQuestion with options like:
- PostgreSQL (relational, ACID compliant)
- MongoDB (document-based, flexible schema)
- SQLite (lightweight, embedded)

IMPORTANT: Do NOT list options in plain text. Use the AskUserQuestion tool to present interactive choices.`;

const ALLOWED_TOOLS = [
  'Task', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
  'WebFetch', 'WebSearch', 'TodoWrite', 'NotebookEdit', 'SlashCommand',
  'BashOutput', 'KillShell', 'ExitPlanMode', 'AskUserQuestion',
];

const MCP_SERVERS = {
  context7: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp'],
  },
};

// ---------------------------------------------------------------------------
// Level definitions — each adds ONE option on top of previous
// ---------------------------------------------------------------------------
const LEVELS = [
  {
    name: 'L0 Kite baseline',
    build: (base) => base,
  },
  {
    name: 'L1 + model',
    build: (base) => ({ ...base, model: MODEL }),
  },
  {
    name: 'L2 + betas',
    build: (base) => ({ ...base, model: MODEL, betas: ['context-1m-2025-08-07'] }),
  },
  {
    name: 'L3 + systemPrompt.append',
    build: (base) => ({
      ...base, model: MODEL, betas: ['context-1m-2025-08-07'],
      systemPrompt: { type: 'preset', preset: 'claude_code', append: ASK_USER_APPEND },
    }),
  },
  {
    name: 'L4 + allowedTools',
    build: (base) => ({
      ...base, model: MODEL, betas: ['context-1m-2025-08-07'],
      systemPrompt: { type: 'preset', preset: 'claude_code', append: ASK_USER_APPEND },
      allowedTools: ALLOWED_TOOLS,
    }),
  },
  {
    name: 'L5 + mcpServers',
    build: (base) => ({
      ...base, model: MODEL, betas: ['context-1m-2025-08-07'],
      systemPrompt: { type: 'preset', preset: 'claude_code', append: ASK_USER_APPEND },
      allowedTools: ALLOWED_TOOLS,
      mcpServers: MCP_SERVERS,
    }),
  },
  {
    name: 'L6 + env overrides',
    build: (base) => ({
      ...base, model: MODEL, betas: ['context-1m-2025-08-07'],
      systemPrompt: { type: 'preset', preset: 'claude_code', append: ASK_USER_APPEND },
      allowedTools: ALLOWED_TOOLS,
      mcpServers: MCP_SERVERS,
      env: { ...process.env, ENABLE_TOOL_SEARCH: 'auto' },
    }),
  },
  {
    name: 'L7 + settings/tools/checkpoint',
    build: (base) => ({
      ...base, model: MODEL, betas: ['context-1m-2025-08-07'],
      systemPrompt: { type: 'preset', preset: 'claude_code', append: ASK_USER_APPEND },
      allowedTools: ALLOWED_TOOLS,
      mcpServers: MCP_SERVERS,
      env: { ...process.env, ENABLE_TOOL_SEARCH: 'auto' },
      settingSources: ['project', 'user', 'local'],
      tools: { type: 'preset', preset: 'claude_code' },
      enableFileCheckpointing: true,
    }),
  },
];

// ---------------------------------------------------------------------------
// Run a single turn
// ---------------------------------------------------------------------------
async function runTurn(levelName, turnNum, options, sessionId) {
  const opts = { ...options };
  if (sessionId) opts.resume = sessionId;

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), TURN_TIMEOUT_MS);
  opts.abortController = ac;

  let capturedSessionId = null;
  let cacheRead = 0;
  let cacheCreate = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;

  try {
    const conversation = query({ prompt: PROMPT, options: opts });

    for await (const msg of conversation) {
      if (ac.signal.aborted) break;

      // Capture session ID
      if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) {
        capturedSessionId = msg.session_id;
      }

      // Capture cache stats from assistant messages
      if (msg.type === 'assistant' && msg.message?.usage) {
        const u = msg.message.usage;
        inputTokens = u.input_tokens ?? 0;
        cacheRead = u.cache_read_input_tokens ?? 0;
        cacheCreate = u.cache_creation_input_tokens ?? 0;
        outputTokens = u.output_tokens ?? 0;
      }

      // Capture cost from result
      if (msg.type === 'result') {
        costUsd = msg.total_cost_usd ?? 0;
        if (msg.session_id) capturedSessionId = msg.session_id;
      }
    }
  } catch (err) {
    console.error(`  ❌ ${levelName} Turn ${turnNum}: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  const total = cacheRead + cacheCreate + inputTokens;
  const hitRate = total > 0 ? ((cacheRead / total) * 100).toFixed(1) : '0.0';

  return { capturedSessionId, cacheRead, cacheCreate, inputTokens, outputTokens, costUsd, hitRate };
}

// ---------------------------------------------------------------------------
// Run all levels
// ---------------------------------------------------------------------------
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║           Cache Bisection Test — query() per message                ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`  CWD:   ${CWD}`);
  console.log(`  Model: ${MODEL}`);
  console.log(`  Turns: ${TURNS_PER_LEVEL} per level`);
  console.log('');

  const results = [];

  for (let li = 0; li < LEVELS.length; li++) {
    const level = LEVELS[li];
    console.log(`\n▶ ${level.name}`);

    const baseOptions = {
      cwd: CWD,
      permissionMode: 'acceptEdits',
      includePartialMessages: false, // Don't need streaming for this test
    };
    const options = level.build(baseOptions);

    let sessionId = null;

    for (let turn = 1; turn <= TURNS_PER_LEVEL; turn++) {
      const isResume = turn > 1;
      process.stdout.write(`  Turn ${turn} (${isResume ? 'resume' : 'new'})...`);

      const result = await runTurn(level.name, turn, options, isResume ? sessionId : null);

      if (result.capturedSessionId) sessionId = result.capturedSessionId;

      console.log(` cache_read=${result.cacheRead} cache_create=${result.cacheCreate} input=${result.inputTokens} hit=${result.hitRate}% cost=$${result.costUsd.toFixed(4)}`);

      results.push({
        level: level.name,
        turn,
        ...result,
      });
    }

    // Pause between levels
    if (li < LEVELS.length - 1) {
      process.stdout.write(`  (pausing ${PAUSE_BETWEEN_LEVELS_MS / 1000}s...)\n`);
      await new Promise(r => setTimeout(r, PAUSE_BETWEEN_LEVELS_MS));
    }
  }

  // Print summary table
  console.log('\n\n══════════════════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log(
    'Level'.padEnd(32) +
    'Turn'.padEnd(6) +
    'CacheRead'.padEnd(12) +
    'CacheCreate'.padEnd(13) +
    'Input'.padEnd(8) +
    'Hit%'.padEnd(8) +
    'Cost'
  );
  console.log('-'.repeat(85));

  for (const r of results) {
    console.log(
      r.level.padEnd(32) +
      String(r.turn).padEnd(6) +
      String(r.cacheRead).padEnd(12) +
      String(r.cacheCreate).padEnd(13) +
      String(r.inputTokens).padEnd(8) +
      (r.hitRate + '%').padEnd(8) +
      '$' + r.costUsd.toFixed(4)
    );
  }

  // Highlight degradation
  console.log('\n── Cache Hit Comparison (Turn 2-3 avg) ──');
  const l0Hits = results.filter(r => r.level.startsWith('L0') && r.turn > 1);
  const l0Avg = l0Hits.length > 0
    ? l0Hits.reduce((sum, r) => sum + parseFloat(r.hitRate), 0) / l0Hits.length
    : 0;
  console.log(`  L0 baseline avg: ${l0Avg.toFixed(1)}%`);

  for (let li = 1; li < LEVELS.length; li++) {
    const levelHits = results.filter(r => r.level === LEVELS[li].name && r.turn > 1);
    const avg = levelHits.length > 0
      ? levelHits.reduce((sum, r) => sum + parseFloat(r.hitRate), 0) / levelHits.length
      : 0;
    const delta = avg - l0Avg;
    const marker = delta < -10 ? ' ⚠️  DEGRADED' : delta < -5 ? ' ⚡ slight drop' : ' ✅';
    console.log(`  ${LEVELS[li].name}: ${avg.toFixed(1)}% (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%)${marker}`);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
