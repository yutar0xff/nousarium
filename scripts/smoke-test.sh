#!/usr/bin/env bash
set -euo pipefail

BASE="${NOUSARIUM_SMOKE_URL:-http://127.0.0.1:13000/api/backend}"

echo "==> login"
TOKEN=$(curl -sf -X POST "$BASE/login" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
AUTH=(-H "Authorization: Bearer $TOKEN")

echo "==> create conversation"
CONV=$(curl -sf -X POST "$BASE/conversations" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"intent":"question","model":"auto","mode":"plan","accessPolicy":"read"}')
ID=$(echo "$CONV" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')

echo "==> send message (SSE)"
SSE=$(curl -sfN -X POST "$BASE/conversations/$ID/messages" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"content":"スモークテスト: 1+1は？"}')
echo "$SSE" | grep -q 'run.finished'
echo "$SSE" | grep -q 'assistant.delta'

echo "==> load conversation"
LOAD=$(curl -sf "$BASE/conversations/$ID" "${AUTH[@]}")
echo "$LOAD" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert any(m["role"]=="assistant" for m in d["messages"])'

echo "==> list runs"
RUNS=$(curl -sf "$BASE/runs" "${AUTH[@]}")
echo "$RUNS" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert len(d) >= 1'

echo "OK smoke test passed (conversation $ID)"
