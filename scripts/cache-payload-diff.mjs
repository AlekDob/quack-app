#!/usr/bin/env node

// Brain: bug-post-fix-cache-breakage-investigation
// Compare consecutive captured /v1/messages API payloads to quantify
// historical message mutations between resumed turns.

import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

const DEBUG_DIR = resolve(homedir(), '.quack', 'cache-debug');
const SESSION_PREFIX = 'q_session-1773999614211-782jy1t_';

// ── Load and sort payloads ──────────────────────────────────────────

const files = readdirSync(DEBUG_DIR)
  .filter(f => f.startsWith(SESSION_PREFIX) && f.endsWith('.cli-api-request.01.json'))
  .sort()
  .map(f => resolve(DEBUG_DIR, f));

if (files.length < 2) {
  console.error('Need at least 2 captured payloads. Found:', files.length);
  process.exit(1);
}

console.log(`Found ${files.length} captured payloads\n`);

const payloads = files.map((f, i) => {
  const data = JSON.parse(readFileSync(f, 'utf8'));
  console.log(`Turn ${i}: ${data.body.messages.length} messages  (${f.split('/').pop()})`);
  return data;
});

console.log('');

// ── Helpers ─────────────────────────────────────────────────────────

function estimateTokens(str) {
  // rough heuristic: ~4 chars per token for English/code
  return Math.ceil(str.length / 4);
}

function serializeMessage(msg) {
  return JSON.stringify(msg);
}

function describeDiff(msgA, msgB, index) {
  const diffs = [];
  const contentA = Array.isArray(msgA.content) ? msgA.content : [{ type: 'text', text: msgA.content }];
  const contentB = Array.isArray(msgB.content) ? msgB.content : [{ type: 'text', text: msgB.content }];

  if (contentA.length !== contentB.length) {
    diffs.push(`content blocks: ${contentA.length} → ${contentB.length}`);
  }

  // Check for TodoWrite reminder removal
  const hasTodoA = contentA.some(b => b.text?.includes('TodoWrite'));
  const hasTodoB = contentB.some(b => b.text?.includes('TodoWrite'));
  if (hasTodoA && !hasTodoB) diffs.push('TodoWrite reminder REMOVED');
  if (!hasTodoA && hasTodoB) diffs.push('TodoWrite reminder ADDED');

  // Check for cache_control removal
  const hasCacheA = contentA.some(b => b.cache_control);
  const hasCacheB = contentB.some(b => b.cache_control);
  if (hasCacheA && !hasCacheB) diffs.push('cache_control REMOVED');
  if (!hasCacheA && hasCacheB) diffs.push('cache_control ADDED');

  // Check for text content changes (ignoring TodoWrite block)
  const textsA = contentA.filter(b => !b.text?.includes('TodoWrite')).map(b => b.text || '');
  const textsB = contentB.filter(b => !b.text?.includes('TodoWrite')).map(b => b.text || '');
  const textChanged = JSON.stringify(textsA) !== JSON.stringify(textsB);
  if (textChanged) diffs.push('text content CHANGED');

  // Estimate the byte cost of the mutation
  const serialA = serializeMessage(msgA);
  const serialB = serializeMessage(msgB);
  const byteDiff = Math.abs(serialA.length - serialB.length);

  return { index, role: msgA.role, diffs, byteDiff, serialA, serialB };
}

// ── Compare system, tools, and metadata ─────────────────────────────

function compareTopLevel(a, b, turnLabel) {
  const systemA = JSON.stringify(a.body.system);
  const systemB = JSON.stringify(b.body.system);
  const toolsA = JSON.stringify(a.body.tools);
  const toolsB = JSON.stringify(b.body.tools);
  const metaA = JSON.stringify(a.body.metadata);
  const metaB = JSON.stringify(b.body.metadata);

  const results = [];
  if (systemA !== systemB) results.push('body.system CHANGED');
  if (toolsA !== toolsB) results.push('body.tools CHANGED');
  if (metaA !== metaB) results.push('body.metadata CHANGED');
  return results;
}

// ── Main comparison ─────────────────────────────────────────────────

const summaryRows = [];

