#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-https://api.botflow.ink}"

echo "==> Backend health: $API_URL/health"
BACKEND="$(curl -fsS "$API_URL/health")"
echo "$BACKEND" | python3 -m json.tool 2>/dev/null || echo "$BACKEND"

BUILD="$(echo "$BACKEND" | python3 -c "import sys,json; print(json.load(sys.stdin).get('buildCommit',''))" 2>/dev/null || true)"
WHATSAPP_READY="$(echo "$BACKEND" | python3 -c "import sys,json; print(json.load(sys.stdin).get('whatsappReady'))" 2>/dev/null || true)"
EVOLUTION_URL="$(echo "$BACKEND" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('config',{}).get('evolution',{}).get('apiUrl'))" 2>/dev/null || true)"
HAS_META="$(echo "$BACKEND" | python3 -c "import sys,json; d=json.load(sys.stdin); print('meta' in d.get('config',{}))" 2>/dev/null || true)"

if [ "$BUILD" = "v1.0.0-mr84xgy9" ] || [ "$BUILD" = "unknown" ]; then
  echo "FAIL: backend still on old image ($BUILD) — redeploy EasyPanel backend from main"
else
  echo "OK: backend buildCommit=$BUILD"
fi

if [ "$WHATSAPP_READY" != "True" ] && [ "$WHATSAPP_READY" != "true" ]; then
  echo "FAIL: whatsappReady=false — set EVOLUTION_API_URL and EVOLUTION_API_KEY in EasyPanel"
else
  echo "OK: whatsappReady=true (Evolution API configured)"
fi

if [ "$EVOLUTION_URL" != "True" ] && [ "$EVOLUTION_URL" != "true" ]; then
  echo "WARN: config.evolution.apiUrl=false"
else
  echo "OK: Evolution API URL configured"
fi

if [ "$HAS_META" = "True" ] || [ "$HAS_META" = "true" ]; then
  echo "FAIL: /health still exposes Meta config — old Meta backend image is running"
else
  echo "OK: no Meta fields in /health (Evolution-only backend)"
fi

echo ""
echo "==> WhatsApp connect route (expect 401 without JWT, NOT 404)"
CONNECT_CODE="$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/api/channels/whatsapp/connect")"
echo "POST /api/channels/whatsapp/connect → HTTP $CONNECT_CODE"

if [ "$CONNECT_CODE" = "404" ]; then
  echo "FAIL: /connect returns 404 — production still on OLD backend image"
  echo "     Fix: EasyPanel → backend → Docker Compose → pull ghcr.io/sass-botflow/backend:latest → Deploy"
  echo "     Error in frontend: 'Cannot POST /api/channels/whatsapp/connect'"
elif [ "$CONNECT_CODE" = "401" ]; then
  echo "OK: connect route exists (401 = JWT required)"
else
  echo "WARN: unexpected HTTP $CONNECT_CODE for /connect"
fi
