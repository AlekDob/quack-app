#!/usr/bin/env node

// Brain: fix-session-limit-prompt-cache
// Summarize ~/.quack/cache-investigation.log into per-session cache tables.

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { resolve } from 'path';

const DEFAULT_LOG = resolve(homedir(), '.quack', 'cache-investigation.log');

function printUsage() {
  console.log(`Usage: node scripts/cache-investigation-summary.mjs [options]

Options:
  --file <path>           Override log file path
  --session <id>          Inspect a specific session id (session-...)
  --source <name>         Filter by source: stream-daemon | stream-claude | all
  --list-sessions         List recent sessions only
  --json                  Emit JSON instead of text
  --archive <path>        Write selected raw events to a JSONL file
  --help                  Show this help

Examples:
  npm run cache:investigation
  npm run cache:investigation -- --list-sessions
  npm run cache:investigation -- --session session-123
  npm run cache:investigation -- --source stream-daemon
`);
}

function parseArgs(argv) {
  const options = {
    file: DEFAULT_LOG,
    session: null,
    source: 'all',
    listSessions: false,
    json: false,
    archive: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--file') options.file = resolve(argv[++i]);
    else if (arg === '--session') options.session = argv[++i];
    else if (arg === '--source') options.source = argv[++i];
    else if (arg === '--list-sessions') options.listSessions = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--archive') options.archive = resolve(argv[++i]);
    else if (arg === '--help') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function parseSessionId(queryId = '') {
  const match = queryId.match(/^q_(session-[^_]+)/);
  return match ? match[1] : 'unknown-session';
}

function shortHash(value) {
  if (!value) return '-';
  return String(value).slice(0, 8);
}

function safeReadJsonl(file) {
  const raw = readFileSync(file, 'utf8');
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`Invalid JSON on line ${index + 1}: ${error.message}`);
      }
    });
}

function groupBySession(events, sourceFilter) {
  const sessions = new Map();

  for (const event of events) {
    if (sourceFilter !== 'all' && event.source !== sourceFilter) continue;
    const sessionId = parseSessionId(event.queryId);
    if (!sessions.has(sessionId)) sessions.set(sessionId, []);
    sessions.get(sessionId).push(event);
  }

  return sessions;
}

function buildSessionSummary(sessionId, events) {
  const byQuery = new Map();

  for (const event of events) {
    const key = event.queryId || `${event.source}:${event.ts}`;
    if (!byQuery.has(key)) {
      byQuery.set(key, {
        queryId: key,
        source: event.source,
        ts: event.ts,
        context: null,
        usageAssistant: null,
        usageResult: null,
      });
    }

    const entry = byQuery.get(key);
    if (event.tag === 'CONTEXT') entry.context = event;
    if (event.tag === 'USAGE' && event.eventType === 'assistant') entry.usageAssistant = event;
    if (event.tag === 'USAGE' && event.eventType === 'result') entry.usageResult = event;
  }

  const queries = [...byQuery.values()].sort((a, b) => new Date(a.ts) - new Date(b.ts));
  const rows = queries.map((query, index) => {
    const usage = query.usageResult || query.usageAssistant;
    const context = query.context || {};
    const payloadHashes = context.payloadHashes || {};
    return {
      turn: index + 1,
      ts: query.ts,
      queryId: query.queryId,
      source: query.source,
      resume: Boolean(context.resume),
      promptHash: shortHash(context.prompt?.hash),
      ideHash: shortHash(context.ideContext?.hash),
      systemHash: shortHash(context.systemPromptAppend?.hash),
      instructionHash: shortHash(payloadHashes.instructionFilesComposite),
      allowedToolsHash: shortHash(payloadHashes.allowedTools),
      mcpHash: shortHash(payloadHashes.mcpServers),
      investigationHash: shortHash(payloadHashes.investigation),
      investigationMode: context.investigation?.mode || 'baseline',
      mcpCount: context.mcpServers?.count ?? 0,
      cacheReadTokens: usage?.cacheReadTokens ?? null,
      cacheCreationTokens: usage?.cacheCreationTokens ?? null,
      effectiveContextFill: usage?.effectiveContextFill ?? null,
      contextWindow: usage?.contextWindow ?? null,
      contextUtilizationPct: usage?.contextUtilizationPct ?? null,
    };
  });

  const stability = {
    promptHash: new Set(rows.map(r => r.promptHash)).size === 1,
    ideHash: new Set(rows.map(r => r.ideHash)).size === 1,
    systemHash: new Set(rows.map(r => r.systemHash)).size === 1,
    instructionHash: new Set(rows.map(r => r.instructionHash)).size === 1,
    allowedToolsHash: new Set(rows.map(r => r.allowedToolsHash)).size === 1,
    mcpHash: new Set(rows.map(r => r.mcpHash)).size === 1,
    investigationHash: new Set(rows.map(r => r.investigationHash)).size === 1,
  };

  return {
    sessionId,
    rowCount: rows.length,
    startedAt: rows[0]?.ts ?? null,
    endedAt: rows.at(-1)?.ts ?? null,
    stability,
    rows,
  };
}

