#!/usr/bin/env node
/** Cold-boot spike: fresh opencode serve on PORT. */
import { spawn } from "node:child_process";
import { createOpencodeClient } from "@opencode-ai/sdk/client";

const PORT = Number(process.env.PORT ?? 17346);
const BASE = `http://127.0.0.1:${PORT}`;
const DIR = "/Users/alekdob/Desktop/Dev/Personal/codetta";

async function waitHealth(maxMs = 60_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    try {
      const r = await fetch(`${BASE}/global/health`);
      if (r.ok) return Date.now() - t0;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("serve never became healthy");
}

const serve = spawn("opencode", ["serve", "--port", String(PORT), "--hostname", "127.0.0.1"], {
  stdio: "ignore",
  detached: false,
});

try {
  const bootMs = await waitHealth();
  console.log(`cold boot healthy: ${bootMs}ms`);

  const client = createOpencodeClient({ baseUrl: BASE });
  const t0 = Date.now();
  const s = await client.session.create({
    query: { directory: DIR },
    body: { title: "cold-spike" },
  });
  const sub = await client.global.event();
  const pt = Date.now();
  await client.session.promptAsync({
    path: { id: s.data.id },
    query: { directory: DIR },
    body: {
      model: { providerID: "opencode", modelID: "deepseek-v4-flash-free" },
      parts: [{ type: "text", text: "Reply exactly: COLD_OK" }],
    },
  });
  console.log(`promptAsync: ${Date.now() - pt}ms`);

  let text = "";
  for await (const raw of sub.stream) {
    const ev = raw?.payload ?? raw;
    if (ev?.sessionID && ev.sessionID !== s.data.id) continue;
    if (ev?.type === "message.part.updated") {
      const p = ev.properties?.part ?? ev.part;
      if (p?.type === "text") text = p.text ?? "";
    }
    if (ev?.type === "session.idle" && ev.sessionID === s.data.id) break;
  }
  console.log("text:", JSON.stringify(text.trim()));
  console.log(`total: ${Date.now() - t0}ms`);
  const ok = text.trim().includes("COLD_OK");
  console.log(ok ? "✅ COLD SPIKE PASSED" : "❌ COLD SPIKE FAILED");
  process.exitCode = ok ? 0 : 1;
} finally {
  serve.kill("SIGTERM");
}
