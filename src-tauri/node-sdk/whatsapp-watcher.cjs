#!/usr/bin/env node
/**
 * WhatsApp Message Watcher for Quack
 *
 * A robust, configurable system that monitors WhatsApp messages for triggers
 * and routes queries to Quack AI agents.
 *
 * Features:
 *   - Configurable trigger patterns (default: @quack)
 *   - Agent routing with fuzzy matching
 *   - Conversation context support
 *   - Graceful error recovery
 *   - Structured logging
 *   - Health monitoring
 *
 * Triggers:
 *   @quack <query>         → Routes to default agent
 *   @quack:sophie <query>  → Routes to Agent Sophie
 *   @quack:agent-name <query> → Routes to specific agent
 *
 * Usage:
 *   node whatsapp-watcher.cjs [options]
 *   --config <path>    Path to config file (default: ~/.quack/whatsapp-watcher.json)
 *   --verbose          Enable verbose logging
 *   --dry-run          Don't send responses, just log
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const http = require('http');

// ============================================================
// KANBAN INTEGRATION - Via Quack HTTP API
// ============================================================

// Quack backend HTTP server port (must match src-tauri/src/lib.rs)
const QUACK_API_PORT = 6768;
const QUACK_API_URL = `http://127.0.0.1:${QUACK_API_PORT}`;

// ============================================================
// ACTIVE SESSIONS TRACKING - For continuous conversations
// ============================================================

// In-memory cache of active sessions per chat
// Structure: { chatJid: { sessionId, agentId, agentName, projectName, lastActivity, trigger } }
const activeSessions = new Map();

/**
 * Load active sessions from disk (for persistence across restarts)
 */
function loadActiveSessions() {
  try {
    const filePath = path.join(process.env.HOME, '.quack/whatsapp-active-sessions.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const now = Date.now();
      // Only load non-expired sessions
      for (const [chatJid, session] of Object.entries(data.sessions || {})) {
        if (now - session.lastActivity < (data.timeout || 3600000)) {
          activeSessions.set(chatJid, session);
        }
      }
      console.error(`[INFO] Loaded ${activeSessions.size} active WhatsApp sessions`);
    }
  } catch (err) {
    console.error(`[WARN] Could not load active sessions: ${err.message}`);
  }
}

/**
 * Save active sessions to disk
 */
function saveActiveSessions() {
  try {
    const filePath = path.join(process.env.HOME, '.quack/whatsapp-active-sessions.json');
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = {
      sessions: Object.fromEntries(activeSessions),
      timeout: 3600000, // Default timeout
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`[WARN] Could not save active sessions: ${err.message}`);
  }
}

/**
 * Get active session for a chat (if exists and not expired)
 */
function getActiveSession(chatJid, timeout = 3600000) {
  const session = activeSessions.get(chatJid);
  if (!session) return null;

  const now = Date.now();
  if (now - session.lastActivity > timeout) {
    // Session expired
    activeSessions.delete(chatJid);
    saveActiveSessions();
    console.error(`[INFO] Session expired for chat ${chatJid}`);
    return null;
  }

  return session;
}

/**
 * Set active session for a chat
 */
function setActiveSession(chatJid, sessionData) {
  activeSessions.set(chatJid, {
    ...sessionData,
    lastActivity: Date.now()
  });
  saveActiveSessions();
}

/**
 * Update last activity time for a session
 */
function touchActiveSession(chatJid) {
  const session = activeSessions.get(chatJid);
  if (session) {
    session.lastActivity = Date.now();
    saveActiveSessions();
  }
}

/**
 * Add a message to an existing session via Quack HTTP API
 */
