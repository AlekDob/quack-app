#!/usr/bin/env node

// Brain: sdk-requires-node22-disposable
// Polyfill Symbol.dispose for Node.js < 22 (Explicit Resource Management)
Symbol.dispose ??= Symbol('Symbol.dispose');
Symbol.asyncDispose ??= Symbol('Symbol.asyncDispose');

/**
 * Persistent Node.js daemon for Claude Agent SDK.
 *
 * Instead of spawning a new process per message (20+ second startup),
 * this daemon stays alive and handles multiple queries via stdin/stdout IPC.
 *
 * Protocol:
 *   stdin  (Rust → Node): JSON line commands (query, abort, response, ping, shutdown)
 *   stdout (Node → Rust): JSON line events (daemon_ready, event, query_complete, pong)
 *   stderr: Debug logging only
 *
 * Brain: persistent-daemon-architecture
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { extname, join, dirname } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import { appendFileSync } from 'fs';

// 🐛 DIAG: Write diagnostics to a file that's easy to check
const DIAG_FILE = join(homedir(), '.quack', 'daemon-diag.log');
function diag(msg) {
  try {
    appendFileSync(DIAG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) { /* ignore */ }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// SKILL LOADER — reads bundled skill files for system prompt injection
// Brain: debug-mode-auto-skill-injection
// =============================================================================

/**
 * Load a bundled skill markdown file from src-tauri/node-sdk/skills/
 * Returns the file content or null if not found.
 */
function loadBundledSkill(skillName) {
  const skillPath = join(__dirname, 'skills', `${skillName}.md`);
  try {
    if (existsSync(skillPath)) {
      return readFileSync(skillPath, 'utf-8');
    }
  } catch { /* ignore read errors */ }
  return null;
}

// =============================================================================
// DEBUG MODE HELPERS — Brain hints + Git context for system prompt injection
// Brain: debug-mode-v2-brain-git-context
// =============================================================================

/**
 * Load Brain entry slugs from documentation/bugs/ and documentation/gotchas/.
 * Returns an array of relative paths (e.g. "documentation/bugs/fix-memory-leak.md").
 * Lightweight: only reads directory listings, never file contents.
 */
function loadBrainHints(projectCwd) {
  if (!projectCwd) return [];
  const dirs = ['documentation/bugs', 'documentation/gotchas'];
  const slugs = [];
  for (const dir of dirs) {
    const fullDir = join(projectCwd, dir);
    if (!existsSync(fullDir)) continue;
    try {
      for (const f of readdirSync(fullDir)) {
        if (f.endsWith('.md')) slugs.push(`${dir}/${f}`);
      }
    } catch { /* ignore read errors */ }
  }
  return slugs.slice(0, 50);
}

/**
 * Load recent git context (last 5 commits + uncommitted changes).
 * Returns a markdown block or empty string if not a git repo.
 * Timeout: 3s to avoid blocking on slow repos.
 */
function loadGitContext(projectCwd) {
  if (!projectCwd) return '';
  try {
    const opts = { cwd: projectCwd, encoding: 'utf-8', timeout: 3000 };
    const log = execSync('git log --oneline -5 2>/dev/null', opts).trim();
    const stat = execSync('git diff --stat 2>/dev/null', opts).trim();
    if (!log && !stat) return '';
    let ctx = '\n## Recent Git Context (auto-loaded for debugging)\n\n';
    if (log) ctx += `### Last 5 commits\n\`\`\`\n${log}\n\`\`\`\n\n`;
    if (stat) ctx += `### Uncommitted changes\n\`\`\`\n${stat}\n\`\`\`\n\n`;
    return ctx;
  } catch { return ''; }
}

// =============================================================================
// EMIT HELPERS
// =============================================================================

