#!/usr/bin/env node
/**
 * Cache Test — String prompt vs AsyncGenerator prompt
 *
 * Tests whether the prompt format affects caching:
 * - Mode A: Plain string prompt (like Kite)
 * - Mode B: AsyncGenerator prompt (like Quack's generateMessages())
 *
 * Both use identical options, identical prompt text, same ideContext.
 * The ONLY difference is how the prompt is passed to query().
 *
 * Run: cd src-tauri/node-sdk && node cache-test-string-vs-generator.mjs
 */

Symbol.dispose ??= Symbol('Symbol.dispose');
Symbol.asyncDispose ??= Symbol('Symbol.asyncDispose');

import { query } from '@anthropic-ai/claude-agent-sdk';

const CWD = '/Users/fredric/Dev/quack-app';
const MODEL = 'claude-haiku-4-5-20251001';
const BASE_PROMPT = 'Test — answer with OK';
const TURNS = 3;

// Same ideContext every turn (to isolate the variable)
const IDE_CONTEXT = '<ide_opened_file>The user has the file /Users/fredric/Dev/quack-app/src/App.tsx open.</ide_opened_file>';
const CONTEXT_PREFIX = `\n\n## IDE Context\n\n${IDE_CONTEXT}`;
const FINAL_PROMPT = `${BASE_PROMPT}\n\n<system-reminder>\n${CONTEXT_PREFIX}\n</system-reminder>`;

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

IMPORTANT: Do NOT list options in plain text. Use the AskUserQuestion tool to present interactive choices.`;

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

async function runTurn(mode, turnNum, sessionId) {
  const options = buildOptions(sessionId);
  const timeout = setTimeout(() => options.abortController.abort(), 120_000);

  let prompt;
  if (mode === 'string') {
    // Mode A: plain string (like Kite)
    prompt = FINAL_PROMPT;
  } else {
    // Mode B: async generator (like Quack)
    prompt = (async function* () {
      yield {
        type: 'user',
        message: { role: 'user', content: [{ type: 'text', text: FINAL_PROMPT }] },
      };
    })();
  }

  let capturedSessionId = null;
  let cacheRead = 0, cacheCreate = 0, inputTokens = 0, costUsd = 0;

  try {
    const conversation = query({ prompt, options });
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
      }
      if (msg.type === 'result') {
        costUsd = msg.total_cost_usd ?? 0;
        if (msg.session_id) capturedSessionId = msg.session_id;
      }
    }
  } catch (err) {
    console.error(`  ❌ ${mode} Turn ${turnNum}: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  const total = cacheRead + cacheCreate + inputTokens;
  const hitRate = total > 0 ? ((cacheRead / total) * 100).toFixed(1) : '0.0';
  return { capturedSessionId, cacheRead, cacheCreate, inputTokens, costUsd, hitRate };
}

async function runMode(mode) {
  console.log(`\n▶ Mode: ${mode.toUpperCase()} prompt`);
  let sessionId = null;

  for (let turn = 1; turn <= TURNS; turn++) {
    const isResume = turn > 1;
    process.stdout.write(`  Turn ${turn} (${isResume ? 'resume' : 'new'})...`);

    const r = await runTurn(mode, turn, isResume ? sessionId : null);
    if (r.capturedSessionId) sessionId = r.capturedSessionId;

    console.log(
      ` cache_read=${r.cacheRead} cache_create=${r.cacheCreate}` +
      ` input=${r.inputTokens} hit=${r.hitRate}% cost=$${r.costUsd.toFixed(4)}`
    );
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║  Cache Test — String vs AsyncGenerator Prompt                       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`  Same options, same prompt text, same ideContext every turn.`);
  console.log(`  Only difference: how the prompt is passed to query().`);

  await runMode('string');

  console.log('\n  (pausing 5s between modes...)\n');
  await new Promise(r => setTimeout(r, 5000));

  await runMode('generator');

  console.log('\n  Done.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
