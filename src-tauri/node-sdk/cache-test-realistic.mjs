#!/usr/bin/env node
/**
 * Cache Test — Realistic User Timing
 *
 * Simulates a real user: send a message, wait 30-45s (reading the response,
 * thinking), then send the next. ideContext changes each turn (user switches
 * files between messages). Full Quack options, generator prompt.
 *
 * Run: cd src-tauri/node-sdk && node cache-test-realistic.mjs
 */

Symbol.dispose ??= Symbol('Symbol.dispose');
Symbol.asyncDispose ??= Symbol('Symbol.asyncDispose');

import { query } from '@anthropic-ai/claude-agent-sdk';

const CWD = '/Users/fredric/Dev/quack-app';
const MODEL = 'claude-haiku-4-5-20251001';
const TURNS = 5;
const PAUSE_BETWEEN_TURNS_MS = 35_000; // 35 seconds — realistic "read + think" time

const PROMPTS = [
  'Explain briefly what the SessionProcess class does in stream-daemon.js',
  'What options does it pass to the CLI subprocess?',
  'How does the fingerprint system work?',
  'What happens when the fingerprint changes between turns?',
  'OK thanks, that clears it up.',
];

const IDE_CONTEXTS = [
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src-tauri/node-sdk/stream-daemon.js open in their editor.\nActive line range: 320-400\nFile length: 1650 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/App.tsx open in their editor.\nActive line range: 2680-2750\nFile length: 13500 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src-tauri/src/claude_cli.rs open in their editor.\nActive line range: 1970-2050\nFile length: 2400 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/stores/sessionStore.ts open in their editor.\nActive line range: 1-50\nFile length: 380 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/documentation/bugs/bug-post-fix-cache-breakage-investigation.md open in their editor.\nActive line range: 100-150\nFile length: 220 lines.</ide_opened_file>',
];

const ASK_USER_APPEND = `\n## Interactive Questions (AskUserQuestion Tool)\nYou have access to the AskUserQuestion tool. USE IT when you need user input to make a decision instead of asking in plain text.\n**ALWAYS use AskUserQuestion when:**\n- User must choose between 2-4 implementation approaches\n- Selecting technologies, libraries, or patterns\n- Confirming potentially destructive actions\n- Getting preferences for ambiguous requirements\n- The user asks you to help them choose something\n**Do NOT use it for:**\n- Open-ended questions needing detailed text responses\n- Questions with more than 4 options\n- Simple confirmations inferrable from context\nIMPORTANT: Do NOT list options in plain text. Use the AskUserQuestion tool to present interactive choices.`;

const ALLOWED_TOOLS = [
  'Skill', 'Task', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
  'WebFetch', 'WebSearch', 'TodoWrite', 'NotebookEdit', 'SlashCommand',
  'BashOutput', 'KillShell', 'ExitPlanMode', 'AskUserQuestion',
];