function emit(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function log(tag, ...args) {
  console.error(`[DAEMON:${tag}]`, ...args);
}

// =============================================================================
// ANTHROPIC SDK CLIENT — for countTokens API (precise overhead measurement)
// Brain: gotcha-stamina-overhead-static-estimate
// =============================================================================

let anthropicClient = null;

function getAnthropicClient() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

/**
 * Count tokens for a user prompt using the Anthropic countTokens API.
 * Returns the input_tokens count, or null if the API call fails.
 * This is a FREE API call — no billing.
 */
async function countPromptTokens(modelId, promptContent) {
  try {
    const client = getAnthropicClient();
    const messages = [{ role: 'user', content: promptContent }];
    const result = await client.messages.countTokens({
      model: modelId,
      messages,
    });
    log('TOKENS', `countTokens result: ${result.input_tokens} tokens for prompt`);
    return result.input_tokens;
  } catch (err) {
    log('TOKENS', `countTokens failed (non-blocking): ${err.message}`);
    return null;
  }
}

// =============================================================================
// ACTIVE QUERY TRACKING
// =============================================================================

/**
 * Active queries: queryId → { abortController, pendingRequests }
 * Each query has its own AbortController for independent cancellation.
 */
const activeQueries = new Map();

/**
 * Global pending requests map (keyed by requestId).
 * AskUserQuestion and PlanApproval responses are routed here.
 */
const pendingRequests = new Map();

// =============================================================================
// MCP SERVER LOADING (reused from stream-claude.js)
// =============================================================================

function loadGlobalMCPServers() {
  const globalMcpPath = join(homedir(), '.quack', 'mcp', '.mcp.json');
  if (!existsSync(globalMcpPath)) return {};

  try {
    const globalConfig = JSON.parse(readFileSync(globalMcpPath, 'utf8'));
    if (!globalConfig.mcpServers || typeof globalConfig.mcpServers !== 'object') return {};

    const servers = {};
    for (const [name, config] of Object.entries(globalConfig.mcpServers)) {
      if (config.type === 'sse' || config.type === 'http') {
        servers[name] = { type: config.type, url: config.url, headers: config.headers };
      } else {
        servers[name] = { command: config.command, args: config.args || [], env: config.env };
      }
    }
    log('MCP', `Loaded ${Object.keys(servers).length} global MCP servers`);
    return servers;
  } catch (error) {
    log('MCP', `Error reading global .mcp.json: ${error.message}`);
    return {};
  }
}

function loadMCPServersFromFile(workingDir) {
  const globalServers = loadGlobalMCPServers();
  const mcpJsonPath = join(workingDir || process.cwd(), '.mcp.json');

  if (!existsSync(mcpJsonPath)) {
    return Object.keys(globalServers).length > 0 ? globalServers : undefined;
  }

  try {
    const mcpConfig = JSON.parse(readFileSync(mcpJsonPath, 'utf8'));
    if (!mcpConfig.mcpServers || typeof mcpConfig.mcpServers !== 'object') {
      return Object.keys(globalServers).length > 0 ? globalServers : undefined;
    }

    const servers = { ...globalServers };
    for (const [name, config] of Object.entries(mcpConfig.mcpServers)) {
      if (config.type === 'sse' || config.type === 'http') {
        servers[name] = { type: config.type, url: config.url, headers: config.headers };
      } else {
        servers[name] = { command: config.command, args: config.args || [], env: config.env };
      }
    }
    return Object.keys(servers).length > 0 ? servers : undefined;
  } catch (error) {
    log('MCP', `Error reading project .mcp.json: ${error.message}`);
    return Object.keys(globalServers).length > 0 ? globalServers : undefined;
  }
}

// =============================================================================
// MODEL MAPPING (reused from stream-claude.js)
// =============================================================================

function getModelId(model) {
  // Handle [1m] suffix for 1M context window (e.g., 'opus46[1m]' -> 'claude-opus-4-6[1m]')
  // The SDK natively supports the [1m] suffix appended to model IDs.
  const has1MSuffix = model.endsWith('[1m]');
  const baseModel = has1MSuffix ? model.replace('[1m]', '') : model;

  // Last line of defense: map both legacy short names AND Supabase IDs
  // to valid API model IDs. The frontend should resolve via Supabase config,
  // but if it fails (offline, slow load), these prevent "invalid model" errors.
  const fallbackMap = {
    // Legacy short names
    'haiku': 'claude-haiku-4-5',
    'sonnet': 'claude-sonnet-4-5-20250929',
    'opus': 'claude-opus-4-5-20251101',
    // Supabase IDs (must be kept in sync with Supabase app_config)
    'haiku45': 'claude-haiku-4-5',
    'sonnet45': 'claude-sonnet-4-5-20250929',
    'opus45': 'claude-opus-4-5-20251101',
    'opus46': 'claude-opus-4-6',
    'sonnet46': 'claude-sonnet-4-6',
  };

  const resolved = fallbackMap[baseModel] || baseModel;
  // Re-append [1m] suffix if present — SDK strips it before sending to API
  return has1MSuffix ? `${resolved}[1m]` : resolved;
}

// =============================================================================
// IMAGE ATTACHMENT SUPPORT (reused from stream-claude.js)
// =============================================================================

function fileToImageBlock(filePath) {
  try {
    const ext = extname(filePath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp',
    };
    const mediaType = mimeTypes[ext];
    if (!mediaType) return null;
    const data = readFileSync(filePath, 'base64');
    return { type: 'image', source: { type: 'base64', media_type: mediaType, data } };
  } catch (error) {
    log('QUERY', `Failed to read image file ${filePath}: ${error.message}`);
    return null;
  }
}

function createMessageContent(text, imagePaths = []) {
  const content = [{ type: 'text', text }];
  if (imagePaths && imagePaths.length > 0) {
    for (const path of imagePaths) {
      const imageBlock = fileToImageBlock(path);
      if (imageBlock) content.push(imageBlock);
    }
  }
  return content;
}

// =============================================================================
// TEAM PROMPT AUGMENTATION (reused from stream-claude.js)
// =============================================================================

function buildTeamPromptAugmentation(tc) {
  const teammates = tc.members.filter(m => !m.isLead);
  let aug = `\n\n## Agent Teams Mode\n\n`;
  aug += `You are the **TEAM LEAD** of team "${tc.teamName}".\n`;
  aug += `Quack is the visual display layer - do NOT use tmux.\n\n`;
  if (teammates.length > 0) {
    aug += `### Your Teammates\n\n`;
    aug += `When you need to delegate work, spawn teammates using the TeammateTool. `;
    aug += `Each teammate will read CLAUDE.md and find their personality in the Team Roster.\n\n`;
    for (const mate of teammates) {
      aug += `- **${mate.name}** (${mate.role}) - Style: ${mate.communicationStyle}\n`;
    }
    aug += `\n`;
  }
  return aug;
}

// =============================================================================
// QUERY HANDLER — Core logic for handling a "query" command
// =============================================================================

async function handleQuery(cmd) {
  const {
    queryId, prompt, model = 'opus', permissionMode, thinkingMode,
    cwd, sessionId, agents, attachments, outputFormat, effort,
    mcpServers: passedMcpServers, allowedTools, teamContext, ideContext,
    provider, providerBaseUrl, providerApiKey, debugMode, chatMode,
  } = cmd;

  const abortController = new AbortController();

  // Track plan approval state per query (Brain: fix-duplicate-plan-approval)
  let planAlreadyApproved = false;

  activeQueries.set(queryId, { abortController });
  log('QUERY', `Starting query=${queryId} model=${model} cwd=${cwd || 'default'} resume=${sessionId || '(new)'} activeQueries=${activeQueries.size}`);
  diag(`QUERY_START: queryId=${queryId}, permissionMode=${permissionMode || '(none/act)'}, model=${model}, activeQueries=${activeQueries.size}`);

  // 🦆 LLM Provider: set env vars per-query for custom/ollama providers
  // Save originals so we can restore after the query (daemon is persistent)
  const savedBaseUrl = process.env.ANTHROPIC_BASE_URL;
  const savedApiKey = process.env.ANTHROPIC_API_KEY;
  const savedAuthToken = process.env.ANTHROPIC_AUTH_TOKEN;

  if (provider === 'ollama') {
    process.env.ANTHROPIC_BASE_URL = providerBaseUrl || 'http://localhost:11434';
    process.env.ANTHROPIC_API_KEY = 'ollama';
    process.env.ANTHROPIC_AUTH_TOKEN = 'ollama';
    log('QUERY', `🦙 Provider: Ollama at ${process.env.ANTHROPIC_BASE_URL}`);
  } else if (provider === 'custom') {
    if (providerBaseUrl) {
      process.env.ANTHROPIC_BASE_URL = providerBaseUrl;
      log('QUERY', `🔧 Provider: Custom at ${providerBaseUrl}`);
    }
    if (providerApiKey) {
      process.env.ANTHROPIC_API_KEY = providerApiKey;
    }
  }

  try {
    // --- Build SDK options (same logic as stream-claude.js) ---
    const modelId = getModelId(model);
    const is1MContext = modelId.endsWith('[1m]');
    log('QUERY', `Model mapping: "${model}" → "${modelId}" (1M context: ${is1MContext})`);

    const defaultAllowedTools = [
      'Skill', 'Task', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
      'WebFetch', 'WebSearch', 'TodoWrite', 'NotebookEdit', 'SlashCommand',
      'BashOutput', 'KillShell', 'ExitPlanMode', 'AskUserQuestion',
    ];
    const resolvedAllowedTools = allowedTools && Array.isArray(allowedTools) && allowedTools.length > 0
      ? allowedTools : defaultAllowedTools;

    // Brain: gotcha-sdk-bundled-cli-200k-context-window
    // The native Claude CLI binary handles prompt caching ~20x more efficiently
    // than the SDK's bundled cli.js (300 vs 6200 uncached tokens/message).
    // It also correctly resolves the 1M context window feature flag.
    const isWindows = process.platform === 'win32';
    const nativeClaudePath = isWindows
      ? join(homedir(), '.claude', 'local', 'claude.exe')
      : join(homedir(), '.local', 'bin', 'claude');
    const hasNativeCli = existsSync(nativeClaudePath);
    debugLog(`CLI: ${hasNativeCli ? 'native (' + nativeClaudePath + ')' : 'bundled cli.js'}`);

    const options = {
      model: modelId,
      // Brain: 1m-context-window-support
      // The [1m] suffix in modelId is enough — the CLI handles it natively.
      // Opus 4.6 has 1M automatically; Sonnet 4.6 uses [1m] suffix for explicit opt-in.
      // 🐛 DEBUG: Disabled native CLI to test AskUserQuestion hang regression
      // ...(hasNativeCli ? { pathToClaudeCodeExecutable: nativeClaudePath } : {}),
      settingSources: ['project', 'user', 'local'],
      tools: { type: 'preset', preset: 'claude_code' },
      allowedTools: resolvedAllowedTools,
      abortController,
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: `

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

IMPORTANT: Do NOT list options in plain text. Use the AskUserQuestion tool to present interactive choices.`
        + (debugMode ? (() => {
          // Brain: fix-session-limit-prompt-cache
          // STATIC parts only in systemPrompt (skill + brain hints — don't change between turns)
          // DYNAMIC parts (gitContext) moved to contextPrefix below
          const skillContent = loadBundledSkill('systematic-debugging');
          const brainHints = loadBrainHints(cwd);
          const hintsBlock = brainHints.length > 0
            ? brainHints.map(s => `- ${s}`).join('\n')
            : '(no Brain entries found in this project)';

          let debugPrompt = '';

          // 1. Skill content (methodology reference — static)
          if (skillContent) {
            debugPrompt += `\n\n## Systematic Debugging Methodology\n\n${skillContent}`;
          }

          // 2. Git context REMOVED from here — it's dynamic and breaks prompt cache
          // Now injected as contextPrefix in the user prompt

          // 3. Brain-First Protocol (static per project)
          debugPrompt += `

## DEBUG MODE — MANDATORY BRAIN-FIRST PROTOCOL

You are in **DEBUG MODE**. Before writing ANY code or investigating ANY file, you MUST complete Step 0.

### STEP 0: Brain Check (REQUIRED — skip = invalid session)

1. Read CLAUDE.md's "Knowledge Base" section — it lists critical gotchas, bugs, and patterns with file paths
2. Identify which entries relate to the user's problem (match by keyword/area)
3. Use the Read tool to read those .md files
4. If nothing in Knowledge Base matches, search \`documentation/bugs/\` and \`documentation/gotchas/\` with Grep
5. State what you found (or "No relevant Brain entries found") BEFORE proceeding

### Available Brain entries in this project:
${hintsBlock}

### Example — what WRONG vs RIGHT looks like:
**User:** "The stamina bar shows 100% even after many messages"
**WRONG:** "Let me look at StaminaBarBorder..." ← skipped Brain, will waste 20 min rediscovering a known fix
**RIGHT:** "Checking Brain... found fix-stamina-messages-zero-modelusage-fallback.md. Reading it now..." ← 2 min fix

### CRITICAL RULES:
1. **Brain first** — ALWAYS complete Step 0 before any investigation
2. **Never guess** — Trace data flow, verify with evidence. Read the actual code.
3. **Document findings** — Save to Brain + add \`// Brain: {slug}\` breadcrumbs in code
`;
          return debugPrompt;
        })() : '')
        + (chatMode ? (() => {
          const skillContent = loadBundledSkill('chat-interaction');
          if (skillContent) {
            return `\n\n## Chat Interaction Mode\n\n${skillContent}`;
          }
          return '';
        })() : '')
        + (teamContext ? buildTeamPromptAugmentation(teamContext) : ''),
        // Brain: fix-session-limit-prompt-cache
        // ideContext is NO LONGER appended here — it changes every turn (file open, git status)
        // which would invalidate the entire system prompt cache (~50k+ tokens).
        // Instead, ideContext is prepended to the user prompt. See contextPrefix below.
      },
      canUseTool: async (toolName, input, toolOptions) => {
        // AskUserQuestion — forward to frontend
        if (toolName === 'AskUserQuestion') {
          diag(`canUseTool AskUserQuestion triggered for query=${queryId}`);
          try {
            const response = await requestFromFrontend(queryId, 'ask_user_question', {
              questions: input.questions,
            });
            diag(`canUseTool AskUserQuestion RESOLVED for query=${queryId}: ${JSON.stringify(response.answers).slice(0, 200)}`);
            const result = {
              behavior: 'allow',
              updatedInput: { questions: input.questions, answers: response.answers },
            };
            log('INTERACT', `[INFO] AskUserQuestion returning to SDK: ${JSON.stringify(result).slice(0, 300)}`);
            return result;
          } catch (error) {
            log('INTERACT', `[WARN] AskUserQuestion FAILED for query=${queryId}: ${error.message}`);
            return { behavior: 'deny', message: `Failed to get user answers: ${error.message}` };
          }
        }

        // ExitPlanMode — forward to frontend (Brain: fix-duplicate-plan-approval)
        if (toolName === 'ExitPlanMode') {
          if (planAlreadyApproved) {
            log('INTERACT', `[INFO] ExitPlanMode already approved, skipping for query=${queryId}`);
            return { behavior: 'allow', updatedInput: input };
          }
          diag(`canUseTool ExitPlanMode triggered for query=${queryId}`);
          try {
            const response = await requestFromFrontend(queryId, 'plan_approval_request', { plan: input });
            const answers = response.answers || response;
            diag(`canUseTool ExitPlanMode RESOLVED for query=${queryId}: ${JSON.stringify(answers).slice(0, 200)}`);
            const isApproved = answers.approved === 'true' || answers.approved === true;
            if (isApproved) {
              planAlreadyApproved = true;
              log('INTERACT', `[INFO] ExitPlanMode APPROVED for query=${queryId} — returning allow to SDK`);
              return { behavior: 'allow', updatedInput: input };
            } else {
              log('INTERACT', `[INFO] ExitPlanMode REJECTED for query=${queryId} — returning deny to SDK`);
              return { behavior: 'deny', message: answers.feedback || 'User rejected the plan' };
            }
          } catch (error) {
            log('INTERACT', `[WARN] ExitPlanMode FAILED for query=${queryId}: ${error.message}`);
            return { behavior: 'deny', message: `Failed to get plan approval: ${error.message}` };
          }
        }

        // Default: allow
        return { behavior: 'allow', updatedInput: input };
      },
    };

    // Permission mode
    if (permissionMode !== undefined) {
      options.permissionMode = permissionMode;
    }

    // Thinking mode → thinking config + effort
    if (thinkingMode === 'disabled') {
      options.thinking = { type: 'disabled' };
    } else if (thinkingMode && thinkingMode !== 'auto') {
      options.thinking = { type: 'adaptive' };
      if (!effort) {
        const thinkingToEffort = { 'think': 'medium', 'hard': 'high', 'harder': 'max', 'ultra': 'max' };
        if (thinkingToEffort[thinkingMode]) options.effort = thinkingToEffort[thinkingMode];
      }
    }

    // Brain: fix-daemon-missing-1m-context-betas
    // Enable 1M context window for supported models (Opus 4.6, Sonnet 4.6)
    // Without this, the SDK operates at 200k and auto-compacts at ~155k tokens.
    options.betas = ['context-1m-2025-08-07'];

    if (cwd) options.cwd = cwd;
    if (sessionId) options.resume = sessionId;
    if (effort) options.effort = effort;

    if (agents && Array.isArray(agents) && agents.length > 0) {
      options.agents = agents.map(agent => ({
        name: agent.name, description: agent.description,
        model: agent.model, path: agent.filePath,
      }));
    }

    if (outputFormat) options.outputFormat = outputFormat;

    // Environment (tool search + task list)
    options.env = { ...process.env, ENABLE_TOOL_SEARCH: 'auto' };
    if (sessionId) {
      options.env.CLAUDE_CODE_TASK_LIST_ID = `quack-${sessionId}`;
    }

    options.enableFileCheckpointing = true;

    // --- MCP servers ---
    let resolvedMcpServers = passedMcpServers;
    if (!resolvedMcpServers && cwd) {
      resolvedMcpServers = loadMCPServersFromFile(cwd);
    } else if (!resolvedMcpServers) {
      resolvedMcpServers = loadGlobalMCPServers();
    }

    const ideMcpServerPath = join(__dirname, 'ide-mcp-server.js');
    const codeIntelMcpServerPath = join(__dirname, 'code-intel-mcp-server.js');
    const visualizerMcpServerPath = join(__dirname, 'visualizer-mcp-server.js');
    // Brain: quack-visualizer-inline-html
    options.mcpServers = {
      ...(resolvedMcpServers || {}),
      'ide-tools': { command: 'node', args: [ideMcpServerPath] },
      'code-intel': { type: 'stdio', command: 'node', args: [codeIntelMcpServerPath] },
      'visualizer': { command: 'node', args: [visualizerMcpServerPath] },
    };

    const mcpCount = options.mcpServers ? Object.keys(options.mcpServers).length : 0;
    log('MCP', `query=${queryId} resolved ${mcpCount} MCP servers: [${Object.keys(options.mcpServers || {}).join(', ')}]`);

    // Brain: fix-session-limit-prompt-cache
    // Dynamic context (ideContext, gitContext) is prepended to the user prompt as a
    // <system-reminder> block instead of being part of systemPrompt. This preserves
    // the prompt cache for the static system prompt (~50k+ tokens) across turns.
    // Without this, every time the user switches files or makes a commit, the entire
    // system prompt cache is invalidated, costing ~10x more rate limit budget.
    let contextPrefix = '';
    if (ideContext) {
      contextPrefix += `\n\n## IDE Context\n\n${ideContext}`;
    }
    if (debugMode) {
      const gitContext = loadGitContext(cwd);
      if (gitContext) {
        contextPrefix += gitContext;
      }
    }

    // Build the final prompt with context prefix
    const finalPrompt = contextPrefix
      ? `${prompt}\n\n<system-reminder>\n${contextPrefix}\n</system-reminder>`
      : prompt;

    // --- Build message generator ---
    async function* generateMessages() {
      const content = createMessageContent(finalPrompt, attachments);
      yield {
        type: 'user',
        message: { role: 'user', content },
      };
    }

    // --- Execute query ---
    const hasMcpServers = options.mcpServers && Object.keys(options.mcpServers).length > 0;
    const useStreamingInput = hasMcpServers || (attachments && attachments.length > 0);

    const queryStartTime = Date.now();
    log('QUERY', `query=${queryId} calling SDK query() (streamingInput=${useStreamingInput})`);

    // Brain: gotcha-stamina-overhead-static-estimate
    // Count prompt tokens in parallel (non-blocking) for precise overhead measurement.
    // Only for Anthropic provider (countTokens API not available on Ollama/custom).
    // Only for new sessions (resumed sessions already have cached overhead in frontend).
    const isAnthropicProvider = !provider || provider === 'anthropic';
    const isNewSession = !sessionId;
    let countTokensPromise = null;
    if (isAnthropicProvider && isNewSession) {
      const promptContent = createMessageContent(finalPrompt, attachments);
      countTokensPromise = countPromptTokens(modelId, promptContent);
    }

    const stream = query({
      prompt: useStreamingInput ? generateMessages() : finalPrompt,
      options,
    });

    let eventCount = 0;
    let promptTokensEmitted = false;
    for await (const event of stream) {
      eventCount++;

      // Emit prompt_token_count on first assistant event (so frontend has it before usage data)
      if (!promptTokensEmitted && countTokensPromise && event.type === 'assistant') {
        const promptTokens = await countTokensPromise;
        if (promptTokens !== null) {
          emit({ type: 'event', queryId, event: { type: 'prompt_token_count', promptTokens } });
        }
        promptTokensEmitted = true;
      }

      // Brain: fix-daemon-missing-1m-context-betas
      // Log contextWindow from result events to verify 1M activation
      if (event.type === 'result') {
        const mu = event.modelUsage || event.model_usage;
        if (mu) {
          for (const [modelName, usage] of Object.entries(mu)) {
            if (usage?.contextWindow) {
              log('QUERY', `contextWindow for ${modelName}: ${usage.contextWindow} (${usage.contextWindow >= 1_000_000 ? '1M' : '200k'})`);
            }
          }
        }
      }

      // Brain: fix-ask-user-question-stream-event-not-emitted
      // Log when SDK emits ask_user_question/plan_approval_request as stream events.
      // In bypassPermissions mode, canUseTool is NOT called for these — the SDK
      // auto-approves and only emits the stream event. The Rust event handler
      // must re-emit these as ask-user-question/plan-approval-request Tauri events.
      if (event.type === 'ask_user_question') {
        diag(`STREAM_EVENT ask_user_question: queryId=${queryId}, requestId=${event.requestId}, canUseTool was ${pendingRequests.size > 0 ? 'CALLED' : 'NOT called (bypass mode?)'}`);
      } else if (event.type === 'plan_approval_request') {
        diag(`STREAM_EVENT plan_approval_request: queryId=${queryId}, requestId=${event.requestId}`);
      }

      // Emit each SDK event tagged with queryId
      emit({ type: 'event', queryId, event });
    }

    // If no assistant event came (unusual), still emit prompt tokens
    if (!promptTokensEmitted && countTokensPromise) {
      const promptTokens = await countTokensPromise;
      if (promptTokens !== null) {
        emit({ type: 'event', queryId, event: { type: 'prompt_token_count', promptTokens } });
      }
    }

    const elapsedMs = Date.now() - queryStartTime;
    emit({ type: 'query_complete', queryId });
    log('QUERY', `query=${queryId} completed successfully (${eventCount} events, ${elapsedMs}ms)`);

  } catch (err) {
    if (abortController.signal.aborted) {
      log('ABORT', `query=${queryId} was aborted`);
      emit({ type: 'query_complete', queryId });
    } else {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : '';

      // Check for subagent crash (same logic as stream-claude.js)
      const isSubagentCrash = errorStack?.includes('ProcessTransport') ||
        errorStack?.includes('exitHandler') ||
        errorMsg.includes('process exited') ||
        errorMsg.includes('exit code') ||
        errorMsg.includes('Stream closed');

      if (isSubagentCrash) {
        log('QUERY', `query=${queryId} subagent crash: ${errorMsg}`);
        emit({
          type: 'event', queryId,
          event: {
            type: 'assistant',
            message: {
              content: [{
                type: 'text',
                text: `\n\n> **Error:** A subagent process crashed unexpectedly. This can happen due to rate limits, timeout, or temporary issues. Please try again.\n\n`,
              }],
            },
          },
        });
        emit({ type: 'query_complete', queryId });
      } else {
        log('QUERY', `query=${queryId} error: ${errorMsg}`);
        emit({ type: 'query_error', queryId, error: errorMsg, stack: errorStack });
      }
    }
  } finally {
    // 🦆 Restore original env vars after query (daemon is persistent)
    if (provider === 'ollama' || provider === 'custom') {
      if (savedBaseUrl !== undefined) process.env.ANTHROPIC_BASE_URL = savedBaseUrl;
      else delete process.env.ANTHROPIC_BASE_URL;
      if (savedApiKey !== undefined) process.env.ANTHROPIC_API_KEY = savedApiKey;
      else delete process.env.ANTHROPIC_API_KEY;
      if (savedAuthToken !== undefined) process.env.ANTHROPIC_AUTH_TOKEN = savedAuthToken;
      else delete process.env.ANTHROPIC_AUTH_TOKEN;
    }

    // Clean up pending requests for this query
    let cleanedRequests = 0;
    for (const [reqId, req] of pendingRequests.entries()) {
      if (req.queryId === queryId) {
        clearTimeout(req.timeout);
        pendingRequests.delete(reqId);
        cleanedRequests++;
      }
    }
    activeQueries.delete(queryId);
    log('QUERY', `query=${queryId} cleanup done (cleaned ${cleanedRequests} pending requests, remaining active=${activeQueries.size})`);
  }
}

