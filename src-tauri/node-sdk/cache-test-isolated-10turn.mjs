#!/usr/bin/env node
/**
 * Cache Test — ISOLATED 10-Turn, Alternating Simple + Tool Use
 *
 * Cold cache guaranteed via unique CLAUDE.md marker.
 * Odd turns: "Test — answer with OK"
 * Even turns: Light tool use prompt (e.g., "Read the first 5 lines of package.json")
 * ideContext changes every turn.
 *
 * Run: cd src-tauri/node-sdk && node cache-test-isolated-10turn.mjs
 */

Symbol.dispose ??= Symbol('Symbol.dispose');
Symbol.asyncDispose ??= Symbol('Symbol.asyncDispose');

import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync, writeFileSync } from 'node:fs';

const CWD = '/Users/fredric/Dev/quack-app';
const CLAUDE_MD = `${CWD}/CLAUDE.md`;
const MODEL = 'claude-haiku-4-5-20251001';
const TURNS = 10;
const PAUSE_MS = 15_000;

const MARKER = `<!-- cache-isolation: ${Date.now()}-${Math.random().toString(36).slice(2, 10)} -->\n`;

const SIMPLE_PROMPTS = [
  'Test — answer with OK',
  'What is 2+2? Answer briefly.',
  'Say "hello" and nothing else.',
  'Name one color. One word only.',
  'Confirm you can hear me. One word.',
];

const TOOL_PROMPTS = [
  'Read the first 3 lines of package.json and tell me the project name.',
  'List the files in the src/ directory. Just show the first 5.',
  'Read the first line of tsconfig.json and tell me what it says.',
  'Check how many .ts files are in the src/stores/ folder.',
  'Read the first 2 lines of vite.config.ts and summarize.',
];

const IDE_CONTEXTS = [
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/App.tsx open.\nFile length: 13500 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/stores/sessionStore.ts open.\nFile length: 450 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/components/ChatInput.tsx open.\nFile length: 890 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src-tauri/src/claude_cli.rs open.\nFile length: 2200 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src-tauri/node-sdk/stream-daemon.js open.\nFile length: 1400 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/components/Sidebar.tsx open.\nFile length: 320 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/hooks/useSession.ts open.\nFile length: 180 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/utils/tokenCalc.ts open.\nFile length: 95 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src-tauri/src/main.rs open.\nFile length: 500 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/components/MessageBubble.tsx open.\nFile length: 270 lines.</ide_opened_file>',
];

const ASK_USER_APPEND = `\n## Interactive Questions (AskUserQuestion Tool)\nYou have access to the AskUserQuestion tool. USE IT when you need user input.\nIMPORTANT: Do NOT list options in plain text. Use the AskUserQuestion tool.`;

