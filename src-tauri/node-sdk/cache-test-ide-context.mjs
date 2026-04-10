#!/usr/bin/env node
/**
 * Cache Test — Constant vs Changing ideContext
 *
 * Tests whether changing the ideContext in <system-reminder> per turn
 * breaks caching. Both modes use the async generator prompt with full
 * Quack options.
 *
 * Run: cd src-tauri/node-sdk && node cache-test-ide-context.mjs
 */

Symbol.dispose ??= Symbol('Symbol.dispose');
Symbol.asyncDispose ??= Symbol('Symbol.asyncDispose');

import { query } from '@anthropic-ai/claude-agent-sdk';

const CWD = '/Users/fredric/Dev/quack-app';
const MODEL = 'claude-haiku-4-5-20251001';
const BASE_PROMPT = 'Test — answer with OK';
const TURNS = 4;

const IDE_CONTEXTS = [
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/App.tsx open.\nFile length: 13500 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/stores/sessionStore.ts open.\nFile length: 450 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/components/ChatInput.tsx open.\nFile length: 890 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src-tauri/src/claude_cli.rs open.\nFile length: 2200 lines.</ide_opened_file>',
];

const ASK_USER_APPEND = `\n## Interactive Questions (AskUserQuestion Tool)\nYou have access to the AskUserQuestion tool. USE IT when you need user input.\nIMPORTANT: Do NOT list options in plain text. Use the AskUserQuestion tool.`;

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

async function runTurn(turnNum, sessionId, ideContext) {
  const options = buildOptions(sessionId);
  const timeout = setTimeout(() => options.abortController.abort(), 120_000);

  const finalPrompt = `${BASE_PROMPT}\n\n<system-reminder>\n\n## IDE Context\n\n${ideContext}\n</system-reminder>`;

  const prompt = (async function* () {
    yield { type: 'user', message: { role: 'user', content: [{ type: 'text', text: finalPrompt }] } };
  })();

  let sid = null, cacheRead = 0, cacheCreate = 0, inputTokens = 0, costUsd = 0;

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
      if (msg.type === 'result') { costUsd = msg.total_cost_usd ?? 0; if (msg.session_id) sid = msg.session_id; }
    }
  } catch (err) { console.error(`  ❌ Turn ${turnNum}: ${err.message}`); }
  finally { clearTimeout(timeout); }

  const total = cacheRead + cacheCreate + inputTokens;
  const hitRate = total > 0 ? ((cacheRead / total) * 100).toFixed(1) : '0.0';
  return { sid, cacheRead, cacheCreate, inputTokens, costUsd, hitRate };
}

async function runMode(label, getIdeContext) {
  console.log(`\n▶ ${label}`);
  let sessionId = null;

  for (let t = 0; t < TURNS; t++) {
    const isResume = t > 0;
    const ideCtx = getIdeContext(t);
    process.stdout.write(`  Turn ${t + 1} (${isResume ? 'resume' : 'new'})...`);

    const r = await runTurn(t + 1, isResume ? sessionId : null, ideCtx);
    if (r.sid) sessionId = r.sid;

    console.log(` cache_read=${r.cacheRead} cache_create=${r.cacheCreate} input=${r.inputTokens} hit=${r.hitRate}% cost=$${r.costUsd.toFixed(4)}`);
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  Cache Test — Constant vs Changing ideContext                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');

  await runMode('CONSTANT ideContext (same file every turn)', () => IDE_CONTEXTS[0]);

  console.log('\n  (pausing 8s...)\n');
  await new Promise(r => setTimeout(r, 8000));

  await runMode('CHANGING ideContext (different file each turn)', (t) => IDE_CONTEXTS[t % IDE_CONTEXTS.length]);

  console.log('\n  Done.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
