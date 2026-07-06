#!/usr/bin/env node
/**
 * Audit Quack chat persistence: open tabs vs localStorage transcripts.
 * Usage: node scripts/audit-chat-persistence.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const HOME = os.homedir();
const WS_ROOT = path.join(HOME, "Library/Application Support/codetta");
const DB_GLOB =
  "Library/WebKit/dev.getcodetta.app/WebsiteData/Default/*/LocalStorage/localstorage.sqlite3";

function findDb() {
  const base = path.join(HOME, "Library/WebKit/dev.getcodetta.app/WebsiteData/Default");
  if (!fs.existsSync(base)) return null;
  for (const d of fs.readdirSync(base)) {
    const p = path.join(
      base,
      d,
      d,
      "LocalStorage",
      "localstorage.sqlite3",
    );
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function decodeLsValue(raw) {
  if (typeof raw === "string") return JSON.parse(raw);
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
  const text = buf.toString("utf16le").replace(/\0/g, "");
  return JSON.parse(text);
}

function loadHistory(db, wsId) {
  const legacy = db
    .prepare("SELECT value FROM ItemTable WHERE key = ?")
    .get(`lcp.ollama.history.${wsId}`);
  if (legacy) return decodeLsValue(legacy.value);

  const idx = db
    .prepare("SELECT value FROM ItemTable WHERE key = ?")
    .get(`lcp.ollama.history.${wsId}.__idx__`);
  if (!idx) return [];
  const { ids } = decodeLsValue(idx.value);
  const sessions = [];
  for (const id of ids) {
    const s = db
      .prepare("SELECT value FROM ItemTable WHERE key = ?")
      .get(`lcp.ollama.history.${wsId}.s.${id}`);
    if (s) sessions.push(decodeLsValue(s.value));
  }
  return sessions;
}

function main() {
  const dbPath = findDb();
  if (!dbPath) {
    console.error("Quack localStorage DB not found.");
    process.exit(1);
  }
  const wal = dbPath + "-wal";
  const dbStat = fs.statSync(dbPath);
  console.log(`DB: ${dbPath} (${(dbStat.size / 1e6).toFixed(1)} MB)`);
  if (fs.existsSync(wal)) {
    console.log(`WAL: ${wal} (${(fs.statSync(wal).size / 1e9).toFixed(2)} GB)`);
  }

  const db = new DatabaseSync(dbPath, { readOnly: true });
  const idxPath = path.join(WS_ROOT, "workspaces.json");
  if (!fs.existsSync(idxPath)) {
    console.error("workspaces.json not found.");
    process.exit(1);
  }
  const { recent } = JSON.parse(fs.readFileSync(idxPath, "utf8"));
  let issues = 0;

  for (const ws of recent) {
    const statePath = path.join(WS_ROOT, "workspaces", ws.id, "state.json");
    if (!fs.existsSync(statePath)) continue;
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    const chats = state.aiChats ?? {};
    const history = loadHistory(db, ws.id);
    const byId = Object.fromEntries(history.map((s) => [s.id, s]));

    console.log(`\n## ${ws.name} (${history.length} transcripts, ${Object.keys(chats).length} tabs)`);
    for (const desc of Object.values(chats)) {
      const row = byId[desc.sessionId ?? desc.id];
      if (!row) {
        console.log(`  MISSING  ${desc.title}`);
        issues++;
      } else if (!row.messages?.length) {
        console.log(`  EMPTY    ${desc.title}`);
        issues++;
      } else {
        console.log(`  OK       ${desc.title} (${row.messages.length} msgs)`);
      }
    }
  }
  console.log(`\n${issues ? `${issues} issue(s)` : "All open tabs have transcripts."}`);
}

main();
