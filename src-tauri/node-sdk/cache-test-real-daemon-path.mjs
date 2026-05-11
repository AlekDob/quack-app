#!/usr/bin/env node
/**
 * Cache Test — Real Daemon Path
 *
 * This test reproduces EXACTLY what stream-daemon.js does when the query()
 * fallback path is used (i.e., what happens with QUACK_FORCE_QUERY_MODE=1).
 *
 * It imports the same SDK, builds the same options object, prepends
 * ideContext as <system-reminder>, uses the same generateMessages() async
 * generator, and calls query() with resume — exactly like the daemon does.
 *
 * Run: cd src-tauri/node-sdk && node cache-test-real-daemon-path.mjs
 */

// Polyfill Symbol.dispose for Node.js < 22
Symbol.dispose ??= Symbol('Symbol.dispose');
Symbol.asyncDispose ??= Symbol('Symbol.asyncDispose');

import { query } from '@anthropic-ai/claude-agent-sdk';

// ---------------------------------------------------------------------------
// Replicate stream-daemon.js options construction
// ---------------------------------------------------------------------------
const CWD = '/Users/fredric/Dev/quack-app';
const MODEL = 'claude-haiku-4-5-20251001';
const PROMPT = 'Test — answer with OK';
const TURNS = 4;

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

// Simulate changing IDE context (different open file per turn)
const IDE_CONTEXTS = [
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/App.tsx open in their editor.\nFile length: 13500 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/stores/sessionStore.ts open in their editor.\nFile length: 450 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/components/ChatInput.tsx open in their editor.\nFile length: 890 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src-tauri/src/claude_cli.rs open in their editor.\nFile length: 2200 lines.</ide_opened_file>',
];

// ---------------------------------------------------------------------------
// Build options exactly like stream-daemon.js handleQuery()
// ---------------------------------------------------------------------------
function buildOptions(sessionId) {
  const options = {
    model: MODEL,
    settingSources: ['project', 'user', 'local'],
    tools: { type: 'preset', preset: 'claude_code' },
    allowedTools: ALLOWED_TOOLS,
    abortController: new AbortController(),
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: ASK_USER_APPEND,
    },
    canUseTool: async (toolName, input) => {
      return { behavior: 'allow', updatedInput: input };
    },
    permissionMode: 'bypassPermissions',
    betas: ['context-1m-2025-08-07'],
    cwd: CWD,
    includePartialMessages: false,
    env: { ...process.env, ENABLE_TOOL_SEARCH: 'auto' },
    enableFileCheckpointing: true,
  };

  if (sessionId) options.resume = sessionId;

  return options;
}

// Replicate generateMessages() from stream-daemon.js
function makeGenerateMessages(finalPrompt) {
  return async function* generateMessages() {
    yield {
      type: 'user',
      message: { role: 'user', content: [{ type: 'text', text: finalPrompt }] },
    };
  };
}

// ---------------------------------------------------------------------------
// Run a turn
// ---------------------------------------------------------------------------
async function runTurn(turnNum, sessionId) {
  const options = buildOptions(sessionId);

  // Replicate ideContext prepend — different file open each turn
  const ideContext = IDE_CONTEXTS[turnNum % IDE_CONTEXTS.length];
  const contextPrefix = `\n\n## IDE Context\n\n${ideContext}`;
  const finalPrompt = `${PROMPT}\n\n<system-reminder>\n${contextPrefix}\n</system-reminder>`;

  // Use generateMessages() async generator — same as the daemon's query() fallback path
  const queryPrompt = makeGenerateMessages(finalPrompt);

  let capturedSessionId = null;
  let cacheRead = 0;
  let cacheCreate = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;

  const timeout = setTimeout(() => options.abortController.abort(), 120_000);

  try {
    const conversation = query({ prompt: queryPrompt(), options });

    for await (const msg of conversation) {
      if (options.abortController.signal.aborted) break;

      if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) {
        capturedSessionId = msg.session_id;
      }

      if (msg.type === 'assistant' && msg.message?.usage) {
        const u = msg.message.usage;
        inputTokens = u.input_tokens ?? 0;
        cacheRead = u.cache_read_input_tokens ?? 0;
        cacheCreate = u.cache_creation_input_tokens ?? 0;
        outputTokens = u.output_tokens ?? 0;
      }

      if (msg.type === 'result') {
        costUsd = msg.total_cost_usd ?? 0;
        if (msg.session_id) capturedSessionId = msg.session_id;
      }
    }
  } catch (err) {
    console.error(`  ❌ Turn ${turnNum}: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  const total = cacheRead + cacheCreate + inputTokens;
  const hitRate = total > 0 ? ((cacheRead / total) * 100).toFixed(1) : '0.0';

  return { capturedSessionId, cacheRead, cacheCreate, inputTokens, outputTokens, costUsd, hitRate };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  Cache Test — Real Daemon Path (query() with full Quack options)    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`  CWD:   ${CWD}`);
  console.log(`  Model: ${MODEL}`);
  console.log(`  Turns: ${TURNS}`);
  console.log(`  Mode:  generateMessages() async generator + <system-reminder> ideContext`);
  console.log(`  NOTE:  ideContext CHANGES each turn (simulating switching open files)`);
  console.log('');

  let sessionId = null;
  const results = [];

  for (let turn = 0; turn < TURNS; turn++) {
    const isResume = turn > 0;
    process.stdout.write(`  Turn ${turn + 1} (${isResume ? 'resume' : 'new'}, file=${turn % IDE_CONTEXTS.length})...`);

    const result = await runTurn(turn, isResume ? sessionId : null);
    if (result.capturedSessionId) sessionId = result.capturedSessionId;

    console.log(
      ` cache_read=${result.cacheRead}` +
      ` cache_create=${result.cacheCreate}` +
      ` input=${result.inputTokens}` +
      ` hit=${result.hitRate}%` +
      ` cost=$${result.costUsd.toFixed(4)}`
    );

    results.push({ turn: turn + 1, ...result });
  }

  // Summary
  console.log('\n── Summary ──');
  console.log(
    'Turn'.padEnd(6) +
    'CacheRead'.padEnd(12) +
    'CacheCreate'.padEnd(13) +
    'Input'.padEnd(8) +
    'Hit%'.padEnd(8) +
    'Cost'.padEnd(10) +
    'IDE File'
  );
  console.log('-'.repeat(70));

  for (const r of results) {
    console.log(
      String(r.turn).padEnd(6) +
      String(r.cacheRead).padEnd(12) +
      String(r.cacheCreate).padEnd(13) +
      String(r.inputTokens).padEnd(8) +
      (r.hitRate + '%').padEnd(8) +
      ('$' + r.costUsd.toFixed(4)).padEnd(10) +
      IDE_CONTEXTS[(r.turn - 1) % IDE_CONTEXTS.length].slice(0, 40) + '...'
    );
  }

  const resumedHits = results.filter(r => r.turn > 1);
  const avgHit = resumedHits.length > 0
    ? resumedHits.reduce((sum, r) => sum + parseFloat(r.hitRate), 0) / resumedHits.length
    : 0;
  console.log(`\n  Resumed turns avg cache hit: ${avgHit.toFixed(1)}%`);
  console.log(avgHit > 90 ? '  ✅ Caching is working — safe to remove persistent subprocess' : '  ⚠️  Cache degradation detected — investigate before removing');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
