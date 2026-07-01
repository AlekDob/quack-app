#!/bin/bash
set -euo pipefail
PORT=17347
DIR_ENC=$(python3 -c 'import urllib.parse;print(urllib.parse.quote("/Users/alekdob/Desktop/Dev/Personal/codetta"))')
opencode serve --port "$PORT" --hostname 127.0.0.1 >/tmp/oc347.log 2>&1 &
SP=$!
trap 'kill $SP 2>/dev/null || true' EXIT

for i in $(seq 1 120); do
  if curl -sf "http://127.0.0.1:$PORT/global/health" >/dev/null; then
    echo "cold boot healthy: ~$((i/2))s"
    break
  fi
  sleep 0.5
done

SID=$(curl -s -X POST "http://127.0.0.1:$PORT/session?directory=$DIR_ENC" \
  -H 'Content-Type: application/json' -d '{"title":"cold-poll"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
echo "session: $SID"

CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  "http://127.0.0.1:$PORT/session/$SID/prompt_async?directory=$DIR_ENC" \
  -H 'Content-Type: application/json' \
  -d '{"model":{"providerID":"opencode","modelID":"deepseek-v4-flash-free"},"parts":[{"type":"text","text":"Reply exactly: COLD_POLL_OK"}]}')
echo "prompt_async: HTTP $CODE"

for j in $(seq 1 30); do
  TXT=$(curl -s "http://127.0.0.1:$PORT/session/$SID/message?directory=$DIR_ENC" \
    | python3 -c 'import sys,json;d=json.load(sys.stdin);a=d[-1] if d else {};print("".join(p.get("text","") for p in a.get("parts",[]) if p.get("type")=="text"))')
  if echo "$TXT" | grep -q COLD_POLL_OK; then
    echo "assistant: $TXT"
    echo "✅ COLD POLL SPIKE PASSED (poll ${j}s)"
    exit 0
  fi
  sleep 1
done
echo "❌ COLD POLL SPIKE FAILED"
exit 1