function addMessageToSession(sessionId, content, senderInfo) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      session_id: sessionId,
      content: content,
      source: 'whatsapp',
      sender_info: senderInfo,
    });

    const options = {
      hostname: '127.0.0.1',
      port: QUACK_API_PORT,
      path: '/session/message',
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
            resolve(result);
          } else {
            reject(new Error(result.error || 'Failed to add message'));
          }
        } catch (e) {
          reject(new Error(`Invalid API response: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
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

// Load active sessions on startup
loadActiveSessions();

/**
 * Create a Kanban session via Quack's HTTP API
 * This ensures proper file handling and UI notification via Tauri events
 */
function createKanbanSession(agent, projectPath, projectName, title, description, senderInfo = null) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      agent_id: agent.id,
      project_path: projectPath,
      project_name: projectName,
      title: title,
      description: description,
      source: 'whatsapp',
      whatsapp_sender: senderInfo,
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
            console.error(`[INFO] Created Kanban session via API: ${result.session_id} for agent ${agent.name}`);
            resolve({ id: result.session_id, ...result });
          } else {
            console.error(`[ERROR] API error: ${result.error || 'Unknown error'}`);
            reject(new Error(result.error || 'Failed to create session'));
          }
        } catch (e) {
          console.error(`[ERROR] Invalid API response: ${body.substring(0, 200)}`);
          reject(new Error(`Invalid response from Quack API: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[ERROR] Failed to connect to Quack API: ${err.message}`);
      console.error(`[HINT] Make sure Quack app is running`);
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
 * This triggers the frontend to select the session and auto-send the prompt
 * Claude in Quack has access to WhatsApp MCP, so it can respond directly
 */
function startChatSession(sessionId, prompt, whatsappRecipient) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      session_id: sessionId,
      prompt: prompt,
      whatsapp_recipient: whatsappRecipient,
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
            console.error(`[INFO] Started chat session via API: ${sessionId}`);
            resolve(result);
          } else {
            console.error(`[ERROR] API error starting chat: ${result.error || 'Unknown error'}`);
            reject(new Error(result.error || 'Failed to start chat'));
          }
        } catch (e) {
          console.error(`[ERROR] Invalid API response for start-chat: ${body.substring(0, 200)}`);
          reject(new Error(`Invalid response from Quack API: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[ERROR] Failed to connect to Quack API for start-chat: ${err.message}`);
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

// Parse command line arguments
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose');
const DRY_RUN = args.includes('--dry-run');
const ALLOW_OWN_MESSAGES = args.includes('--allow-own-messages');
const RESET_PROCESSED = args.includes('--reset');
const configIndex = args.indexOf('--config');
const customConfigPath = configIndex !== -1 ? args[configIndex + 1] : null;

// Default configuration
const DEFAULT_CONFIG = {
  // Database and API paths
  messagesDb: path.join(process.env.HOME, 'Desktop/Dev/Personal/whatsapp-mcp/whatsapp-bridge/store/messages.db'),
  whatsappApiUrl: 'http://localhost:8080',
  whatsappApiPort: 8080,

  // Polling settings
  pollInterval: 5000,           // 5 seconds
  maxPollRetries: 3,            // Retries before backoff
  backoffMultiplier: 2,         // Exponential backoff

  // Storage paths
  processedFile: path.join(process.env.HOME, '.quack/whatsapp-processed.json'),
  agentsFile: path.join(process.env.HOME, 'Library/Application Support/com.quack.terminal/quack-agents.json'),
  configFile: path.join(process.env.HOME, '.quack/whatsapp-watcher.json'),
  logFile: path.join(process.env.HOME, '.quack/whatsapp-watcher.log'),

  // Agent settings
  defaultAgent: 'sophie',
  defaultProject: 'quack-app',  // Default project name
  agentTimeout: 300000,         // 5 minutes

  // Trigger configuration
  triggerPrefix: '@quack',      // Can be customized
  triggerPatterns: [
    '@quack',                   // Default trigger
    '@duck',                    // Alternative
  ],

  // Custom project triggers with role-based agent matching
  // Maps a trigger pattern to a project name and optional preferred role
  customProjectTriggers: {
    '@studio-futuro': {
      projectName: 'studio-futuro',
      preferredRole: 'communication',  // Will match "Comunication and Brand manager", "Communication Manager", etc.
    },
    '@flow-bi': {
      projectName: 'flow-bi',
      preferredRole: null,  // Use first available agent
    },
  },

  // Response settings
  maxResponseLength: 4000,      // WhatsApp message limit
  thinkingMessage: true,        // Send "thinking..." message
  errorEmoji: '❌',
  successEmoji: '🦆',

  // Context settings
  enableContext: true,          // Include conversation history
  contextMessageCount: 5,       // Number of previous messages to include
  contextTimeWindow: 3600000,   // 1 hour - only include recent context

  // Continuous conversation settings
  enableContinuousConversation: true,  // Allow follow-up messages without @trigger
  sessionTimeout: 3600000,             // 1 hour - session expires after this time of inactivity
  activeSessionsFile: path.join(process.env.HOME, '.quack/whatsapp-active-sessions.json'),

  // Whitelist/Blacklist (empty = allow all)
  allowedChats: [],             // JIDs or chat names
  blockedChats: [],             // JIDs or chat names
  allowedSenders: [],           // Phone numbers or names
  blockedSenders: [],           // Phone numbers or names
};

// Load configuration
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

  // Create default config file if it doesn't exist
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

// Structured logging
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;

  if (level === 'DEBUG' && !VERBOSE) return;

  const logLine = data
    ? `${prefix} ${message} ${JSON.stringify(data)}`
    : `${prefix} ${message}`;

  console.log(logLine);

  // Also write to log file
  try {
    fs.appendFileSync(CONFIG.logFile, logLine + '\n');
  } catch (err) {
    // Silent fail for log file
  }
}

// Ensure .quack directory exists
const quackDir = path.join(process.env.HOME, '.quack');
if (!fs.existsSync(quackDir)) {
  fs.mkdirSync(quackDir, { recursive: true });
}

// Load processed message IDs with stats
function loadProcessedIds() {
  // If --reset flag is passed, start fresh
  if (RESET_PROCESSED) {
    log('INFO', '*** RESET MODE - Starting with empty processed IDs ***');
    // Delete the file if it exists
    try {
      if (fs.existsSync(CONFIG.processedFile)) {
        fs.unlinkSync(CONFIG.processedFile);
        log('INFO', `Deleted ${CONFIG.processedFile}`);
      }
    } catch (err) {
      log('WARN', `Could not delete processed file: ${err.message}`);
    }
    return {
      ids: new Set(),
      stats: { totalProcessed: 0, totalErrors: 0, lastSuccess: null }
    };
  }

  try {
    if (fs.existsSync(CONFIG.processedFile)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.processedFile, 'utf8'));
      log('DEBUG', `Loaded ${(data.processedIds || []).length} processed IDs`);
      return {
        ids: new Set(data.processedIds || []),
        stats: data.stats || { totalProcessed: 0, totalErrors: 0, lastSuccess: null }
      };
    }
  } catch (err) {
    log('WARN', `Error loading processed IDs: ${err.message}`);
  }
  return {
    ids: new Set(),
    stats: { totalProcessed: 0, totalErrors: 0, lastSuccess: null }
  };
}

// Save processed message IDs with stats
function saveProcessedIds(ids, stats) {
  try {
    const data = {
      processedIds: Array.from(ids).slice(-1000), // Keep last 1000 IDs
      stats: stats,
      lastUpdated: new Date().toISOString()
    };
    fs.writeFileSync(CONFIG.processedFile, JSON.stringify(data, null, 2));
  } catch (err) {
    log('WARN', `Error saving processed IDs: ${err.message}`);
  }
}

// Load available agents
function loadAgents() {
  try {
    log('DEBUG', `Loading agents from: ${CONFIG.agentsFile}`);
    if (fs.existsSync(CONFIG.agentsFile)) {
      const raw = fs.readFileSync(CONFIG.agentsFile, 'utf8');
      const data = JSON.parse(raw);
      const agents = data.agents || [];
      log('DEBUG', `Loaded ${agents.length} agents from file`);
      if (VERBOSE && agents.length > 0) {
        agents.forEach(a => log('DEBUG', `  - ${a.name} (${a.projectName}) role: ${a.personality?.role || 'none'}`));
      }
      return agents;
    } else {
      log('WARN', `Agents file not found: ${CONFIG.agentsFile}`);
    }
  } catch (err) {
    log('WARN', `Error loading agents: ${err.message}`);
  }
  return [];
}

// Find agent by name (fuzzy matching with scoring)
function findAgent(agentName, agents) {
  if (!agentName || agents.length === 0) return null;

  const searchName = agentName.toLowerCase().trim();
  let bestMatch = null;
  let bestScore = 0;

  for (const agent of agents) {
    const agentLower = agent.name.toLowerCase();
    let score = 0;

    // Exact match (highest priority)
    if (agentLower === searchName || agentLower === `agent ${searchName}`) {
      return agent;
    }

    // Starts with search term
    if (agentLower.startsWith(searchName) || agentLower.startsWith(`agent ${searchName}`)) {
      score = 90;
    }
    // Contains search term
    else if (agentLower.includes(searchName)) {
      score = 70;
    }
    // Search term is part of agent name words
    else {
      const words = agentLower.split(/[\s_-]+/);
      if (words.some(w => w.startsWith(searchName))) {
        score = 50;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = agent;
    }
  }

  if (bestMatch) {
    log('DEBUG', `Fuzzy matched "${agentName}" to "${bestMatch.name}" (score: ${bestScore})`);
  }

  return bestMatch;
}

// Find agent by role (fuzzy matching)
// Returns the first agent whose role contains the search term
function findAgentByRole(roleSearch, agents) {
  if (!roleSearch || agents.length === 0) return null;

  const searchTerm = roleSearch.toLowerCase().trim();
  let bestMatch = null;
  let bestScore = 0;

  for (const agent of agents) {
    const role = (agent.personality?.role || '').toLowerCase();
    if (!role) continue;

    let score = 0;

    // Exact match
    if (role === searchTerm) {
      return agent;
    }

    // Role contains search term (handles typos like "Comunication" vs "Communication")
    if (role.includes(searchTerm)) {
      score = 90;
    }
    // Search term is part of role words
    else {
      const words = role.split(/[\s_-]+/);
      if (words.some(w => w.startsWith(searchTerm) || w.includes(searchTerm))) {
        score = 70;
      }
    }

    // Also check for common typos/variants
    const normalizedRole = role
      .replace(/comunic/gi, 'communic')  // Italian/typo variant
      .replace(/comunik/gi, 'communic'); // Another variant

    if (normalizedRole.includes(searchTerm)) {
      score = Math.max(score, 85);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = agent;
    }
  }

  if (bestMatch) {
    log('DEBUG', `Role matched "${roleSearch}" to "${bestMatch.name}" with role "${bestMatch.personality?.role}" (score: ${bestScore})`);
  }

  return bestMatch;
}

// Parse trigger from message (supports multiple trigger patterns)
function parseQuackTrigger(content) {
  if (!content) return null;

  // First, check for custom project triggers (e.g., @studio-futuro)
  const customTriggers = CONFIG.customProjectTriggers || {};
  for (const [trigger, config] of Object.entries(customTriggers)) {
    const escapedTrigger = trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Pattern: @project-name <query> (no agent/project suffix needed)
    const customRegex = new RegExp(`${escapedTrigger}\\s+(.+)`, 'is');
    const customMatch = content.match(customRegex);

    if (customMatch) {
      return {
        agentName: null,
        projectName: config.projectName,
        preferredRole: config.preferredRole || null,
        query: customMatch[1].trim(),
        trigger: trigger,
        isCustomTrigger: true
      };
    }
  }

  // Build regex from configured standard patterns
  const patterns = CONFIG.triggerPatterns || [CONFIG.triggerPrefix];
  const escapedPatterns = patterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const patternStr = escapedPatterns.join('|');

  // Pattern: @quack or @duck etc, optionally followed by :agentname@projectname, then query
  // Examples:
  //   @quack ciao                     → agent=null, project=null
  //   @quack:sophie ciao              → agent=sophie, project=null
  //   @quack:sophie@quack-app ciao    → agent=sophie, project=quack-app
  //   @quack@quack-app ciao           → agent=null, project=quack-app
  const regex = new RegExp(`(?:${patternStr})(?::([a-zA-Z0-9_-]+))?(?:@([a-zA-Z0-9_-]+))?\\s+(.+)`, 'is');
  const match = content.match(regex);

  if (match) {
    return {
      agentName: match[1] || null,
      projectName: match[2] || null,
      preferredRole: null,
      query: match[3].trim(),
      trigger: match[0].split(/[\s:@]/)[0], // Which trigger was used
      isCustomTrigger: false
    };
  }

  return null;
}

// Check if chat/sender is allowed
function isAllowed(message) {
  const { chat_jid, sender, chat_name } = message;

  // Check blocked lists first
  if (CONFIG.blockedChats.length > 0) {
    if (CONFIG.blockedChats.some(b =>
      chat_jid.includes(b) || (chat_name && chat_name.toLowerCase().includes(b.toLowerCase()))
    )) {
      log('DEBUG', `Chat blocked: ${chat_jid}`);
      return false;
    }
  }

  if (CONFIG.blockedSenders.length > 0) {
    if (CONFIG.blockedSenders.some(b => sender.includes(b))) {
      log('DEBUG', `Sender blocked: ${sender}`);
      return false;
    }
  }

  // Check allowed lists (if specified, must match)
  if (CONFIG.allowedChats.length > 0) {
    if (!CONFIG.allowedChats.some(a =>
      chat_jid.includes(a) || (chat_name && chat_name.toLowerCase().includes(a.toLowerCase()))
    )) {
      log('DEBUG', `Chat not in allowlist: ${chat_jid}`);
      return false;
    }
  }

  if (CONFIG.allowedSenders.length > 0) {
    if (!CONFIG.allowedSenders.some(a => sender.includes(a))) {
      log('DEBUG', `Sender not in allowlist: ${sender}`);
      return false;
    }
  }

  return true;
}

// Send response via WhatsApp API with retry logic
async function sendWhatsAppResponse(recipient, message, retries = 3) {
  if (DRY_RUN) {
    log('INFO', `[DRY-RUN] Would send to ${recipient}: ${message.substring(0, 100)}...`);
    return { success: true, dryRun: true };
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await sendWhatsAppRequestInternal(recipient, message);
      return result;
    } catch (err) {
      log('WARN', `Send attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * attempt)); // Exponential backoff
      } else {
        throw err;
      }
    }
  }
}