for (let t = 0; t < payloads.length - 1; t++) {
  const prev = payloads[t];
  const curr = payloads[t + 1];
  const prevMsgs = prev.body.messages;
  const currMsgs = curr.body.messages;

  const turnLabel = `Turn ${t} → ${t + 1}`;
  console.log(`═══ ${turnLabel} ═══`);
  console.log(`  Previous: ${prevMsgs.length} messages`);
  console.log(`  Current:  ${currMsgs.length} messages`);

  // Top-level comparison
  const topDiffs = compareTopLevel(prev, curr, turnLabel);
  if (topDiffs.length > 0) {
    console.log(`  Top-level diffs: ${topDiffs.join(', ')}`);
  } else {
    console.log(`  Top-level (system/tools/metadata): IDENTICAL`);
  }

  // Strip the last 2 messages from current (the new user + assistant pair)
  const historyFromCurr = currMsgs.slice(0, currMsgs.length - 2);
  const historyFromPrev = prevMsgs;

  if (historyFromCurr.length !== historyFromPrev.length) {
    console.log(`  ⚠ History length mismatch: prev=${historyFromPrev.length}, curr_history=${historyFromCurr.length}`);
  }

  const compareLen = Math.min(historyFromCurr.length, historyFromPrev.length);
  let mutatedCount = 0;
  let totalByteDiff = 0;
  let firstMutatedIndex = -1;
  const mutations = [];

  for (let i = 0; i < compareLen; i++) {
    const serialPrev = serializeMessage(historyFromPrev[i]);
    const serialCurr = serializeMessage(historyFromCurr[i]);
    if (serialPrev !== serialCurr) {
      mutatedCount++;
      if (firstMutatedIndex === -1) firstMutatedIndex = i;
      const detail = describeDiff(historyFromPrev[i], historyFromCurr[i], i);
      mutations.push(detail);
      totalByteDiff += Math.max(detail.serialA.length, detail.serialB.length);
    }
  }

  console.log(`  Historical messages compared: ${compareLen}`);
  console.log(`  Mutated messages: ${mutatedCount}`);
  if (firstMutatedIndex >= 0) {
    console.log(`  First mutation at index: ${firstMutatedIndex}`);
  }

  // Compute the prefix break point: how many messages from the start are byte-identical?
  let prefixMatchCount = 0;
  for (let i = 0; i < compareLen; i++) {
    if (serializeMessage(historyFromPrev[i]) === serializeMessage(historyFromCurr[i])) {
      prefixMatchCount++;
    } else {
      break;
    }
  }

  // Estimate: everything after the first mutation is a potential cache miss
  const stablePrefix = historyFromPrev.slice(0, prefixMatchCount);
  const unstableHistory = historyFromPrev.slice(prefixMatchCount);
  const stablePrefixChars = stablePrefix.reduce((s, m) => s + serializeMessage(m).length, 0);
  const unstableHistoryChars = unstableHistory.reduce((s, m) => s + serializeMessage(m).length, 0);
  const stablePrefixTokens = estimateTokens(stablePrefixChars.toString().length > 0 ? stablePrefix.map(m => serializeMessage(m)).join('') : '');
  const unstableHistoryTokens = estimateTokens(unstableHistory.map(m => serializeMessage(m)).join(''));

  // Also estimate system + tools prefix
  const systemTokens = estimateTokens(JSON.stringify(prev.body.system));
  const toolsTokens = estimateTokens(JSON.stringify(prev.body.tools));

  console.log(`  Stable message prefix: ${prefixMatchCount} messages (~${stablePrefixTokens.toLocaleString()} est. tokens)`);
  console.log(`  Unstable history tail: ${compareLen - prefixMatchCount} messages (~${unstableHistoryTokens.toLocaleString()} est. tokens)`);
  console.log(`  System prompt: ~${systemTokens.toLocaleString()} est. tokens`);
  console.log(`  Tools: ~${toolsTokens.toLocaleString()} est. tokens`);

  for (const m of mutations) {
    console.log(`\n  Mutation at msg[${m.index}] (${m.role}):`);
    for (const d of m.diffs) {
      console.log(`    - ${d}`);
    }
    console.log(`    byte diff: ${m.byteDiff} bytes (~${estimateTokens(m.byteDiff.toString()).toLocaleString()} est. token overhead)`);
  }

  summaryRows.push({
    turn: turnLabel,
    mutatedMessages: mutatedCount,
    prefixMatchMessages: prefixMatchCount,
    stablePrefixTokens,
    unstableHistoryTokens,
    systemTokens,
    toolsTokens,
  });

  console.log('');
}

// ── Summary table ───────────────────────────────────────────────────

console.log('═══ Summary ═══\n');
console.log('| Transition | Mutated msgs | Stable prefix msgs | Stable prefix tokens | Unstable tail tokens | System tokens | Tools tokens |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
for (const r of summaryRows) {
  console.log(`| ${r.turn} | ${r.mutatedMessages} | ${r.prefixMatchMessages} | ~${r.stablePrefixTokens.toLocaleString()} | ~${r.unstableHistoryTokens.toLocaleString()} | ~${r.systemTokens.toLocaleString()} | ~${r.toolsTokens.toLocaleString()} |`);
}

console.log('\n═══ Cache implication ═══\n');
console.log('The API prefix cache requires byte-identical content from the start of the request.');
console.log('When the first mutation appears at message index N, everything from N onward');
console.log('must be re-cached, even if only 1 message changed.');
console.log('');
console.log('The "unstable tail tokens" column estimates the content that must be re-cached');
console.log('due to the prefix break, regardless of how small the actual mutation is.');
console.log('Compare this against observed cacheCreationTokens from the investigation log.');
