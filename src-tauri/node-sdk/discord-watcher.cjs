#!/usr/bin/env node
/**
 * Discord Message Watcher for Quack
 *
 * Monitors Discord channels for trigger messages and routes queries to Quack AI agents.
 * Uses discord.js v14 for the Discord API.
 *
 * Features:
 *   - Configurable trigger patterns (default: @quack, !quack)
 *   - Agent routing with fuzzy matching
 *   - Conversation context support (threads)
 *   - Graceful error recovery
 *   - Structured logging
 *
 * Triggers:
 *   @quack <query>         → Routes to default agent
 *   !quack <query>         → Alternative trigger
 *   @quack:sophie <query>  → Routes to Agent Sophie
 *   @quack:agent-name <query> → Routes to specific agent
 *
 * Usage:
 *   node discord-watcher.cjs [options]
 *   --config <path>    Path to config file (default: ~/.quack/discord-watcher.json)
 *   --verbose          Enable verbose logging
 *   --dry-run          Don't send responses, just log
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Check for discord.js
let Client, GatewayIntentBits, Partials;
try {
  const discord = require('discord.js');
  Client = discord.Client;
  GatewayIntentBits = discord.GatewayIntentBits;
  Partials = discord.Partials;
} catch (err) {
  console.error('[ERROR] discord.js not installed. Run: npm install discord.js');
  console.error('[INFO] Install command: cd src-tauri/node-sdk && npm install discord.js');
  process.exit(1);
}

// ============================================================
// QUACK API INTEGRATION
// ============================================================

const QUACK_API_PORT = 6768;
const QUACK_API_URL = `http://127.0.0.1:${QUACK_API_PORT}`;

// ============================================================
// ACTIVE SESSIONS TRACKING - For continuous conversations
// ============================================================

// In-memory cache of active sessions per channel/thread
// Structure: { channelId: { sessionId, agentId, agentName, projectName, lastActivity, trigger } }
const activeSessions = new Map();

/**
 * Load active sessions from disk
 */
function loadActiveSessions() {
  try {
    const filePath = path.join(process.env.HOME, '.quack/discord-active-sessions.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const now = Date.now();
      for (const [channelId, session] of Object.entries(data.sessions || {})) {
        if (now - session.lastActivity < (data.timeout || 3600000)) {
          activeSessions.set(channelId, session);
        }
      }
      log('INFO', `Loaded ${activeSessions.size} active Discord sessions`);
    }
  } catch (err) {
    log('WARN', `Could not load active sessions: ${err.message}`);
  }
}

/**
 * Save active sessions to disk
 */
