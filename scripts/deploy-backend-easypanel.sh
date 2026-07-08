#!/usr/bin/env sh
# Trigger EasyPanel backend deploy from your machine.
# Usage:
#   EASYPANEL_DEPLOY_URL='http://187.124.12.89:3000/api/deploy/xxxxxxxx' ./scripts/deploy-backend-easypanel.sh

set -e

URL="${EASYPANEL_DEPLOY_URL:-${EASYPANEL_DEPLOY_WEBHOOK:-}}"

if [ -z "$URL" ]; then
  echo "Error: set EASYPANEL_DEPLOY_URL to your EasyPanel Deployment Trigger URL"
  echo ""
  echo "  EasyPanel → backend → Deployments → copy Deployment Trigger"
  echo "  Example: http://187.124.12.89:3000/api/deploy/xxxxxxxx"
  echo ""
  echo "  EASYPANEL_DEPLOY_URL='http://...' ./scripts/deploy-backend-easypanel.sh"
  exit 1
fi

echo "Triggering EasyPanel backend deploy..."
curl -fsS -X POST "$URL"
echo ""
echo "Waiting 45s for rollout..."
sleep 45

echo "Health check:"
HEALTH=$(curl -fsS https://api.botflow.ink/health 2>/dev/null || echo '{"buildCommit":"error"}')
echo "$HEALTH"

BUILD=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('buildCommit',''))" 2>/dev/null || echo "?")
CONNECT=$(curl -s -o /dev/null -w "%{http_code}" -X POST https://api.botflow.ink/api/channels/whatsapp/connect)

echo ""
echo "buildCommit: $BUILD"
echo "POST /connect: $CONNECT (want 401, not 404)"

if [ "$BUILD" = "v1.0.0-mr84xgy9" ] || [ "$CONNECT" = "404" ]; then
  echo ""
  echo "FAIL: still on old backend. See DEPLOY-FACILE.md (Registry or GHCR public)."
  exit 1
fi

echo "OK: backend deploy looks good."
