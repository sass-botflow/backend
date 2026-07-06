#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-https://api.botflow.ink}"
FRONTEND_URL="${FRONTEND_URL:-https://www.botflow.ink}"
EVOLUTION_URL="${EVOLUTION_URL:-https://evolution.api.botflow.ink}"

echo "==> Backend health: $API_URL/health"
BACKEND="$(curl -fsS "$API_URL/health")"
echo "$BACKEND" | python3 -m json.tool 2>/dev/null || echo "$BACKEND"

BUILD="$(echo "$BACKEND" | python3 -c "import sys,json; print(json.load(sys.stdin).get('buildCommit',''))" 2>/dev/null || true)"
WHATSAPP_MODULE="$(echo "$BACKEND" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('modules',{}).get('whatsapp'))" 2>/dev/null || true)"

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

echo ""
echo "==> Backend evolution probe: $API_URL/health/evolution"
curl -fsS "$API_URL/health/evolution" | python3 -m json.tool 2>/dev/null || echo "FAIL: /health/evolution not found — redeploy backend"

echo ""
echo "==> Frontend readiness: $FRONTEND_URL/api/health"
curl -fsS "$FRONTEND_URL/api/health" | python3 -m json.tool 2>/dev/null || echo "FAIL: frontend health"

echo ""
echo "==> Evolution public: $EVOLUTION_URL/health"
if curl -fsS --max-time 10 "$EVOLUTION_URL/health" >/dev/null 2>&1; then
  echo "OK: Evolution public health"
else
  echo "FAIL: Evolution not reachable — EasyPanel → evolution-api → Deploy (must be green)"
fi

echo ""
echo "==> WhatsApp API route (expect 401 without JWT)"
curl -fsS -o /dev/null -w "POST /api/whatsapp/sessions → HTTP %{http_code}\n" \
  -X POST "$API_URL/api/whatsapp/sessions" -H "Content-Type: application/json" -d '{}' || true