function sendWhatsAppRequestInternal(recipient, message) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      recipient: recipient,
      message: message
    });

    const url = new URL(CONFIG.whatsappApiUrl);

    const options = {
      hostname: url.hostname,
      port: CONFIG.whatsappApiPort,
      path: '/api/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 30000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.success) {
            resolve(result);
          } else {
            reject(new Error(result.message || 'Send failed'));
          }
        } catch (e) {
          reject(new Error(`Invalid response from WhatsApp API: ${body.substring(0, 100)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('WhatsApp API request timeout'));
    });

    req.write(data);
    req.end();
  });
}

// Check if WhatsApp bridge is running
function isWhatsAppBridgeRunning() {
  return new Promise((resolve) => {
    const url = new URL(CONFIG.whatsappApiUrl);

    const req = http.request({
      hostname: url.hostname,
      port: CONFIG.whatsappApiPort,
      path: '/api/send',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      // Even a 405 means the server is running
      resolve(true);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

// Promisified database query
function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// Get conversation context (recent messages in the same chat)
async function getConversationContext(db, chatJid, beforeTimestamp) {
  if (!CONFIG.enableContext) return [];

  try {
    const cutoffTime = new Date(Date.now() - CONFIG.contextTimeWindow).toISOString();

    const query = `
      SELECT content, sender, is_from_me, timestamp
      FROM messages
      WHERE chat_jid = ?
        AND timestamp > ?
        AND timestamp < ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;

    const rows = await dbAll(db, query, [
      chatJid,
      cutoffTime,
      beforeTimestamp,
      CONFIG.contextMessageCount
    ]);

    // Return in chronological order
    return rows.reverse().map(r => ({
      content: r.content,
      sender: r.is_from_me ? 'me' : r.sender,
      timestamp: r.timestamp
    }));
  } catch (err) {
    log('WARN', `Failed to get context: ${err.message}`);
    return [];
  }
}

// Main watcher class
class WhatsAppWatcher {
  constructor() {
    const loaded = loadProcessedIds();
    this.processedIds = loaded.ids;
    this.stats = loaded.stats;
    this.db = null;
    this.running = false;
    this.lastCheck = new Date(Date.now() - 60000); // Start checking from 1 minute ago
    this.pollRetries = 0;
    this.currentPollInterval = CONFIG.pollInterval;
    this.healthCheckInterval = null;
  }

  start() {
    log('INFO', '========================================');
    log('INFO', 'WhatsApp Message Watcher for Quack');
    log('INFO', '========================================');
    log('INFO', `Database: ${CONFIG.messagesDb}`);
    log('INFO', `API: ${CONFIG.whatsappApiUrl}:${CONFIG.whatsappApiPort}`);
    log('INFO', `Poll interval: ${CONFIG.pollInterval}ms`);
    log('INFO', `Standard triggers: ${CONFIG.triggerPatterns.join(', ')}`);
    const customTriggers = Object.keys(CONFIG.customProjectTriggers || {});
    if (customTriggers.length > 0) {
      log('INFO', `Custom triggers: ${customTriggers.join(', ')}`);
    }
    log('INFO', `Default agent: ${CONFIG.defaultAgent}`);
    log('INFO', `Context enabled: ${CONFIG.enableContext}`);
    if (DRY_RUN) log('INFO', '*** DRY RUN MODE - No messages will be sent ***');
    if (ALLOW_OWN_MESSAGES) log('INFO', '*** ALLOW OWN MESSAGES - Will process messages you send ***');
    if (RESET_PROCESSED) log('INFO', '*** RESET MODE - Cleared all processed message IDs ***');
    log('INFO', '----------------------------------------');

    // Check if database exists
    if (!fs.existsSync(CONFIG.messagesDb)) {
      log('ERROR', 'messages.db not found. Is WhatsApp bridge installed?');
      log('ERROR', `Expected path: ${CONFIG.messagesDb}`);
      process.exit(1);
    }

    this.connectDatabase();
  }

  connectDatabase() {
    // Open database (read-only)
    this.db = new sqlite3.Database(CONFIG.messagesDb, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        log('ERROR', `Database connection failed: ${err.message}`);
        // Retry connection after delay
        setTimeout(() => this.connectDatabase(), 5000);
        return;
      }

      log('INFO', 'Database connected successfully');
      this.running = true;
      this.pollRetries = 0;
      this.currentPollInterval = CONFIG.pollInterval;

      // Start health check
      this.startHealthCheck();

      // Start polling
      this.poll();
    });

    // Handle database errors
    this.db?.on('error', (err) => {
      log('ERROR', `Database error: ${err.message}`);
      this.handleDatabaseError();
    });
  }

  handleDatabaseError() {
    if (this.db) {
      try { this.db.close(); } catch (e) { /* ignore */ }
      this.db = null;
    }

    // Exponential backoff for reconnection
    const delay = Math.min(30000, 1000 * Math.pow(2, this.pollRetries));
    this.pollRetries++;

    log('WARN', `Database disconnected. Reconnecting in ${delay / 1000}s...`);
    setTimeout(() => this.connectDatabase(), delay);
  }

  startHealthCheck() {
    // Periodic health check every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      const bridgeRunning = await isWhatsAppBridgeRunning();
      if (!bridgeRunning) {
        log('WARN', 'WhatsApp bridge not responding');
      }
    }, 30000);
  }

  stop() {
    log('INFO', 'Stopping watcher...');
    this.running = false;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.db) {
      this.db.close((err) => {
        if (err) log('WARN', `Error closing database: ${err.message}`);
      });
    }

    saveProcessedIds(this.processedIds, this.stats);
    log('INFO', `Stats: ${this.stats.totalProcessed} processed, ${this.stats.totalErrors} errors`);
    log('INFO', 'Watcher stopped');
  }

  async poll() {
    while (this.running) {
      try {
        await this.checkNewMessages();
        // Reset backoff on successful poll
        this.pollRetries = 0;
        this.currentPollInterval = CONFIG.pollInterval;
      } catch (err) {
        log('ERROR', `Poll error: ${err.message}`);
        this.pollRetries++;

        // Exponential backoff
        if (this.pollRetries >= CONFIG.maxPollRetries) {
          this.currentPollInterval = Math.min(
            60000,
            CONFIG.pollInterval * Math.pow(CONFIG.backoffMultiplier, this.pollRetries - CONFIG.maxPollRetries)
          );
          log('WARN', `Backing off to ${this.currentPollInterval / 1000}s poll interval`);
        }
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, this.currentPollInterval));
    }
  }

  async checkNewMessages() {
    // Build LIKE patterns for all triggers (standard + custom)
    const allTriggers = [
      ...CONFIG.triggerPatterns,
      ...Object.keys(CONFIG.customProjectTriggers || {})
    ];
    const likePatterns = allTriggers.map(p => `m.content LIKE '%${p}%'`).join(' OR ');

    // Build is_from_me filter (can be disabled for testing)
    const fromMeFilter = ALLOW_OWN_MESSAGES ? '' : 'AND m.is_from_me = 0';

    // Get list of chat JIDs with active sessions (for continuous conversation)
    const activeChats = Array.from(activeSessions.keys());
    const hasActiveChats = CONFIG.enableContinuousConversation && activeChats.length > 0;

    // Build WHERE clause: messages with triggers OR messages from chats with active sessions
    let whereClause;
    if (hasActiveChats) {
      const activeChatsStr = activeChats.map(jid => `'${jid.replace(/'/g, "''")}'`).join(',');
      whereClause = `((${likePatterns}) OR m.chat_jid IN (${activeChatsStr}))`;
    } else {
      whereClause = `(${likePatterns})`;
    }

    const query = `
      SELECT
        m.id,
        m.chat_jid,
        m.sender,
        m.content,
        m.timestamp,
        m.is_from_me,
        c.name as chat_name
      FROM messages m
      LEFT JOIN chats c ON m.chat_jid = c.jid
      WHERE ${whereClause}
        ${fromMeFilter}
        AND m.timestamp > ?
      ORDER BY m.timestamp ASC
      LIMIT 20
    `;

    // Format timestamp for SQLite comparison (with local timezone offset)
    const offset = -this.lastCheck.getTimezoneOffset();
    const offsetHours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
    const offsetMins = String(Math.abs(offset) % 60).padStart(2, '0');
    const offsetSign = offset >= 0 ? '+' : '-';

    const lastCheckLocal = this.lastCheck.toISOString()
      .replace('T', ' ')
      .replace('Z', `${offsetSign}${offsetHours}:${offsetMins}`);

    log('DEBUG', `Checking for messages newer than: ${lastCheckLocal}`);
    if (hasActiveChats) {
      log('DEBUG', `Active sessions in ${activeChats.length} chats`);
    }

    const rows = await dbAll(this.db, query, [lastCheckLocal]);

    if (rows.length > 0) {
      log('INFO', `Found ${rows.length} new message(s)`);
    }

    for (const row of rows) {
      // Skip if already processed
      const msgKey = `${row.id}_${row.chat_jid}`;
      if (this.processedIds.has(msgKey)) {
        log('DEBUG', `Skipping already processed: ${msgKey}`);
        continue;
      }

      log('DEBUG', `Processing message: ${row.content?.substring(0, 50)}`);

      // Check whitelist/blacklist
      if (!isAllowed(row)) {
        log('DEBUG', `Message filtered by allowlist: ${msgKey}`);
        this.processedIds.add(msgKey);
        continue;
      }

      // Mark as processed immediately
      this.processedIds.add(msgKey);
      saveProcessedIds(this.processedIds, this.stats);

      // Process the message (trigger or follow-up)
      log('DEBUG', `Processing message for: ${row.content?.substring(0, 50)}`);
      await this.handleMessage(row);
    }

    // Update last check time
    this.lastCheck = new Date();
  }

  /**
   * Handle incoming message - either as new trigger or follow-up to active session
   */
  async handleMessage(message) {
    const chatDisplay = message.chat_name || message.chat_jid.split('@')[0];

    // Check if message has a trigger
    const trigger = parseQuackTrigger(message.content);

    if (trigger) {
      // New trigger always starts a new session
      log('INFO', `New trigger from ${message.sender} in ${chatDisplay}`);
      await this.handleNewTrigger(message, trigger);
    } else if (CONFIG.enableContinuousConversation) {
      // Check if there's an active session for this chat
      const activeSession = getActiveSession(message.chat_jid, CONFIG.sessionTimeout);

      if (activeSession) {
        // Follow-up message to existing session
        log('INFO', `Follow-up from ${message.sender} in ${chatDisplay} (session: ${activeSession.sessionId})`);
        await this.handleFollowUp(message, activeSession);
      } else {
        log('DEBUG', `No active session for chat ${chatDisplay}, ignoring non-trigger message`);
      }
    }
  }

  /**
   * Handle follow-up message to an active session
   * Uses Quack session-based approach: sends message to existing session in Quack
   * Claude in Quack has WhatsApp MCP and will respond directly to WhatsApp
   */
  async handleFollowUp(message, activeSession) {
    const chatDisplay = message.chat_name || message.chat_jid.split('@')[0];

    try {
      // Check if WhatsApp bridge is running (for the thinking indicator)
      const bridgeRunning = await isWhatsAppBridgeRunning();
      if (!bridgeRunning) {
        log('WARN', 'WhatsApp bridge not running, skipping response');
        return;
      }

      // Send "thinking" indicator
      if (CONFIG.thinkingMessage) {
        await sendWhatsAppResponse(
          message.chat_jid,
          `${CONFIG.successEmoji} *${activeSession.agentName}* sta elaborando in Quack...`
        );
      }

      // Update session activity
      touchActiveSession(message.chat_jid);

      // Get conversation context for better responses
      const context = await getConversationContext(
        this.db,
        message.chat_jid,
        message.timestamp
      );

      // Build full prompt with context
      let fullPrompt = message.content;
      if (context && context.length > 0) {
        const contextStr = context.map(m =>
          `[${m.sender === 'me' ? 'You' : m.sender}]: ${m.content}`
        ).join('\n');
        fullPrompt = `**WhatsApp Context:**\n${contextStr}\n\n**Follow-up:**\n${message.content}`;
      }

      // Use existing session or create a new one if session doesn't exist
      if (activeSession.sessionId) {
        // Continue conversation in existing Quack session
        log('INFO', `Continuing chat in Quack session: ${activeSession.sessionId}`);
        await startChatSession(activeSession.sessionId, fullPrompt, message.chat_jid);
      } else {
        // Session ID missing - create a new session
        log('WARN', `No sessionId in activeSession, creating new session`);
        const senderInfo = {
          chatJid: message.chat_jid,
          chatName: message.chat_name,
          sender: message.sender,
          timestamp: message.timestamp,
        };
        const sessionTitle = `WhatsApp: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`;

        // Create agent object for session
        const agent = {
          id: activeSession.agentId,
          name: activeSession.agentName,
        };

        const session = await createKanbanSession(
          agent,
          activeSession.projectPath,
          activeSession.projectName,
          sessionTitle,
          fullPrompt,
          senderInfo
        );

        if (session?.id) {
          // Update active session with new sessionId
          setActiveSession(message.chat_jid, {
            ...activeSession,
            sessionId: session.id,
          });

          await startChatSession(session.id, fullPrompt, message.chat_jid);
        }
      }

      log('INFO', `Follow-up sent to Quack session, Claude will respond via WhatsApp MCP`);
      this.stats.totalProcessed++;
      this.stats.lastSuccess = new Date().toISOString();
      saveProcessedIds(this.processedIds, this.stats);

    } catch (err) {
      log('ERROR', `Error handling follow-up: ${err.message}`);
      this.stats.totalErrors++;
      saveProcessedIds(this.processedIds, this.stats);

      try {
        await sendWhatsAppResponse(
          message.chat_jid,
          `${CONFIG.errorEmoji} Errore: ${err.message.substring(0, 200)}`
        );
      } catch (e) {
        log('ERROR', `Failed to send error message: ${e.message}`);
      }
    }
  }

  /**
   * Handle new trigger - creates a new session
   */
  async handleNewTrigger(message, trigger) {
    const chatDisplay = message.chat_name || message.chat_jid.split('@')[0];
    log('DEBUG', `Content: ${message.content}`);

    // trigger is already passed as parameter, no need to parse again

    log('INFO', `Query: "${trigger.query.substring(0, 50)}${trigger.query.length > 50 ? '...' : ''}"`);
    if (trigger.isCustomTrigger) {
      log('INFO', `Custom trigger: ${trigger.trigger}`);
    }
    if (trigger.agentName) {
      log('INFO', `Target agent: ${trigger.agentName}`);
    }
    if (trigger.preferredRole) {
      log('INFO', `Preferred role: ${trigger.preferredRole}`);
    }
    if (trigger.projectName) {
      log('INFO', `Target project: ${trigger.projectName}`);
    }

    // Check if WhatsApp bridge is running
    const bridgeRunning = await isWhatsAppBridgeRunning();
    if (!bridgeRunning) {
      log('WARN', 'WhatsApp bridge not running, skipping response');
      this.stats.totalErrors++;
      return;
    }

    // Load agents and find the right one
    let agents = loadAgents();

    // Use default project if not specified (but NOT for custom triggers - they already have a project)
    const targetProject = trigger.projectName || (trigger.isCustomTrigger ? null : CONFIG.defaultProject);

    // Filter by project if specified
    if (targetProject) {
      const projectAgents = agents.filter(a =>
        a.projectName && a.projectName.toLowerCase().includes(targetProject.toLowerCase())
      );

      if (projectAgents.length > 0) {
        agents = projectAgents;
        log('DEBUG', `Filtered to ${agents.length} agents for project "${targetProject}"`);
      } else {
        log('WARN', `No agents found for project "${targetProject}"`);
      }
    }

    let agent = null;

    // Priority 1: If agent name is specified, find by name
    if (trigger.agentName) {
      agent = findAgent(trigger.agentName, agents);
      if (agent) {
        log('DEBUG', `Found agent by name: ${agent.name}`);
      }
    }

    // Priority 2: If preferred role is specified (from custom trigger), find by role
    if (!agent && trigger.preferredRole) {
      agent = findAgentByRole(trigger.preferredRole, agents);
      if (agent) {
        log('DEBUG', `Found agent by role "${trigger.preferredRole}": ${agent.name} (${agent.personality?.role})`);
      }
    }

    // Priority 3: Try default agent name
    if (!agent && !trigger.isCustomTrigger) {
      agent = findAgent(CONFIG.defaultAgent, agents);
      if (agent) {
        log('DEBUG', `Found default agent: ${agent.name}`);
      }
    }

    // Priority 4: Fallback to first available agent
    if (!agent && agents.length > 0) {
      agent = agents[0];
      log('WARN', `No matching agent found, falling back to first available: ${agent.name}`);
    }

    if (!agent) {
      log('ERROR', `No agents available`);
      this.stats.totalErrors++;
      try {
        const searchCriteria = trigger.preferredRole
          ? `with role "${trigger.preferredRole}"`
          : `"${trigger.agentName || CONFIG.defaultAgent}"`;
        const agentList = agents.length > 0
          ? agents.map(a => `${a.name} (${a.personality?.role || 'no role'})`).join(', ')
          : 'No agents configured';
        await sendWhatsAppResponse(
          message.chat_jid,
          `${CONFIG.errorEmoji} No agent found ${searchCriteria}.\n\nAvailable: ${agentList}`
        );
      } catch (e) {
        log('ERROR', `Failed to send error message: ${e.message}`);
      }
      return;
    }

    log('INFO', `Using agent: ${agent.name} (${agent.personality?.role || 'no role'}) - ${agent.id}`);

    try {
      // Send "thinking" indicator immediately
      if (CONFIG.thinkingMessage) {
        await sendWhatsAppResponse(
          message.chat_jid,
          `${CONFIG.successEmoji} *${agent.name}* sta elaborando in Quack...`
        );
      }

      // Get conversation context
      const context = await getConversationContext(
        this.db,
        message.chat_jid,
        message.timestamp
      );

      if (context.length > 0) {
        log('DEBUG', `Including ${context.length} messages of context`);
      }

      // Create a title from the query (first 50 chars)
      const sessionTitle = `WhatsApp: ${trigger.query.substring(0, 50)}${trigger.query.length > 50 ? '...' : ''}`;

      // Sender info for tracking
      const senderInfo = {
        chatJid: message.chat_jid,
        chatName: message.chat_name,
        sender: message.sender,
        timestamp: message.timestamp,
      };

      // Build full description with context
      let fullDescription = trigger.query;
      if (context && context.length > 0) {
        const contextStr = context.map(m =>
          `[${m.sender === 'me' ? 'You' : m.sender}]: ${m.content}`
        ).join('\n');
        fullDescription = `**WhatsApp Context:**\n${contextStr}\n\n**Request:**\n${trigger.query}`;
      }

      // STEP 1: Create Quack session via HTTP API
      log('INFO', `Creating Quack session for agent: ${agent.name}`);
      let sessionId = null;
      try {
        const session = await createKanbanSession(
          agent,
          agent.projectPath,
          agent.projectName || targetProject,
          sessionTitle,
          fullDescription,
          senderInfo
        );
        sessionId = session?.id;
        log('INFO', `Quack session created: ${sessionId}`);
      } catch (sessionErr) {
        log('ERROR', `Failed to create Quack session: ${sessionErr.message}`);
        throw new Error(`Could not create Quack session: ${sessionErr.message}`);
      }

      if (!sessionId) {
        throw new Error('Session ID not returned from Quack API');
      }

      // STEP 2: Auto-start the chat in Quack with WhatsApp MCP instruction
      // Claude in Quack has access to WhatsApp MCP and will respond directly
      log('INFO', `Starting chat in Quack with WhatsApp recipient: ${message.chat_jid}`);
      await startChatSession(sessionId, fullDescription, message.chat_jid);

      // Save as active session for this chat (enables continuous conversation)
      setActiveSession(message.chat_jid, {
        sessionId: sessionId,
        agentId: agent.id,
        agentName: agent.name,
        projectPath: agent.projectPath,
        projectName: agent.projectName || targetProject,
        trigger: trigger.trigger || '@quack',
      });

      // Update stats
      this.stats.totalProcessed++;
      this.stats.lastSuccess = new Date().toISOString();
      saveProcessedIds(this.processedIds, this.stats);

      log('INFO', `Chat started in Quack, Claude will respond via WhatsApp MCP to ${message.chat_jid}`);

    } catch (err) {
      log('ERROR', `Error processing: ${err.message}`);
      this.stats.totalErrors++;
      saveProcessedIds(this.processedIds, this.stats);

      try {
        await sendWhatsAppResponse(
          message.chat_jid,
          `${CONFIG.errorEmoji} Error: ${err.message.substring(0, 200)}`
        );
      } catch (e) {
        log('ERROR', `Failed to send error message: ${e.message}`);
      }
    }
  }
}