function saveActiveSessions() {
  try {
    const filePath = path.join(process.env.HOME, '.quack/discord-active-sessions.json');
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = {
      sessions: Object.fromEntries(activeSessions),
      timeout: 3600000,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    log('WARN', `Could not save active sessions: ${err.message}`);
  }
}

/**
 * Get active session for a channel (if exists and not expired)
 */
function getActiveSession(channelId, timeout = 3600000) {
  const session = activeSessions.get(channelId);
  if (!session) return null;

  const now = Date.now();
  if (now - session.lastActivity > timeout) {
    activeSessions.delete(channelId);
    saveActiveSessions();
    log('INFO', `Session expired for channel ${channelId}`);
    return null;
  }

  return session;
}

/**
 * Set active session for a channel
 */
function setActiveSession(channelId, sessionData) {
  activeSessions.set(channelId, {
    ...sessionData,
    lastActivity: Date.now()
  });
  saveActiveSessions();
}

/**
 * Update last activity time for a session
 */
function touchActiveSession(channelId) {
  const session = activeSessions.get(channelId);
  if (session) {
    session.lastActivity = Date.now();
    saveActiveSessions();
  }
}

// ============================================================
// QUACK API FUNCTIONS
// ============================================================

/**
 * Create a session via Quack's HTTP API
 */
function createQuackSession(agent, projectPath, projectName, title, description, senderInfo = null) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      agent_id: agent.id,
      project_path: projectPath,
      project_name: projectName,
      title: title,
      description: description,
      source: 'discord',
      discord_sender: senderInfo,
    });

    const options = {
      hostname: '127.0.0.1',
      port: QUACK_API_PORT,
      path: '/session/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.success && result.session_id) {
            log('INFO', `Created session via API: ${result.session_id} for agent ${agent.name}`);
            resolve({ id: result.session_id, ...result });
          } else {
            log('ERROR', `API error: ${result.error || 'Unknown error'}`);
            reject(new Error(result.error || 'Failed to create session'));
          }
        } catch (e) {
          log('ERROR', `Invalid API response: ${body.substring(0, 200)}`);
          reject(new Error(`Invalid response from Quack API: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      log('ERROR', `Failed to connect to Quack API: ${err.message}`);
      log('HINT', 'Make sure Quack app is running');
      reject(new Error(`Quack API not available: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Quack API request timeout'));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Start a chat session via Quack's HTTP API (auto-sends prompt)
 */
function startChatSession(sessionId, prompt, discordChannelId) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      session_id: sessionId,
      prompt: prompt,
      discord_channel_id: discordChannelId,
    });

    const options = {
      hostname: '127.0.0.1',
      port: QUACK_API_PORT,
      path: '/session/start-chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.success) {
            log('INFO', `Started chat session via API: ${sessionId}`);
            resolve(result);
          } else {
            log('ERROR', `API error starting chat: ${result.error || 'Unknown error'}`);
            reject(new Error(result.error || 'Failed to start chat'));
          }
        } catch (e) {
          log('ERROR', `Invalid API response for start-chat: ${body.substring(0, 200)}`);
          reject(new Error(`Invalid response from Quack API: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      log('ERROR', `Failed to connect to Quack API for start-chat: ${err.message}`);
      reject(new Error(`Quack API not available: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Quack API request timeout'));
    });

    req.write(payload);
    req.end();
  });
}

// ============================================================
// CONFIGURATION
// ============================================================

const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const DRY_RUN = args.includes('--dry-run');
const configIndex = args.indexOf('--config');
const customConfigPath = configIndex !== -1 ? args[configIndex + 1] : null;

const DEFAULT_CONFIG = {
  // Discord settings
  token: process.env.DISCORD_BOT_TOKEN || '',
  allowedChannels: [],        // Empty = all channels, or specify IDs
  allowedServers: [],         // Empty = all servers, or specify IDs

  // Polling settings
  pollInterval: 1000,

  // Storage paths
  agentsFile: path.join(process.env.HOME, 'Library/Application Support/com.quack.terminal/quack-agents.json'),
  configFile: path.join(process.env.HOME, '.quack/discord-watcher.json'),
  logFile: path.join(process.env.HOME, '.quack/discord-watcher.log'),

  // Agent settings
  defaultAgent: 'sophie',
  defaultProject: 'quack-app',
  agentTimeout: 300000,

  // Trigger configuration
  triggerPatterns: [
    '@quack',
    '!quack',
    '/quack',
  ],

  // Custom project triggers
  customProjectTriggers: {
    '@studio-futuro': {
      projectName: 'studio-futuro',
      preferredRole: 'communication',
    },
    '@flow-bi': {
      projectName: 'flow-bi',
      preferredRole: null,
    },
  },

  // Response settings
  maxResponseLength: 2000,    // Discord message limit
  thinkingEmoji: '🦆',
  errorEmoji: '❌',
  successEmoji: '✅',

  // Context settings
  enableContext: true,
  contextMessageCount: 10,

  // Continuous conversation settings
  enableContinuousConversation: true,
  sessionTimeout: 3600000,    // 1 hour
};

function loadConfig() {
  const configPath = customConfigPath || DEFAULT_CONFIG.configFile;

  try {
    if (fs.existsSync(configPath)) {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { ...DEFAULT_CONFIG, ...userConfig };
    }
  } catch (err) {
    log('WARN', `Failed to load config from ${configPath}: ${err.message}`);
  }

  // Create default config file
  try {
    const quackDir = path.dirname(DEFAULT_CONFIG.configFile);
    if (!fs.existsSync(quackDir)) {
      fs.mkdirSync(quackDir, { recursive: true });
    }
    fs.writeFileSync(DEFAULT_CONFIG.configFile, JSON.stringify(DEFAULT_CONFIG, null, 2));
    log('INFO', `Created default config at ${DEFAULT_CONFIG.configFile}`);
  } catch (err) {
    log('WARN', `Could not create default config: ${err.message}`);
  }

  return DEFAULT_CONFIG;
}

