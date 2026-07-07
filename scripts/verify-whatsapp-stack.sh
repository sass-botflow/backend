#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-https://api.botflow.ink}"

echo "==> Backend health: $API_URL/health"
BACKEND="$(curl -fsS "$API_URL/health")"
echo "$BACKEND" | python3 -m json.tool 2>/dev/null || echo "$BACKEND"

BUILD="$(echo "$BACKEND" | python3 -c "import sys,json; print(json.load(sys.stdin).get('buildCommit',''))" 2>/dev/null || true)"
EMBEDDED_CONFIG="$(echo "$BACKEND" | python3 -c "import sys,json; print(json.load(sys.stdin).get('embeddedSignupConfigId'))" 2>/dev/null || true)"
WHATSAPP_READY="$(echo "$BACKEND" | python3 -c "import sys,json; print(json.load(sys.stdin).get('whatsappReady'))" 2>/dev/null || true)"
HAS_EVOLUTION="$(echo "$BACKEND" | python3 -c "import sys,json; d=json.load(sys.stdin); print('evolution' in d.get('config',{}))" 2>/dev/null || true)"

if [ "$BUILD" = "v1.0.0-mr84xgy9" ] || [ "$BUILD" = "unknown" ]; then
  echo "FAIL: backend still on old image ($BUILD) — redeploy EasyPanel backend from main"
else
  echo "OK: backend buildCommit=$BUILD"
fi

if [ "$EMBEDDED_CONFIG" != "True" ] && [ "$EMBEDDED_CONFIG" != "true" ]; then
  echo "FAIL: embeddedSignupConfigId=false — set META_EMBEDDED_SIGNUP_CONFIG_ID in EasyPanel and redeploy"
else
  echo "OK: embeddedSignupConfigId=true"
fi

if [ "$WHATSAPP_READY" != "True" ] && [ "$WHATSAPP_READY" != "true" ]; then
  echo "WARN: whatsappReady=false — check META_APP_ID, META_APP_SECRET, TOKEN_ENCRYPTION_KEY"
else
  echo "OK: whatsappReady=true"
fi

if [ "$HAS_EVOLUTION" = "True" ] || [ "$HAS_EVOLUTION" = "true" ]; then
  echo "FAIL: /health still exposes evolution config — old backend image is running"
else
  echo "OK: no evolution fields in /health (Meta-only backend)"
fi

echo ""
echo "==> Complete endpoint must accept only code+state (no ID validation)"
COMPLETE="$(curl -fsS -X POST "$API_URL/api/channels/whatsapp/complete" \
  -H "Content-Type: application/json" \
  -d '{"code":"test","state":"test"}' 2>/dev/null || true)"
echo "$COMPLETE"
if echo "$COMPLETE" | grep -q 'should not be empty'; then
  echo "FAIL: old DTO still running — redeploy backend from main"
elif echo "$COMPLETE" | grep -q 'property.*should not exist'; then
  echo "FAIL: endpoint rejects extra fields incorrectly or old validation"
else
  echo "OK: accepts code+state only (expect OAuth state error or needs_waba)"
fi

EXTRA_FIELDS="$(curl -fsS -X POST "$API_URL/api/channels/whatsapp/complete" \
  -H "Content-Type: application/json" \
  -d '{"code":"test","state":"test","business_id":"x","waba_id":"x","phone_number_id":"x"}' 2>/dev/null || true)"
if echo "$EXTRA_FIELDS" | grep -q 'should not exist'; then
  echo "OK: extra ID fields from frontend are rejected"
else
  echo "WARN: extra fields not rejected (forbidNonWhitelisted may be off on old image)"
fi

echo ""
echo "==> WhatsApp connect route (expect 401 without JWT)"
curl -fsS -o /dev/null -w "GET /api/channels/whatsapp/connect → HTTP %{http_code}\n" \
  "$API_URL/api/channels/whatsapp/connect" || true