// Handle help flag
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
WhatsApp Message Watcher for Quack
==================================

Monitors WhatsApp messages for triggers and routes queries to AI agents.

Usage:
  node whatsapp-watcher.cjs [options]

Options:
  --config <path>        Path to config file (default: ~/.quack/whatsapp-watcher.json)
  --verbose              Enable verbose/debug logging
  --dry-run              Don't send responses, just log what would be sent
  --allow-own-messages   Process messages sent by you (for testing)
  --help, -h             Show this help message

Triggers:
  @quack <query>                    Route to default agent on default project
  @quack:sophie <query>             Route to Agent Sophie on default project
  @quack@quack-app <query>          Route to default agent on quack-app project
  @quack:sophie@quack-app <query>   Route to Agent Sophie on quack-app project
  @duck <query>                     Alternative trigger (configurable)

Custom Project Triggers (configured in ~/.quack/whatsapp-watcher.json):
  @studio-futuro <query>            Route to agent with "Communication" role on studio-futuro
                                    (falls back to first agent if no role match)
  @flow-bi <query>                  Route to first available agent on flow-bi

Configuration:
  Config file is auto-created at ~/.quack/whatsapp-watcher.json on first run.
  Edit it to customize triggers, agents, timeouts, and more.

Examples:
  node whatsapp-watcher.cjs                           # Start with default config
  node whatsapp-watcher.cjs --verbose                 # Enable debug logging
  node whatsapp-watcher.cjs --dry-run                 # Test without sending messages
  node whatsapp-watcher.cjs --allow-own-messages      # Process your own messages (testing)
  node whatsapp-watcher.cjs --config my.json          # Use custom config file
`);
  process.exit(0);
}

// Handle shutdown gracefully
const watcher = new WhatsAppWatcher();
let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log('INFO', `Received ${signal}, shutting down gracefully...`);
  watcher.stop();

  // Force exit after 5 seconds if graceful shutdown fails
  setTimeout(() => {
    log('WARN', 'Forced exit after timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (err) => {
  log('ERROR', `Uncaught exception: ${err.message}`);
  log('ERROR', err.stack);
  shutdown('uncaughtException');
});
process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', `Unhandled rejection: ${reason}`);
});

// Start the watcher
watcher.start();