// =============================================================================
// BIDIRECTIONAL COMMUNICATION — Frontend request/response
// =============================================================================

function generateRequestId() {
  return `req_${randomUUID()}`;
}

/**
 * Send a request to the frontend and wait for a response.
 * The Rust daemon reader routes the response back via stdin.
 */
async function requestFromFrontend(queryId, type, data, timeoutMs = 0) {
  const requestId = generateRequestId();

  return new Promise((resolve, reject) => {
    let timeout = null;
    if (timeoutMs > 0) {
      timeout = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error(`Request ${requestId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    pendingRequests.set(requestId, { resolve, reject, timeout, queryId });
    diag(`STORED pending: requestId=${requestId}, queryId=${queryId}, type=${type}, total=${pendingRequests.size}`);
    log('INTERACT', `[INFO] Stored pending request: requestId=${requestId}, queryId=${queryId}, type=${type}, total pending=${pendingRequests.size}`);

    // Emit the request tagged with queryId so Rust can route the event
    emit({ type, queryId, requestId, ...data });
    log('IPC', `[INFO] Sent ${type} requestId=${requestId} query=${queryId}`);
  });
}

// =============================================================================
// COMMAND HANDLERS
// =============================================================================

function handleAbort(cmd) {
  const { queryId } = cmd;
  const queryState = activeQueries.get(queryId);
  if (queryState) {
    // Reject pending requests for this query before aborting
    for (const [reqId, req] of pendingRequests.entries()) {
      if (req.queryId === queryId) {
        clearTimeout(req.timeout);
        req.reject(new Error('Query aborted'));
        pendingRequests.delete(reqId);
      }
    }
    queryState.abortController.abort();
    log('ABORT', `query=${queryId} aborted successfully`);
  } else {
    log('ABORT', `No active query found for abort: ${queryId}`);
  }
}

function handleResponse(cmd) {
  const { requestId, answers } = cmd;
  diag(`handleResponse: requestId=${requestId}, found=${pendingRequests.has(requestId)}, pendingKeys=[${Array.from(pendingRequests.keys()).join(',')}]`);
  if (pendingRequests.has(requestId)) {
    const { resolve, timeout } = pendingRequests.get(requestId);
    clearTimeout(timeout);
    pendingRequests.delete(requestId);
    resolve({ requestId, answers });
    diag(`✅ RESOLVED requestId=${requestId}`);
  } else {
    diag(`❌ NOT FOUND requestId=${requestId}, pendingKeys=[${Array.from(pendingRequests.keys()).join(',')}], activeQueries=[${Array.from(activeQueries.keys()).join(',')}]`);
  }
}

function handleMcpReload(cmd) {
  // MCP config will be picked up by the next query.
  // Active queries continue with their current MCP connections.
  log('MCP', `Reload requested — will apply to next query`);
}

async function handleShutdown() {
  log('LIFECYCLE', `Shutdown requested — closing ${activeQueries.size} active queries`);
  for (const [queryId, state] of activeQueries.entries()) {
    state.abortController.abort();
    log('LIFECYCLE', `Aborted query=${queryId} during shutdown`);
  }
  // Give queries a moment to clean up
  await new Promise(resolve => setTimeout(resolve, 1000));
  log('LIFECYCLE', 'Daemon shutting down');
  process.exit(0);
}

// =============================================================================
// MAIN EVENT LOOP
// =============================================================================

async function main() {
  log('LIFECYCLE', `Starting persistent daemon (pid=${process.pid}, node=${process.version})`);

  const stdinReader = createInterface({
    input: process.stdin,
    terminal: false,
  });

  // Signal readiness to Rust
  emit({ type: 'daemon_ready' });
  log('LIFECYCLE', 'Daemon ready — emitted daemon_ready, waiting for commands');

  stdinReader.on('line', async (line) => {
    try {
      const cmd = JSON.parse(line);
      if (cmd.type === 'response') {
        diag(`RESPONSE on stdin: requestId=${cmd.requestId}, pendingKeys=[${Array.from(pendingRequests.keys()).join(',')}]`);
      }
      log('IPC', `[INFO] Received stdin command type=${cmd.type}${cmd.queryId ? ` query=${cmd.queryId}` : ''}${cmd.requestId ? ` requestId=${cmd.requestId}` : ''}`);

      switch (cmd.type) {
        case 'query':
          // Run query in background (don't await — allows concurrent queries)
          handleQuery(cmd).catch(err => {
            log('QUERY', `Unhandled query error: ${err.message}`);
            emit({ type: 'query_error', queryId: cmd.queryId, error: err.message });
          });
          break;

        case 'abort':
          handleAbort(cmd);
          break;

        case 'response':
          handleResponse(cmd);
          break;

        case 'mcp_reload':
          handleMcpReload(cmd);
          break;

        case 'ping':
          emit({ type: 'pong' });
          break;

        case 'shutdown':
          await handleShutdown();
          break;

        default:
          log('IPC', `Unknown command type: ${cmd.type}`);
      }
    } catch (err) {
      log('IPC', `Error processing command: ${err.message}`);
    }
  });

  stdinReader.on('close', () => {
    log('LIFECYCLE', 'stdin closed — Rust process likely exited, shutting down');
    process.exit(0);
  });

  // Keep the event loop alive (stdin is already keeping it alive via readline,
  // but ensure it stays open even if readline somehow closes)
  process.stdin.resume();
}

main().catch(err => {
  log('LIFECYCLE', `Fatal daemon error: ${err.message}`);
  process.exit(1);
});
