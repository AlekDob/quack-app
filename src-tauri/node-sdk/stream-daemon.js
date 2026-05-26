#!/usr/bin/env node

// Brain: sdk-requires-node22-disposable
// Polyfill Symbol.dispose for Node.js < 22 (Explicit Resource Management)
Symbol.dispose ??= Symbol('Symbol.dispose');
Symbol.asyncDispose ??= Symbol('Symbol.asyncDispose');

/**
 * Node.js daemon for Claude Agent SDK.
 *
 * Stays alive to handle multiple queries via stdin/stdout IPC.
 * Each query uses the SDK's query() function which spawns and manages
 * its own CLI subprocess. Session continuity is handled via options.resume.
 *
 * Protocol:
 *   stdin  (Rust → Node): JSON line commands (query, abort, response, ping, shutdown)
 *   stdout (Node → Rust): JSON line events (daemon_ready, event, query_complete, pong)
 *   stderr: Debug logging only
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync, readdirSync, appendFileSync } from 'fs';
import { extname, join, dirname } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
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
 * Active queries: queryId → query state
 * Each query has its own AbortController for independent cancellation.
 */
const activeQueries = new Map();

/**
 * Global pending requests map (keyed by requestId).
 * AskUserQuestion and PlanApproval responses are routed here.
 */
const pendingRequests = new Map();

/**
 * AskUserQuestion answers staged by PreToolUse hook, consumed by PostToolUse hook.
 * Keyed by tool_use_id (the SDK guarantees the same id across PreToolUse → tool exec → PostToolUse).
 *
 * Why this exists: SDK v0.2.113+ spawns the native binary which strips off-schema fields
 * from canUseTool's `updatedInput.answers` (AskUserQuestionInput schema only declares `questions`).
 * Workaround: collect answers in PreToolUse, then replace the tool's empty output via PostToolUse
 * `updatedToolOutput` (added in SDK v0.2.121). Brain: fix-askuserquestion-native-cli-strips-answers.
 */
const pendingAskAnswers = new Map();

// =============================================================================
// MCP SERVER LOADING
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
// MODEL MAPPING
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

  // Brain: gotcha-oauth-betas-rejection + anthropic/claude-code#45449
  // Client-side gate in cli.js (isOneMContextBlocked) reads stale cache in
  // ~/.claude.json and blocks the implicit [1m] auto-upgrade for new Opus
  // models (e.g. opus-4-7). On Max subscriptions the server accepts [1m]
  // fine — only the slash-command path is broken. Forcing the suffix
  // explicitly bypasses the gate and restores 1M.
  const isOpus = /claude-opus-4-[6-9]/.test(resolved);
  if (isOpus && !has1MSuffix) {
    return `${resolved}[1m]`;
  }
  // Re-append [1m] suffix if present — SDK strips it before sending to API
  return has1MSuffix ? `${resolved}[1m]` : resolved;
}

