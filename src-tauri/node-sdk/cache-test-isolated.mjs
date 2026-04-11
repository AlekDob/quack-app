#!/usr/bin/env node
/**
 * Cache Test — ISOLATED Changing ideContext
 *
 * Guarantees a cold cache by temporarily prepending a unique marker to
 * CLAUDE.md, ensuring the system prompt prefix has never been cached.
 * Runs ONLY the changing-ideContext scenario (no constant test beforehand
 * to compete for cache slots).
 *
 * Run: cd src-tauri/node-sdk && node cache-test-isolated.mjs
 */

Symbol.dispose ??= Symbol('Symbol.dispose');
Symbol.asyncDispose ??= Symbol('Symbol.asyncDispose');

import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync, writeFileSync } from 'node:fs';

const CWD = '/Users/fredric/Dev/quack-app';
const CLAUDE_MD = `${CWD}/CLAUDE.md`;
const MODEL = 'claude-haiku-4-5-20251001';
const BASE_PROMPT = 'Test — answer with OK';
const TURNS = 5;
const PAUSE_MS = 15_000;

const MARKER = `<!-- cache-isolation: ${Date.now()}-${Math.random().toString(36).slice(2, 10)} -->\n`;

const IDE_CONTEXTS = [
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/App.tsx open.\nFile length: 13500 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/stores/sessionStore.ts open.\nFile length: 450 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/components/ChatInput.tsx open.\nFile length: 890 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src-tauri/src/claude_cli.rs open.\nFile length: 2200 lines.</ide_opened_file>',
  '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src-tauri/node-sdk/stream-daemon.js open.\nFile length: 1400 lines.</ide_opened_file>',
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

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  Cache Test — ISOLATED Changing ideContext (cold cache guaranteed)   ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`  Marker: ${MARKER.trim()}`);
  console.log(`  Pause between turns: ${PAUSE_MS / 1000}s`);
  console.log(`  Turns: ${TURNS}\n`);

  // Inject unique marker into CLAUDE.md
  const originalContent = readFileSync(CLAUDE_MD, 'utf-8');
  writeFileSync(CLAUDE_MD, MARKER + originalContent, 'utf-8');
  console.log('  ✅ Injected unique marker into CLAUDE.md');

  let sessionId = null;

  try {
    for (let t = 0; t < TURNS; t++) {
      const isResume = t > 0;
      const ideCtx = IDE_CONTEXTS[t % IDE_CONTEXTS.length];

      if (isResume) {
        console.log(`\n  (pausing ${PAUSE_MS / 1000}s...)\n`);
        await new Promise(r => setTimeout(r, PAUSE_MS));
      }

      process.stdout.write(`  Turn ${t + 1} (${isResume ? 'resume' : 'new'})...`);
      const r = await runTurn(t + 1, isResume ? sessionId : null, ideCtx);
      if (r.sid) sessionId = r.sid;

      console.log(` cache_read=${r.cacheRead} cache_create=${r.cacheCreate} input=${r.inputTokens} hit=${r.hitRate}% cost=$${r.costUsd.toFixed(4)}`);
    }
  } finally {
    // Always restore CLAUDE.md
    writeFileSync(CLAUDE_MD, originalContent, 'utf-8');
    console.log('\n  ✅ Restored original CLAUDE.md');
  }

  console.log('\n  Done.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
