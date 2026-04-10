#!/usr/bin/env node
/**
 * Cache Test — Cold Start with Realistic Timing
 *
 * Uses claude-agents-test as CWD (never tested with these options before)
 * to ensure a truly cold cache on Turn 1. Then 35s pauses between turns.
 *
 * Run: cd src-tauri/node-sdk && node cache-test-cold-start.mjs
 */

Symbol.dispose ??= Symbol('Symbol.dispose');
Symbol.asyncDispose ??= Symbol('Symbol.asyncDispose');

import { query } from '@anthropic-ai/claude-agent-sdk';

// Use a CWD we haven't tested with these options — cold cache guaranteed
const CWD = '/Users/fredric/Dev/claude-agents-test';
const MODEL = 'claude-haiku-4-5-20251001';
const TURNS = 5;
const PAUSE_BETWEEN_TURNS_MS = 35_000;

const PROMPTS = [
  'Explain briefly what this project does',
  'What SDK version does it use?',
  'How does session resumption work?',
  'What message types does it handle?',
  'OK thanks.',
];

const IDE_CONTEXTS = [
  '<ide_opened_file>The user has the file /Users/fredric/Dev/claude-agents-test/src/main/session-manager.ts open.\nActive line range: 1-50\nFile length: 170 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/claude-agents-test/src/main/ipc-handlers.ts open.\nActive line range: 1-30\nFile length: 89 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/claude-agents-test/src/main/usage-tracker.ts open.\nActive line range: 60-90\nFile length: 126 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/claude-agents-test/package.json open.\nActive line range: 1-20\nFile length: 45 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/claude-agents-test/docs/session-lifecycle.md open.\nActive line range: 1-40\nFile length: 304 lines.</ide_opened_file>',
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
  console.log('║  Cache Test — COLD START + Realistic Timing                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`  CWD:          ${CWD} (fresh — never tested with these options)`);
  console.log(`  Model:        ${MODEL}`);
  console.log(`  Turns:        ${TURNS}`);
  console.log(`  Pause:        ${PAUSE_BETWEEN_TURNS_MS / 1000}s between turns`);
  console.log(`  ideContext:    CHANGES each turn`);
  console.log(`  Prompt:       CHANGES each turn`);
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
      await new Promise(resolve => setTimeout(resolve, PAUSE_BETWEEN_TURNS_MS));
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
      String(r.cacheCreate).padEnd(12) +
      String(r.cacheRead).padEnd(13) +
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

  console.log(`\n  Turn 1 (cold start): read=${results[0].cacheRead} create=${results[0].cacheCreate}`);
  console.log(`  Avg resumed hit rate (turns 2-5): ${avgHit.toFixed(1)}%`);
  console.log(`  Total cost: $${totalCost.toFixed(4)}`);
  console.log(
    results[0].cacheRead === 0
      ? '  ✅ Confirmed cold start (0 cache_read on Turn 1)'
      : `  ⚠️  Turn 1 had cache_read=${results[0].cacheRead} — not a fully cold start`
  );
  console.log(avgHit > 90 ? '  ✅ Caching works under realistic conditions' : '  ⚠️  Cache degradation — needs investigation');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