function formatNumber(value) {
  if (value === null || value === undefined) return '-';
  return typeof value === 'number' ? value.toLocaleString() : String(value);
}

function printSessionList(sessionSummaries) {
  for (const session of sessionSummaries) {
    const first = session.rows[0];
    const last = session.rows.at(-1);
    console.log(
      `${session.sessionId}  turns=${session.rowCount}  ` +
      `source=${first?.source || '-'}  ` +
      `last=${last?.ts || '-'}`
    );
  }
}

function printSessionSummary(summary) {
  console.log(`Session: ${summary.sessionId}`);
  console.log(`Turns: ${summary.rowCount}`);
  console.log(`Range: ${summary.startedAt || '-'} -> ${summary.endedAt || '-'}`);
  console.log(
    `Stability: prompt=${summary.stability.promptHash} ` +
    `ide=${summary.stability.ideHash} ` +
    `system=${summary.stability.systemHash} ` +
    `instr=${summary.stability.instructionHash} ` +
    `tools=${summary.stability.allowedToolsHash} ` +
    `mcp=${summary.stability.mcpHash} ` +
    `investigation=${summary.stability.investigationHash}`
  );
  console.log('');
  console.log([
    'Turn'.padEnd(4),
    'Src'.padEnd(13),
    'Resume'.padEnd(6),
    'Mode'.padEnd(18),
    'Prompt'.padEnd(8),
    'IDE'.padEnd(8),
    'System'.padEnd(8),
    'Tools'.padEnd(8),
    'MCP'.padEnd(8),
    'Read'.padStart(8),
    'Create'.padStart(8),
    'Fill'.padStart(8),
    'CtxWin'.padStart(8),
  ].join(' '));

  for (const row of summary.rows) {
    console.log([
      String(row.turn).padEnd(4),
      String(row.source || '-').padEnd(13),
      String(row.resume).padEnd(6),
      String(row.investigationMode).padEnd(18),
      row.promptHash.padEnd(8),
      row.ideHash.padEnd(8),
      row.systemHash.padEnd(8),
      row.allowedToolsHash.padEnd(8),
      row.mcpHash.padEnd(8),
      formatNumber(row.cacheReadTokens).padStart(8),
      formatNumber(row.cacheCreationTokens).padStart(8),
      formatNumber(row.effectiveContextFill).padStart(8),
      formatNumber(row.contextWindow).padStart(8),
    ].join(' '));
  }
}

function archiveEvents(events, archivePath) {
  const content = events.map(event => JSON.stringify(event)).join('\n') + '\n';
  writeFileSync(archivePath, content, 'utf8');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  if (!existsSync(options.file)) {
    console.error(`Cache investigation log not found: ${options.file}`);
    console.error('Run Quack and send at least one SDK-backed message to generate it.');
    process.exit(1);
  }

  const events = safeReadJsonl(options.file);
  const sessions = groupBySession(events, options.source);
  const sessionSummaries = [...sessions.entries()]
    .map(([sessionId, sessionEvents]) => buildSessionSummary(sessionId, sessionEvents))
    .sort((a, b) => new Date(b.endedAt || 0) - new Date(a.endedAt || 0));

  if (sessionSummaries.length === 0) {
    console.error('No matching sessions found in the log.');
    process.exit(1);
  }

  if (options.listSessions) {
    if (options.json) console.log(JSON.stringify(sessionSummaries, null, 2));
    else printSessionList(sessionSummaries);
    return;
  }

  const summary = options.session
    ? sessionSummaries.find(session => session.sessionId === options.session)
    : sessionSummaries[0];

  if (!summary) {
    console.error(`Session not found: ${options.session}`);
    process.exit(1);
  }

  if (options.archive) {
    const selectedEvents = sessions.get(summary.sessionId) || [];
    archiveEvents(selectedEvents, options.archive);
  }

  if (options.json) console.log(JSON.stringify(summary, null, 2));
  else printSessionSummary(summary);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