function buildOptions(sessionId) {
  const options = {
    model: MODEL,
    settingSources: ['project', 'user', 'local'],
    tools: { type: 'preset', preset: 'claude_code' },
    allowedTools: ALLOWED_TOOLS,
    abortController: new AbortController(),
    systemPrompt: { type: 'preset', preset: 'claude_code', append: ASK_USER_APPEND },
    canUseTool: async (_t, input) => ({ behavior: 'allow', updatedInput: input }),
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

async function runTurn(turnIdx, sessionId) {
  const options = buildOptions(sessionId);
  const timeout = setTimeout(() => options.abortController.abort(), 120_000);

  const ideContext = IDE_CONTEXTS[turnIdx % IDE_CONTEXTS.length];
  const userPrompt = PROMPTS[turnIdx % PROMPTS.length];
  const finalPrompt = `${userPrompt}\n\n<system-reminder>\n\n## IDE Context\n\n${ideContext}\n</system-reminder>`;

  const prompt = (async function* () {
    yield { type: 'user', message: { role: 'user', content: [{ type: 'text', text: finalPrompt }] } };
  })();

  let sid = null, cacheRead = 0, cacheCreate = 0, inputTokens = 0, outputTokens = 0, costUsd = 0;

  try {
    for await (const msg of query({ prompt, options })) {
      if (options.abortController.signal.aborted) break;
      if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) sid = msg.session_id;
      if (msg.type === 'assistant' && msg.message?.usage) {
        const u = msg.message.usage;
        inputTokens = u.input_tokens ?? 0;
        cacheRead = u.cache_read_input_tokens ?? 0;
        cacheCreate = u.cache_creation_input_tokens ?? 0;
        outputTokens = u.output_tokens ?? 0;
      }
      if (msg.type === 'result') { costUsd = msg.total_cost_usd ?? 0; if (msg.session_id) sid = msg.session_id; }
    }
  } catch (err) { console.error(`  ❌ Turn ${turnIdx + 1}: ${err.message}`); }
  finally { clearTimeout(timeout); }

  const total = cacheRead + cacheCreate + inputTokens;
  const hitRate = total > 0 ? ((cacheRead / total) * 100).toFixed(1) : '0.0';
  return { sid, cacheRead, cacheCreate, inputTokens, outputTokens, costUsd, hitRate };
}

function fmtTime(ms) {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m${s % 60}s` : `${s}s`;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  Cache Test — Realistic User Timing (35s between messages)          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`  CWD:          ${CWD}`);
  console.log(`  Model:        ${MODEL}`);
  console.log(`  Turns:        ${TURNS}`);
  console.log(`  Pause:        ${PAUSE_BETWEEN_TURNS_MS / 1000}s between turns`);
  console.log(`  ideContext:    CHANGES each turn (different open file)`);
  console.log(`  Prompt:       CHANGES each turn (different questions)`);
  console.log(`  Est. runtime: ~${fmtTime(TURNS * (PAUSE_BETWEEN_TURNS_MS + 15_000))}`);
  console.log('');

  const startTime = Date.now();
  let sessionId = null;
  const results = [];

  for (let t = 0; t < TURNS; t++) {
    const isResume = t > 0;
    const elapsed = fmtTime(Date.now() - startTime);
    process.stdout.write(`  [${elapsed}] Turn ${t + 1}/${TURNS} (${isResume ? 'resume' : 'new'}) "${PROMPTS[t].slice(0, 50)}..."  `);

    const r = await runTurn(t, isResume ? sessionId : null);
    if (r.sid) sessionId = r.sid;

    console.log(
      `→ read=${r.cacheRead} create=${r.cacheCreate} input=${r.inputTokens} out=${r.outputTokens} hit=${r.hitRate}% $${r.costUsd.toFixed(4)}`
    );

    results.push({ turn: t + 1, prompt: PROMPTS[t].slice(0, 40), ...r });

    if (t < TURNS - 1) {
      process.stdout.write(`         waiting ${PAUSE_BETWEEN_TURNS_MS / 1000}s...`);
      await new Promise(r => setTimeout(r, PAUSE_BETWEEN_TURNS_MS));
      console.log(' go');
    }
  }

  console.log(`\n  Total time: ${fmtTime(Date.now() - startTime)}\n`);

  console.log('── Results ──');
  console.log(
    'Turn'.padEnd(6) +
    'CacheRead'.padEnd(12) +
    'CacheCreate'.padEnd(13) +
    'Input'.padEnd(8) +
    'Output'.padEnd(8) +
    'Hit%'.padEnd(8) +
    'Cost'.padEnd(10) +
    'Prompt'
  );
  console.log('-'.repeat(95));
  for (const r of results) {
    console.log(
      String(r.turn).padEnd(6) +
      String(r.cacheRead).padEnd(12) +
      String(r.cacheCreate).padEnd(13) +
      String(r.inputTokens).padEnd(8) +
      String(r.outputTokens).padEnd(8) +
      (r.hitRate + '%').padEnd(8) +
      ('$' + r.costUsd.toFixed(4)).padEnd(10) +
      r.prompt + '...'
    );
  }

  const resumed = results.filter(r => r.turn > 1);
  const avgHit = resumed.length > 0
    ? resumed.reduce((s, r) => s + parseFloat(r.hitRate), 0) / resumed.length
    : 0;
  const totalCost = results.reduce((s, r) => s + r.costUsd, 0);
  console.log(`\n  Avg resumed hit rate: ${avgHit.toFixed(1)}%`);
  console.log(`  Total cost: $${totalCost.toFixed(4)}`);
  console.log(avgHit > 90 ? '\n  ✅ Caching works under realistic conditions' : '\n  ⚠️  Cache degradation — needs investigation');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