const CONFIG = loadConfig();

// ============================================================
// LOGGING
// ============================================================

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;

  if (level === 'DEBUG' && !VERBOSE) return;

  const logLine = data
    ? `${prefix} ${message} ${JSON.stringify(data)}`
    : `${prefix} ${message}`;

  console.log(logLine);

  try {
    fs.appendFileSync(CONFIG.logFile, logLine + '\n');
  } catch (err) {
    // Silent fail
  }
}

// ============================================================
// AGENT MANAGEMENT
// ============================================================

function loadAgents() {
  try {
    if (fs.existsSync(CONFIG.agentsFile)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.agentsFile, 'utf8'));
      return data.agents || [];
    }
  } catch (err) {
    log('WARN', `Failed to load agents: ${err.message}`);
  }
  return [];
}

function findAgentByName(agents, name) {
  const normalizedName = name.toLowerCase().trim();

  // Exact match
  let agent = agents.find(a =>
    a.name.toLowerCase() === normalizedName ||
    a.name.toLowerCase() === `agent ${normalizedName}`
  );

  if (agent) return agent;

  // Fuzzy match
  agent = agents.find(a =>
    a.name.toLowerCase().includes(normalizedName) ||
    normalizedName.includes(a.name.toLowerCase().replace('agent ', ''))
  );

  return agent;
}

function findAgentByRole(agents, role, projectName = null) {
  const normalizedRole = role.toLowerCase();

  // Filter by project if specified
  let candidates = projectName
    ? agents.filter(a => a.projectName?.toLowerCase() === projectName.toLowerCase())
    : agents;

  // Find by role in personality
  const agent = candidates.find(a => {
    const personalityRole = a.personality?.role?.toLowerCase() || '';
    return personalityRole.includes(normalizedRole);
  });

  return agent;
}

function getDefaultAgent(agents, projectName = null) {
  // Filter by project if specified
  let candidates = projectName
    ? agents.filter(a => a.projectName?.toLowerCase() === projectName.toLowerCase())
    : agents;

  if (candidates.length === 0) {
    candidates = agents;
  }

  // Find by default name
  const defaultAgent = findAgentByName(candidates, CONFIG.defaultAgent);
  if (defaultAgent) return defaultAgent;

  // Return first available
  return candidates[0];
}

// ============================================================
// MESSAGE PARSING
// ============================================================

