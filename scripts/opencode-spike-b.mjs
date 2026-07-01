#!/usr/bin/env node
/**
 * Path B spike: opencode serve + SDK client (promptAsync + SSE).
 * Run: node scripts/opencode-spike-b.mjs [baseUrl]
 */
import { createOpencodeClient } from "@opencode-ai/sdk/client";

const BASE = process.argv[2] ?? "http://127.0.0.1:17345";
const DIR = "/Users/alekdob/Desktop/Dev/Personal/codetta";
const MODEL = { providerID: "opencode", modelID: "deepseek-v4-flash-free" };

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function collectSseEvents(client, sessionId, maxMs = 30_000) {
  const events = [];
  const deltas = [];
  const sub = await client.global.event();
  const deadline = Date.now() + maxMs;

  for await (const raw of sub.stream) {
    if (Date.now() > deadline) break;
    const ev = raw?.payload ?? raw;
    if (!ev?.type) continue;
    if (ev.sessionID && ev.sessionID !== sessionId) continue;
    events.push(ev.type);
    if (ev.type === "message.part.updated") {
      const part = ev.properties?.part ?? ev.part;
      if (part?.type === "text" && part.text) deltas.push(part.text.length);
    }
    if (ev.type === "session.idle" && ev.sessionID === sessionId) break;
  }

  return { events, deltas };
}

async function main() {
  const client = createOpencodeClient({ baseUrl: BASE });
  const t0 = Date.now();

  const health = await fetch(`${BASE}/global/health`).then((r) => r.json());
  console.log("1. health:", health);

  const prov = await client.provider.list();
  const connected = prov.data?.connected?.length ?? 0;
  const all = prov.data?.all?.length ?? 0;
  console.log(`2. providers: ${connected} connected / ${all} total`);

  const created = await client.session.create({
    query: { directory: DIR },
    body: { title: "quack-spike-b" },
  });
  const sessionId = created.data.id;
  console.log("3. session:", sessionId);

  const ssePromise = collectSseEvents(client, sessionId);
  const tPrompt = Date.now();
  await client.session.promptAsync({
    path: { id: sessionId },
    query: { directory: DIR },
    body: {
      model: MODEL,
      parts: [{ type: "text", text: "Reply with exactly: SPIKE_B_OK" }],
    },
  });
  console.log(`4. promptAsync: ${Date.now() - tPrompt}ms (expect ~instant)`);

  const { events, deltas } = await ssePromise;
  const eventTypes = [...new Set(events)];
  console.log("5. SSE event types:", eventTypes.join(", "));
  console.log("6. text delta count:", deltas.length, "lengths:", deltas.slice(0, 8));

  const msgs = await client.session.messages({
    path: { id: sessionId },
    query: { directory: DIR },
  });
  const last = msgs.data?.at(-1);
  const text =
    last?.parts
      ?.filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("") ?? "";
  console.log("7. assistant text:", JSON.stringify(text.trim()));

  // Resume: second turn on same session
  const sse2 = collectSseEvents(client, sessionId);
  await client.session.promptAsync({
    path: { id: sessionId },
    query: { directory: DIR },
    body: {
      model: MODEL,
      parts: [{ type: "text", text: "What was my exact previous message?" }],
    },
  });
  await sse2;
  const msgs2 = await client.session.messages({
    path: { id: sessionId },
    query: { directory: DIR },
  });
  const last2 = msgs2.data?.at(-1);
  const text2 =
    last2?.parts
      ?.filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("") ?? "";
  console.log("8. resume turn:", JSON.stringify(text2.trim().slice(0, 120)));

  // Abort spike: long prompt + abort mid-flight
  const sse3 = collectSseEvents(client, sessionId, 15_000);
  await client.session.promptAsync({
    path: { id: sessionId },
    query: { directory: DIR },
    body: {
      model: MODEL,
      parts: [{ type: "text", text: "Write a 500 word essay about ducks." }],
    },
  });
  await sleep(1500);
  const tAbort = Date.now();
  await client.session.abort({ path: { id: sessionId }, query: { directory: DIR } });
  console.log(`9. abort called after ~1.5s`);
  try {
    await sse3;
  } catch {
    /* timeout ok */
  }
  console.log(`10. total spike: ${Date.now() - t0}ms`);

  const ok = text.trim().includes("SPIKE_B_OK");
  console.log(ok ? "\n✅ SPIKE B PASSED" : "\n❌ SPIKE B FAILED");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("SPIKE B ERROR:", e);
  process.exit(1);
});
