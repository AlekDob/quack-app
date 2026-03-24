#!/usr/bin/env node

// Brain: sdk-requires-node22-disposable
// Polyfill Symbol.dispose for Node.js < 22 (Explicit Resource Management)
// Claude Agent SDK v0.2.47+ uses Symbol.dispose internally. Without this
// polyfill, Node 18-21 crash with "TypeError: Object not disposable".
Symbol.dispose ??= Symbol('Symbol.dispose');
Symbol.asyncDispose ??= Symbol('Symbol.asyncDispose');

/**
 * Node.js script that uses Claude Agent SDK for real-time streaming
 * Called by Rust backend via subprocess
 *
 * Events are emitted via stdout as JSON lines
 * Responses (e.g., AskUserQuestion answers) are received via stdin as JSON lines
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { extname, join, dirname } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

// Get the directory of this script for MCP server paths
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
// BIDIRECTIONAL COMMUNICATION SYSTEM
// =============================================================================

/**
 * Pending requests waiting for responses from frontend
 * Key: requestId, Value: { resolve, reject, timeout }
 */
const pendingRequests = new Map();

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Set up stdin listener for receiving responses from frontend
 * Messages are JSON lines with format: { requestId: string, ...data }
 */
const stdinReader = createInterface({
  input: process.stdin,
  terminal: false,
});

stdinReader.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    console.error(`[STDIN] Received message:`, JSON.stringify(message, null, 2));

    if (message.requestId && pendingRequests.has(message.requestId)) {
      const { resolve, timeout } = pendingRequests.get(message.requestId);
      clearTimeout(timeout);
      pendingRequests.delete(message.requestId);
      resolve(message);
    } else {
      console.error(`[STDIN] Unknown requestId or no pending request:`, message.requestId);
    }
  } catch (error) {
    console.error(`[STDIN] Failed to parse message:`, error.message, line);
  }
});

stdinReader.on('close', () => {
  console.error(`[STDIN] Stream closed`);
});

/**
 * Send a request to frontend and wait for response
 * @param {string} type - Request type (e.g., 'ask_user_question')
 * @param {object} data - Request data
 * @param {number} timeoutMs - Timeout in milliseconds (0 = no timeout)
 * @returns {Promise<object>} Response from frontend
 */
