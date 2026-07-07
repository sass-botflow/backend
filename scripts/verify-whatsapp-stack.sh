#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-https://api.botflow.ink}"
FRONTEND_URL="${FRONTEND_URL:-https://www.botflow.ink}"

echo "==> Backend health: $API_URL/health"
BACKEND="$(curl -fsS "$API_URL/health")"
echo "$BACKEND" | python3 -m json.tool 2>/dev/null || echo "$BACKEND"

BUILD="$(echo "$BACKEND" | python3 -c "import sys,json; print(json.load(sys.stdin).get('buildCommit',''))" 2>/dev/null || true)"
WHATSAPP_MODULE="$(echo "$BACKEND" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('modules',{}).get('whatsapp'))" 2>/dev/null || true)"
WHATSAPP_READY="$(echo "$BACKEND" | python3 -c "import sys,json; print(json.load(sys.stdin).get('whatsappReady'))" 2>/dev/null || true)"

if [ "$BUILD" = "v1.0.0-mr84xgy9" ] || [ "$BUILD" = "unknown" ]; then
  echo "FAIL: backend still on old image ($BUILD) — redeploy EasyPanel backend from main"
else
  echo "OK: backend buildCommit=$BUILD"
fi

if [ "$WHATSAPP_MODULE" != "True" ] && [ "$WHATSAPP_MODULE" != "true" ]; then
  echo "FAIL: modules.whatsapp missing — redeploy backend from main"
else
  echo "OK: modules.whatsapp=true"
fi

if [ "$WHATSAPP_READY" != "True" ] && [ "$WHATSAPP_READY" != "true" ]; then
  echo "WARN: whatsappReady=false — set META_APP_ID, META_APP_SECRET, META_EMBEDDED_SIGNUP_CONFIG_ID, TOKEN_ENCRYPTION_KEY"
else
  echo "OK: whatsappReady=true"
fi

echo ""
echo "==> WhatsApp webhook verify route: $API_URL/api/channels/whatsapp/webhook"
curl -fsS -o /dev/null -w "GET webhook → HTTP %{http_code}\n" \
  "$API_URL/api/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=invalid&hub.challenge=test" || true

echo ""
echo "==> Frontend readiness: $FRONTEND_URL/api/health"
curl -fsS "$FRONTEND_URL/api/health" | python3 -m json.tool 2>/dev/null || echo "FAIL: frontend health"

echo ""
echo "==> WhatsApp connect route (expect 401 without JWT)"
curl -fsS -o /dev/null -w "GET /api/channels/whatsapp/connect → HTTP %{http_code}\n" \
  "$API_URL/api/channels/whatsapp/connect" || true