// =============================================================================
// IMAGE ATTACHMENT SUPPORT
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
// TEAM PROMPT AUGMENTATION
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
    provider, providerBaseUrl, providerApiKey, debugMode, chatMode, askMode,
    toolSearchMode,
    // Brain: 037-anthropic-compatible-providers
    providerConfig,
  } = cmd;

  const abortController = new AbortController();
  const queryState = {
    abortController,
    status: 'active',
    queryHandle: null,
  };

  // Track plan approval state per query (Brain: fix-duplicate-plan-approval)
  let planAlreadyApproved = false;

  activeQueries.set(queryId, queryState);
  log('QUERY', `Starting query=${queryId} model=${model} cwd=${cwd || 'default'} resume=${sessionId || '(new)'} activeQueries=${activeQueries.size}`);
  diag(`QUERY_START: queryId=${queryId}, permissionMode=${permissionMode || '(none/act)'}, model=${model}, activeQueries=${activeQueries.size}`);

  // 🦆 LLM Provider: set env vars per-query for custom/ollama providers
  // Save originals so we can restore after the query (daemon is persistent)
  const savedBaseUrl = process.env.ANTHROPIC_BASE_URL;
  const savedApiKey = process.env.ANTHROPIC_API_KEY;
  const savedAuthToken = process.env.ANTHROPIC_AUTH_TOKEN;
  const savedSonnet = process.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
  const savedHaiku = process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL;
  const savedDefaultModel = process.env.ANTHROPIC_MODEL;
  // Brain: 037-anthropic-compatible-providers
  // OAuth Pro/Max credentials win over ANTHROPIC_AUTH_TOKEN/BASE_URL — we MUST
  // clear them for the duration of a custom-provider query, otherwise the
  // request silently routes to api.anthropic.com.
  const savedOauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;

  // Brain: 037-anthropic-compatible-providers
  // Anthropic-compatible provider (z.ai, MiniMax, Kimi, Qwen, DeepSeek, custom proxy).
  // providerConfig wins over the legacy provider/providerBaseUrl path.
  const usingProviderConfig = providerConfig && providerConfig.baseUrl && providerConfig.authToken;
  // Brain: gotcha-js-template-literal-secret-leak
  // `usingProviderConfig` is the result of `a && b && c` — in JS that returns the
  // last truthy operand, NOT a boolean. If we interpolate it directly the API key
  // (the third operand) is written to disk in plaintext. ALWAYS cast to boolean.
  diag(`PROVIDER_CONFIG: present=${!!providerConfig} baseUrl=${providerConfig?.baseUrl || '-'} sonnet=${providerConfig?.sonnetModel || '-'} usingProviderConfig=${!!usingProviderConfig}`);
  if (usingProviderConfig) {
    process.env.ANTHROPIC_BASE_URL = providerConfig.baseUrl;
    process.env.ANTHROPIC_AUTH_TOKEN = providerConfig.authToken;
    if (providerConfig.sonnetModel) process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = providerConfig.sonnetModel;
    if (providerConfig.haikuModel) process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = providerConfig.haikuModel;
    if (providerConfig.defaultModel) process.env.ANTHROPIC_MODEL = providerConfig.defaultModel;
    // Bearer wins: clear ANTHROPIC_API_KEY to avoid x-api-key being sent instead.
    delete process.env.ANTHROPIC_API_KEY;
    // OAuth (Claude Pro/Max subscription) takes precedence over env-based auth.
    // Clearing the OAuth token for this query forces the SDK to use AUTH_TOKEN/BASE_URL.
    delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
    log('QUERY', `🔌 Provider config: ${providerConfig.baseUrl} (sonnet=${providerConfig.sonnetModel || '-'} haiku=${providerConfig.haikuModel || '-'})`);
    diag(`PROVIDER_CONFIG_APPLIED: baseUrl=${providerConfig.baseUrl} sonnetModel=${providerConfig.sonnetModel} haikuModel=${providerConfig.haikuModel} oauthCleared=${savedOauthToken !== undefined}`);
  } else if (provider === 'ollama') {
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
    // --- Build SDK options ---
    const modelId = getModelId(model);
    const is1MContext = modelId.endsWith('[1m]');
    log('QUERY', `Model mapping: "${model}" → "${modelId}" (1M context: ${is1MContext})`);

    // SDK v0.2.133+: 'Skill' in allowedTools deprecated → use `skills: 'all'` below.
    // SDK v0.3.142: headless/SDK sessions switched TodoWrite → Task tools
    // (TaskCreate/TaskUpdate/TaskGet/TaskList). 'TodoWrite' kept in the allow-list
    // for backward compat with older sessions; the FE accumulator
    // (`src/utils/taskAccumulator.ts`) folds both schemas into a single TodoWidget render.
    const defaultAllowedTools = [
      'Task', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
      'WebFetch', 'WebSearch', 'TodoWrite', 'NotebookEdit', 'SlashCommand',
      'BashOutput', 'KillShell', 'ExitPlanMode', 'AskUserQuestion',
      'TaskCreate', 'TaskGet', 'TaskUpdate', 'TaskList',
    ];
    // 🛡️ Ask mode: only auto-approve read-only tools + AskUserQuestion.
    // Write/Edit/Bash/etc. must fall through to canUseTool for user approval.
    // Brain: pattern-permission-modes (Ask mode — SDK allowedTools gate)
    const askModeAllowedTools = [
      'Read', 'Glob', 'Grep', 'AskUserQuestion', 'ExitPlanMode', 'TodoWrite',
      'TaskGet', 'TaskList',
    ];
    const baseAllowedTools = allowedTools && Array.isArray(allowedTools) && allowedTools.length > 0
      ? allowedTools : defaultAllowedTools;
    const resolvedAllowedTools = askMode ? askModeAllowedTools : baseAllowedTools;

    log('QUERY', 'CLI: bundled cli.js');

    const options = {
      model: modelId,
      // Brain: 1m-context-window-support
      // The [1m] suffix in modelId is enough — the bundled cli.js correctly
      // resolves Opus 4.7 to 1M context. (The earlier 200k workaround that
      // routed via ~/.local/bin/claude was removed; that native-binary path
      // also stripped off-schema fields like AskUserQuestion's `answers`,
      // breaking question answering. Brain: gotcha-sdk-bundled-cli-200k-context-window — RESOLVED.)
      settingSources: ['project', 'user', 'local'],
      tools: { type: 'preset', preset: 'claude_code' },
      allowedTools: resolvedAllowedTools,
      // SDK v0.2.120+: replaces deprecated 'Skill' in allowedTools (deprecated v0.2.133).
      skills: 'all',
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
        + (permissionMode === 'plan' ? `

## PLAN MODE — PROJECT-OPS WORKSTREAM PROTOCOL

You are in **PLAN MODE**. Before producing any implementation plan, you MUST use the \`project-ops\` skill to scaffold or update a workstream document.

### Workflow:
1. **Check existing workstreams** — read \`documentation/workstreams/INDEX.md\` (auto-generated). Identify if the current request maps to an existing workstream or needs a new one.
2. **Scaffold/update** — for a new workstream, copy \`~/.claude/skills/project-ops/templates/workstream.md.template\` into \`documentation/workstreams/NN-<slug>.md\` and fill the YAML frontmatter (\`ws\`, \`title\`, \`status\`, \`focus: current\`, \`opened\`). For an existing one, update \`status\` and \`updated\` fields.
3. **Plan body** — write the plan inside the workstream body (sections: Goal, Constraints, Steps, Risks, Done-when). The workstream IS the spec.
4. **Surface for approval** — present the workstream content to the user before any Edit/Write to source code.

The PostToolUse hook automatically regenerates \`INDEX.md\` after each Edit/Write to a workstream file.

**The \`project-ops\` skill is the default spec system in Plan Mode** — do not produce ad-hoc planning docs outside \`documentation/workstreams/\`.` : '')
        + (teamContext ? buildTeamPromptAugmentation(teamContext) : ''),
        // Brain: fix-session-limit-prompt-cache
        // ideContext is NO LONGER appended here — it changes every turn (file open, git status)
        // which would invalidate the entire system prompt cache (~50k+ tokens).
        // Instead, ideContext is prepended to the user prompt. See contextPrefix below.
      },
      canUseTool: async (toolName, input, toolOptions) => {
        // AskUserQuestion: PreToolUse hook already collected answers and staged them
        // in `pendingAskAnswers`. canUseTool is still invoked because AskUserQuestion has
        // requiresUserInteraction=true (overrides the PreToolUse `allow` decision in
        // SDK v0.2.138). Do NOT re-prompt the frontend — just allow. PostToolUse hook
        // will replace the empty tool output via `updatedToolOutput`.
        // Brain: fix-askuserquestion-native-cli-strips-answers
        if (toolName === 'AskUserQuestion') {
          diag(`canUseTool AskUserQuestion bypassed (PreToolUse hook handled it) for query=${queryId}`);
          return { behavior: 'allow', updatedInput: input };
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

        // 🛡️ Ask mode: prompt user before allowing tool execution
        // Brain: pattern-permission-modes (Ask = default + no skill injection)
        if (askMode) {
          diag(`canUseTool ASK MODE: tool=${toolName} for query=${queryId}`);
          try {
            const response = await requestFromFrontend(queryId, 'tool_permission_request', {
              toolName,
              input,
            });
            const answers = response.answers || response;
            const isApproved = answers.approved === 'true' || answers.approved === true;
            if (isApproved) {
              log('INTERACT', `[INFO] Tool ${toolName} APPROVED by user for query=${queryId}`);
              return { behavior: 'allow', updatedInput: input };
            } else {
              log('INTERACT', `[INFO] Tool ${toolName} DENIED by user for query=${queryId}`);
              return { behavior: 'deny', message: answers.feedback || `User denied ${toolName}` };
            }
          } catch (error) {
            log('INTERACT', `[WARN] Tool permission request FAILED for query=${queryId}: ${error.message}`);
            return { behavior: 'deny', message: `Failed to get tool permission: ${error.message}` };
          }
        }

        // Default: allow (Build mode, Chat mode uses prompt-level enforcement)
        return { behavior: 'allow', updatedInput: input };
      },
      // ─────────────────────────────────────────────────────────────────────────
      // AskUserQuestion answer-routing hooks (SDK v0.2.113+ workaround)
      //
      // The native binary spawned since v0.2.113 zod-validates `updatedInput` from
      // canUseTool against the tool's input schema. AskUserQuestionInput declares
      // only `questions`, so the `answers` field we add gets stripped → the model
      // sees an empty answer and replies "I didn't receive any answers".
      //
      // Workaround: collect answers in PreToolUse (auto-allows so canUseTool is
      // skipped), stage them in `pendingAskAnswers` keyed by tool_use_id, then
      // replace the empty tool output via PostToolUse `updatedToolOutput`.
      // Brain: fix-askuserquestion-native-cli-strips-answers (regression on 0.2.138)
      // ─────────────────────────────────────────────────────────────────────────
      hooks: {
        PreToolUse: [{
          matcher: 'AskUserQuestion',
          // SDK default hook timeout is 60s. AskUserQuestion can sit pending for many
          // minutes (user reads carefully, switches context, etc.); if the hook times
          // out the SDK proceeds without staged answers and the model sees an empty
          // result. Bumped to 24h to effectively wait forever for the user.
          // Brain: fix-askuserquestion-sdk-0.2.138-pretool-posttool-hook
          timeout: 86400,
          hooks: [async (input, toolUseId, _hookCtx) => {
            diag(`PreToolUse AskUserQuestion fired for query=${queryId} toolUseId=${toolUseId}`);
            try {
              const response = await requestFromFrontend(queryId, 'ask_user_question', {
                questions: input.tool_input.questions,
              });
              pendingAskAnswers.set(toolUseId, response.answers);
              diag(`PreToolUse staged answers for toolUseId=${toolUseId}: ${JSON.stringify(response.answers).slice(0, 200)}`);
              // Auto-allow so the SDK skips canUseTool. The tool will execute with
              // the original input (no `answers`) — PostToolUse fixes the output.
              return {
                hookSpecificOutput: {
                  hookEventName: 'PreToolUse',
                  permissionDecision: 'allow',
                  permissionDecisionReason: 'AskUserQuestion answers collected via PreToolUse hook',
                },
              };
            } catch (error) {
              diag(`PreToolUse AskUserQuestion FAILED for toolUseId=${toolUseId}: ${error.message}`);
              return {
                hookSpecificOutput: {
                  hookEventName: 'PreToolUse',
                  permissionDecision: 'deny',
                  permissionDecisionReason: `Failed to collect answers: ${error.message}`,
                },
              };
            }
          }],
        }],
        PostToolUse: [{
          matcher: 'AskUserQuestion',
          hooks: [async (input, toolUseId, _hookCtx) => {
            const answers = pendingAskAnswers.get(toolUseId);
            if (!answers) {
              diag(`PostToolUse AskUserQuestion: no staged answers for toolUseId=${toolUseId} (skipping)`);
              return {};
            }
            pendingAskAnswers.delete(toolUseId);
            // Render answers as plain markdown the model can parse without ambiguity.
            // `additionalContext` is APPENDED to the tool's (empty) output, not replaced —
            // safer than `updatedToolOutput` which is subject to output-schema validation.
            const lines = ['User answered the following questions:'];
            for (const [header, value] of Object.entries(answers)) {
              const display = Array.isArray(value) ? value.join(', ') : String(value);
              lines.push(`- ${header}: ${display}`);
            }
            const additionalContext = lines.join('\n');
            diag(`PostToolUse AskUserQuestion appending context for toolUseId=${toolUseId}: ${JSON.stringify(answers).slice(0, 200)}`);
            return {
              hookSpecificOutput: {
                hookEventName: 'PostToolUse',
                additionalContext,
              },
            };
          }],
        }],
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

    // Brain: fix-daemon-missing-1m-context-betas + fix-oauth-betas-rejection
    // Enable 1M context window for supported models. Only set for API key users —
    // OAuth subscriptions (Claude Max/Team/Enterprise) get 1M automatically and
    // REJECT custom betas with "Warning: Custom betas are only available for API
    // key users. Ignoring provided betas." — that rejection also disables the
    // server-side Max 1M auto-flag, forcing a fallback to 200k.
    const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
    if (hasApiKey) {
      options.betas = ['context-1m-2025-08-07'];
    }

    if (cwd) options.cwd = cwd;
    if (sessionId) options.resume = sessionId;
    if (effort) {
      // Brain: task-effort-model-aware-refactor
      // xhigh is Opus 4.7 exclusive — silently degrade on older models so we don't
      // send invalid effort levels to the API (previously passed through untouched,
      // making the "falls back to high" comment in types.ts a lie).
      const isOpus47 = typeof model === 'string' && model.includes('opus-4-7');
      if (effort === 'xhigh' && !isOpus47) {
        console.warn(`[daemon] effort=xhigh not supported on ${model}, degrading to 'high'`);
        options.effort = 'high';
      } else {
        options.effort = effort;
      }
    }

    if (agents && Array.isArray(agents) && agents.length > 0) {
      options.agents = agents.map(agent => ({
        name: agent.name, description: agent.description,
        model: agent.model, path: agent.filePath,
      }));
    }

    if (outputFormat) options.outputFormat = outputFormat;

    // Environment (tool search + task list)
    // Map user-facing preset to the ENABLE_TOOL_SEARCH env-var format.
    // off → disable, auto → 10% threshold (default), aggressive → ~1% threshold, always → force defer.
    const TOOL_SEARCH_ENV = { off: 'false', auto: 'auto', aggressive: 'auto:1', always: 'true' };
    const toolSearchEnv = TOOL_SEARCH_ENV[toolSearchMode] ?? 'auto';
    options.env = { ...process.env, ENABLE_TOOL_SEARCH: toolSearchEnv };
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

    // Brain: fix-compact-not-triggering-sdk-native
    // Detect SDK slash commands early — they need to be sent as-is without any
    // context prefix, otherwise the SDK's parser won't recognize them.
    const isSdkSlashCommand = /^\s*\/(compact|context)\b/.test(prompt);

    // Build the final prompt with context prefix
    // SDK slash commands must be sent as-is — appending system-reminder context
    // would prevent the SDK's slash command parser from recognizing them.
    const finalPrompt = isSdkSlashCommand
      ? prompt
      : (contextPrefix ? `${prompt}\n\n<system-reminder>\n${contextPrefix}\n</system-reminder>` : prompt);

    // --- Build message generator ---
    async function* generateMessages() {
      const content = createMessageContent(finalPrompt, attachments);
      yield {
        type: 'user',
        message: { role: 'user', content },
      };
    }

    // --- Execute query (persistent subprocess or fallback to query()) ---
    const queryStartTime = Date.now();

    // Brain: gotcha-stamina-overhead-static-estimate
    const isAnthropicProvider = !provider || provider === 'anthropic';
    const isNewSession = !sessionId;
    let countTokensPromise = null;
    if (isAnthropicProvider && isNewSession) {
      const promptContent = createMessageContent(finalPrompt, attachments);
      countTokensPromise = countPromptTokens(modelId, promptContent);
    }

    // Brain: fix-compact-not-triggering-sdk-native
    // SDK slash commands must be sent as a string prompt (not AsyncIterable) so the
    // SDK's slash command parser recognizes them. AsyncIterable prompts go through
    // streamInput which bypasses slash command parsing.
    const queryPrompt = isSdkSlashCommand ? finalPrompt : generateMessages();
    log('QUERY', `query=${queryId} calling SDK query() (${isSdkSlashCommand ? 'SDK slash command string prompt' : 'streamingInput=true'}) resume=${sessionId || 'none'}`);
    queryState.queryHandle = query({
      prompt: queryPrompt,
      options,
    });
    const eventSource = queryState.queryHandle;

    let eventCount = 0;
    let promptTokensEmitted = false;
    for await (const event of eventSource) {
      eventCount++;
      if (eventCount <= 5) diag(`EVENT[${eventCount}]: type=${event.type}, subtype=${event.subtype || '-'}`);

      const latestQueryState = activeQueries.get(queryId);
      if (latestQueryState && latestQueryState.status !== 'active') {
        log('ABORT', `Suppressing post-stop event for query=${queryId}: type=${event.type}`);
        continue;
      }

      // Emit prompt_token_count on first assistant event (so frontend has it before usage data)
      if (!promptTokensEmitted && countTokensPromise && event.type === 'assistant') {
        const promptTokens = await countTokensPromise;
        const currentState = activeQueries.get(queryId);
        if (promptTokens !== null && (!currentState || currentState.status === 'active')) {
          emit({ type: 'event', queryId, event: { type: 'prompt_token_count', promptTokens } });
        }
        promptTokensEmitted = true;
      }

      // Log cache and context stats from result events
      if (event.type === 'result') {
        diag(`RESULT_EVENT: keys=${Object.keys(event).join(',')}, usage=${!!event.usage}, subtype=${event.subtype}`);
        const u = event.usage;
        if (u) {
          const cRead = u.cache_read_input_tokens || 0;
          const cCreate = u.cache_creation_input_tokens || 0;
          const total = cRead + cCreate + (u.input_tokens || 0);
          const hitPct = total > 0 ? ((cRead / total) * 100).toFixed(1) : '0.0';
          log('CACHE', `query=${queryId} cacheRead=${cRead} cacheCreation=${cCreate} input=${u.input_tokens || 0} hit=${hitPct}%`);
          diag(`CACHE: cacheRead=${cRead} cacheCreation=${cCreate} effective=${total}`);
        }
        const mu = event.modelUsage || event.model_usage;
        if (mu) {
          for (const [modelName, usage] of Object.entries(mu)) {
            if (usage?.contextWindow) {
              log('QUERY', `contextWindow for ${modelName}: ${usage.contextWindow} (${usage.contextWindow >= 1_000_000 ? '1M' : '200k'})`);
            }
          }
        }

        // Brain: sdk-get-context-usage-breakdown
        // Must await getContextUsage() before the for-await loop ends, because
        // the result event is the last event — after iteration the query handle
        // closes and control requests fail with "Query closed before response".
        const ctxSource = queryState.queryHandle;
        if (ctxSource && typeof ctxSource.getContextUsage === 'function') {
          try {
            // Timeout getContextUsage() to prevent hanging the entire query completion.
            // If the SDK subprocess is in a bad state, this call can hang indefinitely,
            // blocking query_complete emission and leaving the frontend stuck with loading dots.
            let timeoutId;
            const rawResult = await Promise.race([
              ctxSource.getContextUsage(),
              new Promise((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error('getContextUsage timeout (5s)')), 5000);
              }),
            ]).finally(() => clearTimeout(timeoutId));
            const ctxUsage = rawResult?.response || rawResult;
            if (ctxUsage && (ctxUsage.totalTokens > 0 || ctxUsage.categories?.length > 0)) {
              log('CONTEXT', `query=${queryId} contextUsage: total=${ctxUsage.totalTokens}/${ctxUsage.maxTokens} (${ctxUsage.percentage?.toFixed(1) || 0}%) categories=${ctxUsage.categories?.length || 0}`);
              emit({
                type: 'event', queryId,
                event: {
                  type: 'context_usage_breakdown',
                  totalTokens: ctxUsage.totalTokens,
                  maxTokens: ctxUsage.maxTokens,
                  percentage: ctxUsage.percentage,
                  model: ctxUsage.model,
                  autoCompactThreshold: ctxUsage.autoCompactThreshold,
                  isAutoCompactEnabled: ctxUsage.isAutoCompactEnabled,
                  categories: ctxUsage.categories,
                },
              });
            }
          } catch (err) {
            log('CONTEXT', `query=${queryId} getContextUsage failed: ${err.message}`);
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
      const currentState = activeQueries.get(queryId);
      if (promptTokens !== null && (!currentState || currentState.status === 'active')) {
        emit({ type: 'event', queryId, event: { type: 'prompt_token_count', promptTokens } });
      }
    }

    const elapsedMs = Date.now() - queryStartTime;
    emit({ type: 'query_complete', queryId });
    if (queryState.status === 'active') {
      log('QUERY', `query=${queryId} completed successfully (${eventCount} events, ${elapsedMs}ms)`);
    } else {
      log('ABORT', `query=${queryId} drained after stop (${eventCount} events observed, ${elapsedMs}ms)`);
    }

  } catch (err) {
    if (abortController.signal.aborted) {
      log('ABORT', `query=${queryId} was aborted`);
      emit({ type: 'query_complete', queryId });
    } else {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : '';

      // Check for subagent crash
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
    // Brain: 037-anthropic-compatible-providers
    if (usingProviderConfig || provider === 'ollama' || provider === 'custom') {
      if (savedBaseUrl !== undefined) process.env.ANTHROPIC_BASE_URL = savedBaseUrl;
      else delete process.env.ANTHROPIC_BASE_URL;
      if (savedApiKey !== undefined) process.env.ANTHROPIC_API_KEY = savedApiKey;
      else delete process.env.ANTHROPIC_API_KEY;
      if (savedAuthToken !== undefined) process.env.ANTHROPIC_AUTH_TOKEN = savedAuthToken;
      else delete process.env.ANTHROPIC_AUTH_TOKEN;
      if (savedSonnet !== undefined) process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = savedSonnet;
      else delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
      if (savedHaiku !== undefined) process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = savedHaiku;
      else delete process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL;
      if (savedDefaultModel !== undefined) process.env.ANTHROPIC_MODEL = savedDefaultModel;
      else delete process.env.ANTHROPIC_MODEL;
      if (savedOauthToken !== undefined) process.env.CLAUDE_CODE_OAUTH_TOKEN = savedOauthToken;
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

async function handleAbort(cmd) {
  const { queryId } = cmd;
  const queryState = activeQueries.get(queryId);
  if (!queryState) {
    log('ABORT', `No active query found for abort: ${queryId}`);
    return;
  }

  if (queryState.status !== 'active') {
    log('ABORT', `query=${queryId} already ${queryState.status}`);
    return;
  }

  queryState.status = 'aborting';

  // Reject pending requests for this query before interrupting
  for (const [reqId, req] of pendingRequests.entries()) {
    if (req.queryId === queryId) {
      clearTimeout(req.timeout);
      req.reject(new Error('Query aborted'));
      pendingRequests.delete(reqId);
    }
  }

  const interruptTimeoutMs = 3000;
  const withTimeout = (promise, timeoutMs) => Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Interrupt timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);

  const finalizeAbort = () => {
    queryState.abortController.abort();
    queryState.status = 'aborted';
  };

  if (queryState.queryHandle && typeof queryState.queryHandle.interrupt === 'function') {
    try {
      await withTimeout(queryState.queryHandle.interrupt(), interruptTimeoutMs);
      finalizeAbort();
      log('ABORT', `query=${queryId} interrupted successfully via SDK query handle`);
    } catch (err) {
      log('ABORT', `query=${queryId} query-handle interrupt failed (${err.message}) — aborting controller`);
      finalizeAbort();
    }
    return;
  }

  finalizeAbort();
  log('ABORT', `query=${queryId} aborted via controller fallback`);
}

function handleResponse(cmd) {
  const { requestId, answers } = cmd;
  // [ASKQ-DIAG] Raw payload that landed via stdin from Rust. Confirms what crossed the Tauri channel.
  log('INTERACT', `[ASKQ-DIAG] 2/3 daemon stdin received requestId=${requestId} answers=${JSON.stringify(answers)}`);
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
  await new Promise(resolve => setTimeout(resolve, 1000));
  log('LIFECYCLE', 'Daemon shutting down');
  process.exit(0);
}

// =============================================================================
// MAIN EVENT LOOP
// =============================================================================

async function main() {
  log('LIFECYCLE', `Starting daemon (pid=${process.pid}, node=${process.version})`);

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
          await handleAbort(cmd);
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
    handleShutdown();
  });

  // Clean up child processes on signals (prevents orphaned MCP servers)
  process.on('SIGTERM', () => {
    log('LIFECYCLE', 'SIGTERM received — shutting down');
    handleShutdown();
  });
  process.on('SIGINT', () => {
    log('LIFECYCLE', 'SIGINT received — shutting down');
    handleShutdown();
  });

  // Keep the event loop alive (stdin is already keeping it alive via readline,
  // but ensure it stays open even if readline somehow closes)
  process.stdin.resume();
}

main().catch(err => {
  log('LIFECYCLE', `Fatal daemon error: ${err.message}`);
  process.exit(1);
});