const ALLOWED_TOOLS = [
  'Task', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
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

async function runTurn(turnNum, sessionId, promptText, ideContext) {
  const options = buildOptions(sessionId);
  const timeout = setTimeout(() => options.abortController.abort(), 120_000);

  const finalPrompt = `${promptText}\n\n<system-reminder>\n\n## IDE Context\n\n${ideContext}\n</system-reminder>`;

  const prompt = (async function* () {
    yield { type: 'user', message: { role: 'user', content: [{ type: 'text', text: finalPrompt }] } };
  })();

  let sid = null, cacheRead = 0, cacheCreate = 0, inputTokens = 0, costUsd = 0;
  let toolsUsed = [];

  try {
    for await (const msg of query({ prompt, options })) {
      if (options.abortController.signal.aborted) break;
      if (msg.type === 'system' && msg.subtype === 'init' && msg.session_id) sid = msg.session_id;
      if (msg.type === 'assistant' && msg.message?.usage) {
        const u = msg.message.usage;
        inputTokens = u.input_tokens ?? 0;
        cacheRead = u.cache_read_input_tokens ?? 0;
        cacheCreate = u.cache_creation_input_tokens ?? 0;
      }
      if (msg.type === 'tool_use') {
        toolsUsed.push(msg.tool_name || msg.name || 'unknown');
      }
      if (msg.type === 'result') { costUsd = msg.total_cost_usd ?? 0; if (msg.session_id) sid = msg.session_id; }
    }
  } catch (err) { console.error(`  ❌ Turn ${turnNum}: ${err.message}`); }
  finally { clearTimeout(timeout); }

  const total = cacheRead + cacheCreate + inputTokens;
  const hitRate = total > 0 ? ((cacheRead / total) * 100).toFixed(1) : '0.0';
  return { sid, cacheRead, cacheCreate, inputTokens, costUsd, hitRate, toolsUsed };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  Cache Test — 10 Turns, Alternating Simple + Tool Use (isolated)    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`  Marker: ${MARKER.trim()}`);
  console.log(`  Pause between turns: ${PAUSE_MS / 1000}s`);
  console.log(`  Turns: ${TURNS} (odd=simple, even=tool use)\n`);

  const originalContent = readFileSync(CLAUDE_MD, 'utf-8');
  writeFileSync(CLAUDE_MD, MARKER + originalContent, 'utf-8');
  console.log('  ✅ Injected unique marker into CLAUDE.md\n');

  let sessionId = null;
  const results = [];

  try {
    for (let t = 0; t < TURNS; t++) {
      const isResume = t > 0;
      const isToolTurn = (t + 1) % 2 === 0; // turns 2,4,6,8,10
      const promptText = isToolTurn
        ? TOOL_PROMPTS[Math.floor(t / 2) % TOOL_PROMPTS.length]
        : SIMPLE_PROMPTS[Math.floor(t / 2) % SIMPLE_PROMPTS.length];
      const ideCtx = IDE_CONTEXTS[t % IDE_CONTEXTS.length];
      const label = isToolTurn ? '🔧 tool' : '💬 simple';

      if (isResume) {
        console.log(`  (pausing ${PAUSE_MS / 1000}s...)`);
        await new Promise(r => setTimeout(r, PAUSE_MS));
      }

      process.stdout.write(`  Turn ${t + 1} [${label}] (${isResume ? 'resume' : 'new'})...`);
      const r = await runTurn(t + 1, isResume ? sessionId : null, promptText, ideCtx);
      if (r.sid) sessionId = r.sid;

      const tools = r.toolsUsed.length > 0 ? ` tools=[${r.toolsUsed.join(',')}]` : '';
      console.log(` cache_read=${r.cacheRead} cache_create=${r.cacheCreate} input=${r.inputTokens} hit=${r.hitRate}% cost=$${r.costUsd.toFixed(4)}${tools}`);
      results.push({ turn: t + 1, type: isToolTurn ? 'tool' : 'simple', ...r });
    }

    // Summary
    console.log('\n  ── Summary ──────────────────────────────────────────────');
    const totalCost = results.reduce((s, r) => s + r.costUsd, 0);
    const avgHit = (results.slice(1).reduce((s, r) => s + parseFloat(r.hitRate), 0) / (results.length - 1)).toFixed(1);
    const warmupCost = results.slice(0, 3).reduce((s, r) => s + r.costUsd, 0);
    const steadyCost = results.slice(3).reduce((s, r) => s + r.costUsd, 0);
    console.log(`  Total cost: $${totalCost.toFixed(4)}`);
    console.log(`  Avg hit rate (turns 2-10): ${avgHit}%`);
    console.log(`  Warm-up cost (turns 1-3): $${warmupCost.toFixed(4)}`);
    console.log(`  Steady-state cost (turns 4-10): $${steadyCost.toFixed(4)}`);

  } finally {
    writeFileSync(CLAUDE_MD, originalContent, 'utf-8');
    console.log('\n  ✅ Restored original CLAUDE.md');
  }

  console.log('\n  Done.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