async function requestFromFrontend(type, data, timeoutMs = 0) {
  const requestId = generateRequestId();

  return new Promise((resolve, reject) => {
    let timeout = null;

    if (timeoutMs > 0) {
      timeout = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error(`Request ${requestId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    pendingRequests.set(requestId, { resolve, reject, timeout });

    // Emit request to frontend via stdout
    const request = {
      type,
      requestId,
      ...data,
    };

    console.log(JSON.stringify(request));
    console.error(`[STDIN] Sent request ${requestId} of type ${type}`);
  });
}

/**
 * Map friendly model names to official API model IDs.
 * Hardcoded fallback - used only when frontend doesn't resolve the model ID.
 * The frontend resolves models dynamically via Supabase (modelService.ts).
 * This fallback ensures backward compatibility.
 */
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

// Parse command line arguments
const args = process.argv.slice(2);
const config = JSON.parse(args[0] || '{}');

const {
  prompt,
  model = 'opus',
  permissionMode, // No default - let SDK use its default (auto-approve) when undefined
  thinkingMode,
  cwd,
  sessionId,
  agents,
  attachments, // Array of file paths for images/attachments
  outputFormat, // Structured outputs configuration (beta)
  effort, // Effort parameter: 'low' | 'medium' | 'high' (SDK 0.1.54+)
  mcpServers, // MCP servers configuration (passed from Rust backend or loaded from .mcp.json)
  allowedTools, // Tools allowed for this session (passed from frontend via Rust backend)
  teamContext, // Agent Teams context (team name + members for prompt augmentation)
  ideContext, // IDE context (open file, selection, diagnostics, git status)
  debugMode, // Debug mode flag - appends systematic debugging instructions to system prompt
} = config;

// DEBUG: Log what we received from Rust
console.error(`[DEBUG] Raw config received:`, JSON.stringify(config, null, 2).substring(0, 500));
console.error(`[DEBUG] allowedTools from config:`, allowedTools);
console.error(`[DEBUG] debugMode from config:`, debugMode ?? 'not set');

/**
 * Load global MCP servers from ~/.quack/mcp/.mcp.json
 * These are Quack's built-in servers available in ALL projects
 * Returns: { [serverName]: { command, args, env } } or {}
 */
function loadGlobalMCPServers() {
  const globalMcpPath = join(homedir(), '.quack', 'mcp', '.mcp.json');

  console.error(`[MCP] Looking for global MCP servers at: ${globalMcpPath}`);

  if (!existsSync(globalMcpPath)) {
    console.error(`[MCP] No global .mcp.json found`);
    return {};
  }

  try {
    const globalConfig = JSON.parse(readFileSync(globalMcpPath, 'utf8'));

    if (!globalConfig.mcpServers || typeof globalConfig.mcpServers !== 'object') {
      return {};
    }

    const servers = {};

    for (const [name, config] of Object.entries(globalConfig.mcpServers)) {
      if (config.type === 'sse' || config.type === 'http') {
        servers[name] = {
          type: config.type,
          url: config.url,
          headers: config.headers,
        };
        console.error(`  - ${name} (${config.type}, global): ${config.url}`);
      } else {
        servers[name] = {
          command: config.command,
          args: config.args || [],
          env: config.env,
        };
        console.error(`  - ${name} (stdio, global): ${config.command} ${(config.args || []).join(' ')}`);
      }
    }

    console.error(`[MCP] Loaded ${Object.keys(servers).length} global MCP servers`);
    return servers;
  } catch (error) {
    console.error(`[MCP] Error reading global .mcp.json: ${error.message}`);
    return {};
  }
}

/**
 * Load MCP servers from .mcp.json file in the working directory
 * Also loads global servers from ~/.quack/mcp/.mcp.json
 * Project-local servers override global servers with same name
 * Returns: { [serverName]: { command, args, env } } or undefined
 */
function loadMCPServersFromFile(workingDir) {
  // First load global servers (available in all projects)
  const globalServers = loadGlobalMCPServers();

  const mcpJsonPath = join(workingDir || process.cwd(), '.mcp.json');

  console.error(`[MCP] Looking for project .mcp.json at: ${mcpJsonPath}`);

  if (!existsSync(mcpJsonPath)) {
    console.error(`[MCP] Project .mcp.json not found at ${mcpJsonPath}`);
    // Return global servers if any
    return Object.keys(globalServers).length > 0 ? globalServers : undefined;
  }

  try {
    const mcpConfig = JSON.parse(readFileSync(mcpJsonPath, 'utf8'));

    if (!mcpConfig.mcpServers || typeof mcpConfig.mcpServers !== 'object') {
      console.error(`[MCP] Project .mcp.json found but no mcpServers configured`);
      return Object.keys(globalServers).length > 0 ? globalServers : undefined;
    }

    // Start with global servers
    const servers = { ...globalServers };
    const serverNames = Object.keys(mcpConfig.mcpServers);

    console.error(`[MCP] Found ${serverNames.length} MCP servers in project .mcp.json:`);

    for (const [name, config] of Object.entries(mcpConfig.mcpServers)) {
      // Handle different transport types
      if (config.type === 'sse' || config.type === 'http') {
        // SSE/HTTP transport
        servers[name] = {
          type: config.type,
          url: config.url,
          headers: config.headers,
        };
        console.error(`  - ${name} (${config.type}): ${config.url}`);
      } else {
        // stdio transport (default)
        servers[name] = {
          command: config.command,
          args: config.args || [],
          env: config.env,
        };
        console.error(`  - ${name} (stdio): ${config.command} ${(config.args || []).join(' ')}`);
      }
    }

    return Object.keys(servers).length > 0 ? servers : undefined;
  } catch (error) {
    console.error(`[MCP] Error reading project .mcp.json: ${error.message}`);
    return Object.keys(globalServers).length > 0 ? globalServers : undefined;
  }
}

// Emit event via stdout
function emitEvent(event) {
  console.log(JSON.stringify(event));
}

// Brain: gotcha-stamina-overhead-static-estimate
// Count tokens for prompt using the Anthropic countTokens API (FREE, precise)
async function countPromptTokens(modelId, promptContent) {
  try {
    const client = new Anthropic();
    const result = await client.messages.countTokens({
      model: modelId,
      messages: [{ role: 'user', content: promptContent }],
    });
    console.error(`[TOKENS] countTokens result: ${result.input_tokens} tokens for prompt`);
    return result.input_tokens;
  } catch (err) {
    console.error(`[TOKENS] countTokens failed (non-blocking): ${err.message}`);
    return null;
  }
}

// Emit error via stderr
function emitError(error) {
  console.error(JSON.stringify({
    type: 'error',
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }));
}

// Convert file path to base64 image content block
function fileToImageBlock(filePath) {
  try {
    const ext = extname(filePath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    const mediaType = mimeTypes[ext];
    if (!mediaType) {
      console.error(`[WARNING] Unsupported image type: ${ext} for file ${filePath}`);
      return null;
    }

    const data = readFileSync(filePath, 'base64');
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data,
      },
    };
  } catch (error) {
    console.error(`[ERROR] Failed to read image file ${filePath}:`, error.message);
    return null;
  }
}

// Create message content with text and optional images
function createMessageContent(text, imagePaths = []) {
  const content = [{ type: 'text', text }];

  if (imagePaths && imagePaths.length > 0) {
    for (const path of imagePaths) {
      const imageBlock = fileToImageBlock(path);
      if (imageBlock) {
        content.push(imageBlock);
      }
    }
  }

  return content;
}

// Streaming input generator for messages
// IMPORTANT: SDK MCP servers REQUIRE streaming input mode (async generator)
// See: https://platform.claude.com/docs/en/agent-sdk/custom-tools
async function* generateMessages() {
  // Build message content with text and optional images
  const content = createMessageContent(prompt, attachments);

  yield {
    type: 'user',
    message: {
      role: 'user',
      content,
    },
  };
}

/**
 * Verify authentication is available before initializing SDK
 * Returns: { hasAuth: boolean, authMethod: string, error?: string }
 */
function checkAuthentication() {
  // Priority 0: Custom provider (Ollama, OpenAI-compatible) — ANTHROPIC_BASE_URL set by Rust
  if (process.env.ANTHROPIC_BASE_URL) {
    console.error(`[Auth] Custom provider at: ${process.env.ANTHROPIC_BASE_URL}`);
    return { hasAuth: true, authMethod: 'Custom Provider' };
  }

  // Priority 1: Check for ANTHROPIC_API_KEY
  if (process.env.ANTHROPIC_API_KEY) {
    const keyPreview = process.env.ANTHROPIC_API_KEY.substring(0, 8) + '...';
    console.error(`[Auth] ANTHROPIC_API_KEY found: ${keyPreview}`);
    return { hasAuth: true, authMethod: 'ANTHROPIC_API_KEY' };
  }

  // Priority 2: Check for Claude Code credentials in multiple locations
  // Claude Code can store credentials in several places
  const credentialPaths = [
    join(homedir(), '.claude.json'),                          // New OAuth format
    join(homedir(), '.claude', '.credentials.json'),          // Standard format
    join(homedir(), '.config', 'claude-code', 'auth.json'),  // Alternative location
  ];

  for (const credsPath of credentialPaths) {
    try {
      if (!existsSync(credsPath)) continue;

      const creds = JSON.parse(readFileSync(credsPath, 'utf8'));

      // Check for OAuth account (new format)
      if (creds.oauthAccount && typeof creds.oauthAccount === 'object') {
        console.error(`[Auth] Claude Code OAuth found at ${credsPath}`);
        return { hasAuth: true, authMethod: 'Claude Code OAuth' };
      }

      // Check for standard credentials
      if (creds.session_key || creds.access_token || creds.api_key) {
        console.error(`[Auth] Claude Code credentials found at ${credsPath}`);
        return { hasAuth: true, authMethod: 'Claude Code credentials' };
      }
    } catch (err) {
      console.error(`[Auth] Could not check ${credsPath}:`, err.message);
    }
  }

  // Priority 3: Check for Bedrock/Vertex environment variables
  if (process.env.CLAUDE_CODE_USE_BEDROCK === '1') {
    console.error('[Auth] Amazon Bedrock authentication enabled');
    return { hasAuth: true, authMethod: 'Amazon Bedrock' };
  }

  if (process.env.CLAUDE_CODE_USE_VERTEX === '1') {
    console.error('[Auth] Google Vertex AI authentication enabled');
    return { hasAuth: true, authMethod: 'Google Vertex AI' };
  }

  // No authentication found
  console.error('[Auth] No authentication found');
  return {
    hasAuth: false,
    authMethod: 'none',
    error: 'No authentication method available. Please either:\n' +
           '  1. Set ANTHROPIC_API_KEY environment variable\n' +
           '  2. Run: claude login (to authenticate with Claude Code)\n' +
           '  3. Configure Amazon Bedrock or Google Vertex AI'
  };
}

/**
 * Build system prompt augmentation for Agent Teams mode.
 * Tells the Team Lead about its role and how to spawn teammates.
 */
function buildTeamPromptAugmentation(tc) {
  const lead = tc.members.find(m => m.isLead);
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

async function main() {
  try {
    // Check authentication and log warnings, but don't block
    const authCheck = checkAuthentication();

    if (!authCheck.hasAuth) {
      // Log warning but let SDK try anyway (SDK has its own auth resolution)
      console.error('[Auth] WARNING: No explicit authentication found');
      console.error('[Auth] SDK will attempt to use default authentication methods');
      console.error('[Auth] If this fails, please either:');
      console.error('[Auth]   1. Set ANTHROPIC_API_KEY environment variable');
      console.error('[Auth]   2. Run: claude login (to authenticate with Claude Code)');
      console.error('[Auth]   3. Configure Amazon Bedrock or Google Vertex AI');
    } else {
      console.error(`[Auth] Using authentication method: ${authCheck.authMethod}`);
    }

    // Build SDK options
    const modelId = getModelId(model);
    const is1MContext = modelId.endsWith('[1m]');
    console.error(`[DEBUG] Model mapping: "${model}" → "${modelId}" (1M context: ${is1MContext})`);

    // Default tools if not provided by frontend
    const defaultAllowedTools = [
      'Skill',        // Required to enable Skills from .claude/skills/
      'Task',         // Subagents
      'Read',
      'Write',
      'Edit',
      'Bash',
      'Glob',
      'Grep',
      'WebFetch',
      'WebSearch',
      'TodoWrite',
      'NotebookEdit',
      'SlashCommand',
      'BashOutput',
      'KillShell',
      'ExitPlanMode',
      'AskUserQuestion', // Interactive questions to user (SDK v0.1.71+)
    ];

    // Use allowedTools from config if provided, otherwise use defaults
    // Brain: btw-context-aware
    // An explicit empty array [] means "no tools" (read-only mode, e.g. BTW side-chain)
    const resolvedAllowedTools = allowedTools && Array.isArray(allowedTools)
      ? allowedTools
      : defaultAllowedTools;

    console.error(`[DEBUG] Using ${resolvedAllowedTools.length} allowed tools:`, resolvedAllowedTools.slice(0, 5).join(', ') + '...');

    // Track whether the plan has been approved in this session to prevent
    // duplicate approval requests when SDK re-enters plan mode
    // Brain: fix-duplicate-plan-approval
    let planAlreadyApproved = false;

    // Brain: gotcha-sdk-bundled-cli-200k-context-window
    // The native Claude CLI binary handles prompt caching ~20x more efficiently
    // than the SDK's bundled cli.js (300 vs 6200 uncached tokens/message).
    // It also correctly resolves the 1M context window feature flag.
    const isWindows = process.platform === 'win32';
    const nativeClaudePath = isWindows
      ? join(homedir(), '.claude', 'local', 'claude.exe')
      : join(homedir(), '.local', 'bin', 'claude');
    const hasNativeCli = existsSync(nativeClaudePath);

    const options = {
      model: modelId,
      // Brain: 1m-context-window-support
      // The [1m] suffix in modelId is enough — the CLI handles it natively.
      // Opus 4.6 has 1M automatically; Sonnet 4.6 uses [1m] suffix for explicit opt-in.
      // No betas needed (GA since March 2026, beta header is ignored).
      ...(hasNativeCli ? { pathToClaudeCodeExecutable: nativeClaudePath } : {}),
      // Enable automatic reading of CLAUDE.md and project settings
      settingSources: ['project', 'user', 'local'],

      // =============================================================================
      // TOOLS CONFIGURATION (SDK v0.1.76)
      //
      // Using the claude_code preset for ALL default tools (55+)
      // PLUS AskUserQuestion as a custom tool for interactive user choices
      //
      // From SDK docs:
      // - `tools`: can be array combining preset + custom tools
      // - `allowedTools`: filters which tools Claude can actually use
      // - `canUseTool`: permission callback fires when tools need approval
      // =============================================================================

      // Use claude_code preset for all standard tools
      tools: {
        type: 'preset',
        preset: 'claude_code'
      },

      // allowedTools filters from the preset - includes AskUserQuestion
      allowedTools: resolvedAllowedTools,

      // 🧠 System Prompt with Memory Context (already populated above)
      // Memory search was performed BEFORE building options (now async with AI extraction)
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
          // STATIC parts only in systemPrompt — dynamic parts (gitContext) moved to contextPrefix
          const skillContent = loadBundledSkill('systematic-debugging');
          const brainHints = loadBrainHints(cwd);
          const hintsBlock = brainHints.length > 0
            ? brainHints.map(s => `- ${s}`).join('\n')
            : '(no Brain entries found in this project)';

          let debugPrompt = '';

          if (skillContent) {
            debugPrompt += `\n\n## Systematic Debugging Methodology\n\n${skillContent}`;
          }

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
        + (teamContext ? buildTeamPromptAugmentation(teamContext) : ''),
        // Brain: fix-session-limit-prompt-cache
        // ideContext removed from systemPrompt — injected as contextPrefix in user prompt below
      },

      // =============================================================================
      // PERMISSION CALLBACK - Handles AskUserQuestion and other permission requests
      // NOTE: AskUserQuestion does NOT appear in "Available Tools" list - it's handled
      // internally by the SDK and only triggers when Claude decides to ask the user
      // =============================================================================
      canUseTool: async (toolName, input, options) => {
        console.error(`[canUseTool] 🔧 PERMISSION REQUEST for tool: ${toolName}`);
        console.error(`[canUseTool] Input:`, JSON.stringify(input, null, 2).substring(0, 500));

        // Handle AskUserQuestion tool - requires user interaction
        if (toolName === 'AskUserQuestion') {
          console.error(`[canUseTool] AskUserQuestion detected, forwarding to frontend`);
          console.error(`[canUseTool] Questions:`, JSON.stringify(input.questions, null, 2));

          try {
            // Send request to frontend and wait for user's answers (no timeout)
            // The frontend will receive this event and show the widget
            // The requestId is used to match the response when user answers
            const response = await requestFromFrontend('ask_user_question', {
              questions: input.questions,
              // Include any tool context if available from SDK
              toolContext: options?.signal ? 'with_signal' : 'no_signal',
            }, 0); // 0 = no timeout, wait indefinitely

            console.error(`[canUseTool] Received answers from frontend:`, JSON.stringify(response.answers, null, 2));

            // Return the answers to the SDK
            // The answers format should match what SDK expects:
            // { "Question text": "Selected option label" }
            return {
              behavior: 'allow',
              updatedInput: {
                questions: input.questions,
                answers: response.answers,
              },
            };
          } catch (error) {
            console.error(`[canUseTool] Error getting answers:`, error.message);
            // Deny if we couldn't get answers
            return {
              behavior: 'deny',
              message: `Failed to get user answers: ${error.message}`,
            };
          }
        }

        // Handle ExitPlanMode - requires user approval before proceeding
        // Without this, plans get auto-approved without user interaction
        // Brain: fix-duplicate-plan-approval
        if (toolName === 'ExitPlanMode') {
          // If plan was already approved in this session, auto-approve subsequent calls.
          // The SDK may re-enter plan mode even after approval because the process
          // permissionMode stays 'plan' for the entire session lifetime.
          if (planAlreadyApproved) {
            console.error(`[canUseTool] ExitPlanMode detected but plan already approved — auto-allowing`);
            return {
              behavior: 'allow',
              updatedInput: input,
            };
          }

          console.error(`[canUseTool] ExitPlanMode detected, requesting user approval`);
          console.error(`[canUseTool] Plan:`, JSON.stringify(input, null, 2).substring(0, 1000));

          try {
            // Send plan approval request to frontend and wait for user's decision
            const response = await requestFromFrontend('plan_approval_request', {
              plan: input,
            }, 0); // 0 = no timeout, wait indefinitely

            console.error(`[canUseTool] Plan approval response:`, JSON.stringify(response, null, 2));

            // Response comes as { requestId, answers: { approved: 'true'/'false', feedback: '...' } }
            const answers = response.answers || response;
            const isApproved = answers.approved === 'true' || answers.approved === true;

            if (isApproved) {
              // Mark as approved so subsequent ExitPlanMode calls are auto-approved
              planAlreadyApproved = true;
              // User approved the plan - allow ExitPlanMode to proceed
              return {
                behavior: 'allow',
                updatedInput: input,
              };
            } else {
              // User rejected the plan - deny ExitPlanMode
              // Do NOT set planAlreadyApproved — agent can revise and resubmit
              const feedback = answers.feedback || 'User rejected the plan';
              return {
                behavior: 'deny',
                message: feedback,
              };
            }
          } catch (error) {
            console.error(`[canUseTool] Error getting plan approval:`, error.message);
            // Deny if we couldn't get approval
            return {
              behavior: 'deny',
              message: `Failed to get plan approval: ${error.message}`,
            };
          }
        }

        // Default: allow all other tools
        return {
          behavior: 'allow',
          updatedInput: input,
        };
      },
    };

    // Only add permissionMode if explicitly provided (not undefined)
    // When undefined, SDK uses default behavior (auto-approve)
    if (permissionMode !== undefined) {
      options.permissionMode = permissionMode;
      console.error(`[DEBUG] Using permissionMode: ${permissionMode}`);
    } else {
      console.error(`[DEBUG] permissionMode not set - SDK will use default (auto-approve)`);
    }

    // Map thinkingMode to new SDK thinking config (SDK 0.2.48+)
    // Old: options.thinkingMode = 'auto' | 'think' | 'hard' | 'harder' | 'ultra'
    // New: options.thinking = { type: 'adaptive' | 'enabled' | 'disabled' }
    //      options.effort = 'low' | 'medium' | 'high' | 'max'
    // Brain: sdk-thinking-mode-migration
    if (thinkingMode === 'disabled') {
      options.thinking = { type: 'disabled' };
      console.error(`[DEBUG] Thinking DISABLED`);
    } else if (thinkingMode && thinkingMode !== 'auto') {
      // Explicit thinking modes ('think', 'hard', 'harder', 'ultra') → ensure adaptive + map to effort
      options.thinking = { type: 'adaptive' };
      // Map thinking mode to effort if effort not explicitly set
      if (!effort) {
        const thinkingToEffort = {
          'think': 'medium',
          'hard': 'high',
          'harder': 'max',
          'ultra': 'max',
        };
        const mappedEffort = thinkingToEffort[thinkingMode];
        if (mappedEffort) {
          options.effort = mappedEffort;
          console.error(`[DEBUG] Thinking mode '${thinkingMode}' → effort '${mappedEffort}'`);
        }
      }
    } else {
      // 'auto' or undefined → let SDK use its default (adaptive for Opus 4.6)
      console.error(`[DEBUG] Thinking mode: default (adaptive)`);
    }

    // Enable 1M context window for supported models (Opus 4.6, Sonnet 4.6)
    // This beta flag is checked by the SDK's internal uM() function which controls:
    // - modelUsage.contextWindow reporting (200k vs 1M)
    // - Auto-compaction threshold (~155k vs ~967k)
    // - Blocking limit calculation
    // Without it, the SDK operates in 200k mode even for 1M-capable models.
    options.betas = ['context-1m-2025-08-07'];

    if (cwd) {
      options.cwd = cwd;
      console.error(`[DEBUG] Working directory: ${cwd}`);
    } else {
      console.error(`[DEBUG] No working directory specified, using default`);
    }

    if (sessionId) {
      options.resume = sessionId;
      console.error(`[DEBUG] Resuming session: ${sessionId}`);
    } else {
      console.error(`[DEBUG] Starting new session`);
    }

    console.error(`[DEBUG] Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);
    console.error(`[DEBUG] Attachments:`, attachments ? attachments.length : 0);

    if (agents && Array.isArray(agents) && agents.length > 0) {
      // Transform agents to SDK format
      options.agents = agents.map(agent => ({
        name: agent.name,
        description: agent.description,
        model: agent.model,
        path: agent.filePath,
      }));
      console.error(`[DEBUG] Using ${agents.length} agent(s)`);
    }

    // Add structured outputs if provided (beta feature)
    if (outputFormat) {
      options.outputFormat = outputFormat;
      console.error(`[DEBUG] Using structured outputs with schema:`, JSON.stringify(outputFormat, null, 2));
    }

    // =============================================================================
    // TASK LIST PERSISTENCE (SDK 0.2.19+)
    // Tasks persist across sessions in ~/.claude/tasks/
    // Enables cross-session task tracking with dependencies and blockers
    // =============================================================================
    // =============================================================================
    // MCP TOOL SEARCH (SDK 0.2.1+) - LAZY LOADING
    // Dynamically loads MCP tools on-demand instead of preloading all upfront
    // Reduces context overhead by 85% (from ~77K to ~8.7K tokens with 50+ tools)
    // See: https://platform.claude.com/docs/en/agent-sdk/mcp#mcp-tool-search
    //
    // Values: 'auto' (>10% context), 'auto:N' (>N% context), 'true', 'false'
    // =============================================================================
    options.env = {
      ...process.env,
      ENABLE_TOOL_SEARCH: 'auto', // Activate when MCP tools exceed 10% of context
    };
    console.error(`[DEBUG] MCP Tool Search ENABLED (auto mode - activates at >10% context usage)`);

    if (sessionId) {
      const taskListId = `quack-${sessionId}`;
      options.env = {
        ...options.env,
        CLAUDE_CODE_TASK_LIST_ID: taskListId,
      };
      console.error(`[DEBUG] Task list ID set: ${taskListId}`);
    }

    // =============================================================================
    // FILE CHECKPOINTING (SDK 0.2.7+)
    // Enable automatic file snapshots before modifications for rollback capability
    // NOTE: replay-user-messages DISABLED to reduce token consumption.
    // It re-sends all previous user messages on each query, which multiplies
    // input tokens on long sessions. File rewind still works but may not have
    // UUIDs for older messages (rewind to recent messages should still work).
    // =============================================================================
    options.enableFileCheckpointing = true;
    console.error(`[DEBUG] File checkpointing ENABLED (replay-user-messages disabled to save tokens)`);

    // Add effort parameter if provided explicitly (takes precedence over thinkingMode mapping)
    // Controls quality vs speed/cost tradeoff: 'low', 'medium', 'high', 'max'
    if (effort) {
      options.effort = effort;
      console.error(`[DEBUG] Using explicit effort level: ${effort}`);
    }

    // Load MCP servers: priority is passed config > .mcp.json file
    let resolvedMcpServers = mcpServers;
    console.error(`[MCP] === MCP SERVER LOADING ===`);
    console.error(`[MCP] mcpServers from config: ${mcpServers ? JSON.stringify(Object.keys(mcpServers)) : 'null'}`);
    console.error(`[MCP] cwd: ${cwd || 'null'}`);

    if (!resolvedMcpServers && cwd) {
      console.error(`[MCP] No mcpServers in config, loading from .mcp.json...`);
      resolvedMcpServers = loadMCPServersFromFile(cwd);
    } else if (!resolvedMcpServers && !cwd) {
      console.error(`[MCP] No cwd provided, loading global MCP servers only...`);
      resolvedMcpServers = loadGlobalMCPServers();
    }

    console.error(`[MCP] resolvedMcpServers: ${resolvedMcpServers ? JSON.stringify(Object.keys(resolvedMcpServers)) : 'null'}`);
    console.error(`[MCP] === END MCP SERVER LOADING ===`);

    // Add IDE Tools MCP server (stdio-based for reliability)
    // Note: SDK MCP servers (createSdkMcpServer) have a known bug with "Stream closed" errors
    // See: https://github.com/anthropics/claude-code/issues/6710
    // Using stdio transport instead for stability
    const ideMcpServerPath = join(__dirname, 'ide-mcp-server.js');
    const codeIntelMcpServerPath = join(__dirname, 'code-intel-mcp-server.js');
    console.error(`[MCP] IDE MCP server path: ${ideMcpServerPath}`);
    console.error(`[MCP] IDE MCP exists: ${existsSync(ideMcpServerPath)}`);
    console.error(`[MCP] Code Intel MCP server path: ${codeIntelMcpServerPath}`);
    console.error(`[MCP] Code Intel MCP exists: ${existsSync(codeIntelMcpServerPath)}`);

    // Merge MCP servers: file-based servers + built-in Quack servers (ide + code-intel)
    options.mcpServers = {
      ...(resolvedMcpServers || {}),
      'ide-tools': {
        command: 'node',
        args: [ideMcpServerPath],
      },
      'code-intel': {
        type: 'stdio',
        command: 'node',
        args: [codeIntelMcpServerPath],
      },
    };

    const builtInServerCount = 2; // ide-tools + code-intel
    if (resolvedMcpServers && Object.keys(resolvedMcpServers).length > 0) {
      console.error(`[MCP] Loaded ${Object.keys(resolvedMcpServers).length + builtInServerCount} MCP servers:`, Object.keys(options.mcpServers).join(', '));
    } else {
      console.error(`[MCP] Using built-in MCP servers only (ide-tools, code-intel)`);
    }

    console.error(`[DEBUG] Final Options:`, JSON.stringify(options, null, 2));

    // Query Claude with streaming input mode
    // IMPORTANT: SDK MCP servers REQUIRE streaming input mode (async generator)
    // We ALWAYS use the generator when MCP servers are configured
    // See: https://platform.claude.com/docs/en/agent-sdk/custom-tools
    const hasMcpServers = options.mcpServers && Object.keys(options.mcpServers).length > 0;
    const useStreamingInput = hasMcpServers || (attachments && attachments.length > 0);

    console.error(`[DEBUG] Using streaming input mode: ${useStreamingInput} (MCP servers: ${hasMcpServers}, attachments: ${attachments?.length || 0})`);

    // Brain: fix-session-limit-prompt-cache
    // Dynamic context (ideContext, gitContext) prepended to user prompt to preserve system prompt cache.
    let contextPrefix = '';
    if (ideContext) {
      contextPrefix += `\n\n## IDE Context\n\n${ideContext}`;
    }
    if (debugMode) {
      const gitCtx = loadGitContext(cwd);
      if (gitCtx) contextPrefix += gitCtx;
    }
    const finalPrompt = contextPrefix
      ? `${prompt}\n\n<system-reminder>\n${contextPrefix}\n</system-reminder>`
      : prompt;

    // Brain: gotcha-stamina-overhead-static-estimate
    // Count prompt tokens in parallel for precise overhead measurement (new sessions only)
    const isNewSession = !sessionId;
    let countTokensPromise = null;
    if (isNewSession) {
      const promptContent = createMessageContent(finalPrompt, attachments);
      countTokensPromise = countPromptTokens(modelId, promptContent);
    }

    // Override the module-level prompt for generateMessages()
    prompt = finalPrompt;

    const stream = query({
      prompt: useStreamingInput ? generateMessages() : finalPrompt,
      options,
    });

    // Stream events - no retry (retries re-send the full prompt, wasting tokens)
    try {
      let promptTokensEmitted = false;
      for await (const event of stream) {
        // Log slash command info from system events
        if (event.type === 'system' && event.subtype === 'init') {
          console.error(`[DEBUG] System initialized - Session: ${event.session_id}`);
          if (event.slash_commands) {
            console.error(`[DEBUG] Available slash commands:`, event.slash_commands);
          }
          // Log MCP server connection status
          if (event.mcp_servers) {
            console.error(`[MCP] Server status:`, JSON.stringify(event.mcp_servers, null, 2));
            const failedServers = event.mcp_servers.filter(s => s.status !== 'connected');
            if (failedServers.length > 0) {
              console.error(`[MCP] ⚠️ Failed to connect to servers:`, failedServers);
            }
          }
        }

        // Log agent/subagent events for debugging
        if (event.type === 'agent') {
          console.error(`[DEBUG] 🤖 Subagent event:`, JSON.stringify(event, null, 2));
        }

        // Log Task tool invocations (subagent delegation)
        if (event.type === 'assistant' && event.message?.content) {
          const taskTools = event.message.content.filter(
            (block) => block.type === 'tool_use' && block.name?.toLowerCase() === 'task'
          );
          if (taskTools.length > 0) {
            console.error(`[DEBUG] 🎯 Task tool invocation detected:`, JSON.stringify(taskTools, null, 2));
          }
        }

        // 🦆 DEBUG: Log assistant event usage to diagnose Messages: 0 bug
        if (event.type === 'assistant' && event.message?.usage) {
          console.error(`[DEBUG] 🦆 ASSISTANT MESSAGE USAGE:`, JSON.stringify({
            messageId: event.message.id,
            usage: event.message.usage,
          }, null, 2));
        }

        // 🦆 DEBUG: Log result event details to diagnose Messages: 0 bug
        if (event.type === 'result') {
          console.error(`[DEBUG] 🦆 RESULT EVENT:`, JSON.stringify({
            type: event.type,
            subtype: event.subtype,
            usage: event.usage,
            modelUsage: event.modelUsage,
            total_cost_usd: event.total_cost_usd,
          }, null, 2));
          // Brain: 1m-context-window-support
          // Log contextWindow specifically to verify 1M activation
          if (event.modelUsage || event.model_usage) {
            const mu = event.modelUsage || event.model_usage;
            for (const [modelName, usage] of Object.entries(mu)) {
              if (usage?.contextWindow) {
                console.error(`[DEBUG] 🦆 contextWindow for ${modelName}: ${usage.contextWindow} (${usage.contextWindow >= 1_000_000 ? '1M' : '200k'})`);
              }
            }
          }
        }

        // Brain: gotcha-stamina-overhead-static-estimate
        // Emit prompt_token_count on first assistant event for precise overhead calculation
        if (!promptTokensEmitted && countTokensPromise && event.type === 'assistant') {
          const promptTokens = await countTokensPromise;
          if (promptTokens !== null) {
            emitEvent({ type: 'prompt_token_count', promptTokens });
          }
          promptTokensEmitted = true;
        }

        emitEvent(event);
      }

      // If no assistant event came, still emit prompt tokens
      if (!promptTokensEmitted && countTokensPromise) {
        const promptTokens = await countTokensPromise;
        if (promptTokens !== null) {
          emitEvent({ type: 'prompt_token_count', promptTokens });
        }
      }

      // Success - emit final complete event
      emitEvent({
        type: 'complete',
      });

      // 🦆 IMPORTANT: Exit process cleanly to avoid hanging
      // MCP servers may keep event loop open, so we need explicit exit
      process.exit(0);

    } catch (streamError) {
      const errorMsg = streamError instanceof Error ? streamError.message : String(streamError);
      const errorStack = streamError instanceof Error ? streamError.stack : '';

      const isSubagentCrash = errorStack?.includes('ProcessTransport') ||
        errorStack?.includes('exitHandler') ||
        errorMsg.includes('process exited') ||
        errorMsg.includes('exit code') ||
        errorMsg.includes('Stream closed');

      console.error(`[ERROR] Stream error: ${errorMsg}`);

      // Emit a user-friendly error message for subagent crashes
      if (isSubagentCrash) {
        emitEvent({
          type: 'assistant',
          message: {
            content: [{
              type: 'text',
              text: `\n\n> **Error:** A subagent process crashed unexpectedly. This can happen due to rate limits, timeout, or temporary issues. Please try again.\n\n`,
            }],
          },
        });
        emitEvent({ type: 'complete' });
        process.exit(0);
      }

      // Fatal error - propagate normally
      emitError(streamError);
      process.exit(1);
    }
  } catch (error) {
    emitError(error);
    process.exit(1);
  }
}

main();