function parseTrigger(content) {
  const lowerContent = content.toLowerCase().trim();

  // Check custom project triggers first
  for (const [trigger, config] of Object.entries(CONFIG.customProjectTriggers)) {
    if (lowerContent.startsWith(trigger.toLowerCase())) {
      const query = content.substring(trigger.length).trim();
      return {
        type: 'project',
        trigger: trigger,
        projectName: config.projectName,
        preferredRole: config.preferredRole,
        agentName: null,
        query: query,
      };
    }
  }

  // Check standard triggers
  for (const trigger of CONFIG.triggerPatterns) {
    const lowerTrigger = trigger.toLowerCase();

    // Check for @quack:agentname pattern
    const agentPattern = new RegExp(`^${escapeRegex(lowerTrigger)}:([\\w-]+)\\s+(.*)`, 'i');
    const agentMatch = content.match(agentPattern);

    if (agentMatch) {
      return {
        type: 'agent',
        trigger: trigger,
        projectName: null,
        preferredRole: null,
        agentName: agentMatch[1],
        query: agentMatch[2].trim(),
      };
    }

    // Check for simple trigger
    if (lowerContent.startsWith(lowerTrigger)) {
      const query = content.substring(trigger.length).trim();
      if (query.length > 0) {
        return {
          type: 'default',
          trigger: trigger,
          projectName: null,
          preferredRole: null,
          agentName: null,
          query: query,
        };
      }
    }
  }

  return null;
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================
// MESSAGE HANDLING
// ============================================================

async function handleTriggerMessage(message, trigger) {
  const agents = loadAgents();

  if (agents.length === 0) {
    log('ERROR', 'No agents found');
    await message.reply(`${CONFIG.errorEmoji} No Quack agents available. Please create an agent first.`);
    return;
  }

  // Find the right agent
  let agent = null;
  let projectPath = null;
  let projectName = trigger.projectName || CONFIG.defaultProject;

  if (trigger.type === 'agent' && trigger.agentName) {
    agent = findAgentByName(agents, trigger.agentName);
    if (!agent) {
      await message.reply(`${CONFIG.errorEmoji} Agent "${trigger.agentName}" not found.`);
      return;
    }
  } else if (trigger.type === 'project' && trigger.preferredRole) {
    agent = findAgentByRole(agents, trigger.preferredRole, trigger.projectName);
    if (!agent) {
      agent = getDefaultAgent(agents, trigger.projectName);
    }
  } else {
    agent = getDefaultAgent(agents, projectName);
  }

  if (!agent) {
    await message.reply(`${CONFIG.errorEmoji} No suitable agent found.`);
    return;
  }

  projectPath = agent.projectPath || process.cwd();
  projectName = agent.projectName || CONFIG.defaultProject;

  // Send thinking indicator
  const thinkingReply = await message.reply(`${CONFIG.thinkingEmoji} ${agent.name} sta elaborando in Quack...`);

  try {
    // Create session
    const senderInfo = {
      userId: message.author.id,
      username: message.author.username,
      displayName: message.author.displayName || message.author.username,
      channelId: message.channel.id,
      channelName: message.channel.name,
      guildId: message.guild?.id,
      guildName: message.guild?.name,
    };

    const sessionTitle = `Discord: ${trigger.query.substring(0, 50)}${trigger.query.length > 50 ? '...' : ''}`;
    const session = await createQuackSession(
      agent,
      projectPath,
      projectName,
      sessionTitle,
      trigger.query,
      senderInfo
    );

    // Track active session
    setActiveSession(message.channel.id, {
      sessionId: session.id,
      agentId: agent.id,
      agentName: agent.name,
      projectName: projectName,
      trigger: trigger.trigger,
    });

    // Build prompt with Discord reply instruction
    const prompt = `${trigger.query}

---
IMPORTANT: After completing this task, respond to the user via Discord.
Send the response to channel ID: ${message.channel.id}
User: ${senderInfo.displayName} (@${senderInfo.username})
Use the Discord MCP tool to send the response.`;

    // Start chat (auto-sends prompt)
    await startChatSession(session.id, prompt, message.channel.id);

    log('INFO', `Chat started in Quack for Discord user ${senderInfo.username}`, {
      sessionId: session.id,
      agent: agent.name,
      query: trigger.query.substring(0, 100),
    });

    // Update thinking message
    await thinkingReply.edit(`${CONFIG.successEmoji} ${agent.name} ha ricevuto la richiesta. La risposta arriverà qui quando pronta...`);

  } catch (err) {
    log('ERROR', `Failed to process Discord trigger: ${err.message}`);
    await thinkingReply.edit(`${CONFIG.errorEmoji} Errore: ${err.message}`);
  }
}

async function handleFollowUpMessage(message, activeSession) {
  const content = message.content.trim();

  // Touch session to update activity
  touchActiveSession(message.channel.id);

  // Send thinking indicator
  const thinkingReply = await message.reply(`${CONFIG.thinkingEmoji} ${activeSession.agentName} sta elaborando...`);

  try {
    const senderInfo = {
      userId: message.author.id,
      username: message.author.username,
      displayName: message.author.displayName || message.author.username,
      channelId: message.channel.id,
    };

    // Build prompt with Discord reply instruction
    const prompt = `${content}

---
IMPORTANT: After completing this task, respond to the user via Discord.
Send the response to channel ID: ${message.channel.id}
User: ${senderInfo.displayName} (@${senderInfo.username})
Use the Discord MCP tool to send the response.`;

    // Start chat on existing session
    await startChatSession(activeSession.sessionId, prompt, message.channel.id);

    log('INFO', `Follow-up sent to Quack session ${activeSession.sessionId}`);

    await thinkingReply.edit(`${CONFIG.successEmoji} ${activeSession.agentName} ha ricevuto il messaggio...`);

  } catch (err) {
    log('ERROR', `Failed to process follow-up: ${err.message}`);
    await thinkingReply.edit(`${CONFIG.errorEmoji} Errore: ${err.message}`);
  }
}

// ============================================================
// DISCORD CLIENT
// ============================================================

function startBot() {
  if (!CONFIG.token) {
    log('ERROR', 'Discord bot token not configured!');
    log('INFO', 'Set DISCORD_BOT_TOKEN env variable or add "token" to ~/.quack/discord-watcher.json');
    process.exit(1);
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message],
  });

  client.once('ready', () => {
    log('INFO', `Discord bot logged in as ${client.user.tag}`);
    log('INFO', `Watching for triggers: ${CONFIG.triggerPatterns.join(', ')}`);
    log('INFO', `Custom project triggers: ${Object.keys(CONFIG.customProjectTriggers).join(', ')}`);

    if (CONFIG.allowedChannels.length > 0) {
      log('INFO', `Restricted to channels: ${CONFIG.allowedChannels.join(', ')}`);
    }
    if (CONFIG.allowedServers.length > 0) {
      log('INFO', `Restricted to servers: ${CONFIG.allowedServers.join(', ')}`);
    }
  });

  client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Check server restrictions
    if (CONFIG.allowedServers.length > 0 && message.guild) {
      if (!CONFIG.allowedServers.includes(message.guild.id)) {
        return;
      }
    }

    // Check channel restrictions
    if (CONFIG.allowedChannels.length > 0) {
      if (!CONFIG.allowedChannels.includes(message.channel.id)) {
        return;
      }
    }

    const content = message.content.trim();
    if (!content) return;

    log('DEBUG', `Message from ${message.author.username}: ${content.substring(0, 100)}`);

    // Check for trigger
    const trigger = parseTrigger(content);

    if (trigger) {
      log('INFO', `Trigger detected: ${trigger.trigger}`, {
        type: trigger.type,
        query: trigger.query.substring(0, 100),
      });

      if (DRY_RUN) {
        log('INFO', '[DRY-RUN] Would process trigger:', trigger);
        return;
      }

      await handleTriggerMessage(message, trigger);
      return;
    }

    // Check for follow-up in active session
    if (CONFIG.enableContinuousConversation) {
      const activeSession = getActiveSession(message.channel.id, CONFIG.sessionTimeout);
      if (activeSession) {
        log('DEBUG', `Follow-up message in active session ${activeSession.sessionId}`);

        if (DRY_RUN) {
          log('INFO', '[DRY-RUN] Would send follow-up:', { content: content.substring(0, 100) });
          return;
        }

        await handleFollowUpMessage(message, activeSession);
      }
    }
  });

  client.on('error', (err) => {
    log('ERROR', `Discord client error: ${err.message}`);
  });

  // Login
  client.login(CONFIG.token).catch((err) => {
    log('ERROR', `Failed to login to Discord: ${err.message}`);
    log('INFO', 'Make sure your bot token is valid and has the required intents');
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    log('INFO', 'Shutting down Discord watcher...');
    saveActiveSessions();
    client.destroy();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('INFO', 'Received SIGTERM, shutting down...');
    saveActiveSessions();
    client.destroy();
    process.exit(0);
  });
}

// ============================================================
// MAIN
// ============================================================

log('INFO', '='.repeat(60));
log('INFO', 'Discord Watcher for Quack starting...');
log('INFO', `Config: ${customConfigPath || CONFIG.configFile}`);
log('INFO', `Verbose: ${VERBOSE}`);
log('INFO', `Dry-run: ${DRY_RUN}`);
log('INFO', '='.repeat(60));

// Load active sessions
loadActiveSessions();

// Start the bot
startBot();
