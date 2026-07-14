#!/usr/bin/env bash
# Emergency backend start on VPS (SSH / EasyPanel terminal)
# Usage: sudo bash scripts/vps-emergency-backend.sh
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-botflow-api:emergency}"
CONTAINER_NAME="${CONTAINER_NAME:-botflow-backend-emergency}"
REPO_URL="${REPO_URL:-https://github.com/sass-botflow/backend.git}"
BRANCH="${BRANCH:-main}"
PORT="${PORT:-8000}"

log() { echo "[emergency-deploy] $*" >&2; }

if ! command -v docker >/dev/null 2>&1; then
  log "ERROR: docker not found"
  exit 1
fi

WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

log "Cloning $REPO_URL ($BRANCH)..."
git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$WORKDIR/src"
cd "$WORKDIR/src"

log "Building with Dockerfile.easypanel (low RAM)..."
docker build -f Dockerfile.easypanel \
  --build-arg BUILD_COMMIT="emergency-$(date +%s)" \
  -t "$IMAGE_NAME" .

docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

NETWORK=$(docker network ls --format '{{.Name}}' | grep -E 'sass-botflow|easypanel' | head -1 || true)
NET_ARGS=()
if [ -n "$NETWORK" ]; then
  NET_ARGS=(--network "$NETWORK")
  log "Using docker network: $NETWORK"
else
  log "WARN: sass-botflow network not found — using default bridge"
fi

: "${JWT_SECRET:?Set JWT_SECRET env var}"
: "${EVOLUTION_API_KEY:?Set EVOLUTION_API_KEY env var}"

log "Starting container on port $PORT..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  "${NET_ARGS[@]}" \
  -p "${PORT}:8000" \
  -e NODE_ENV=production \
  -e PORT=8000 \
  -e BUILD_COMMIT="emergency-$(date +%s)" \
  -e DATABASE_URL="${DATABASE_URL:-postgresql://botflow:botflow@sass-botflow_postgres:5432/postgres?sslmode=disable}" \
  -e JWT_SECRET="$JWT_SECRET" \
  -e EVOLUTION_API_URL="${EVOLUTION_API_URL:-http://sass-botflow_botflow-evolution:8080}" \
  -e EVOLUTION_API_KEY="$EVOLUTION_API_KEY" \
  -e EVOLUTION_WEBHOOK_URL="${EVOLUTION_WEBHOOK_URL:-https://api.botflow.ink/webhooks/evolution}" \
  -e BACKEND_URL="${BACKEND_URL:-https://api.botflow.ink}" \
  -e FRONTEND_URL="${FRONTEND_URL:-https://www.botflow.ink}" \
  -e CORS_ORIGIN="${CORS_ORIGIN:-https://botflow.ink,https://www.botflow.ink}" \
  "$IMAGE_NAME"

sleep 5
log "Health:"
curl -fsS "http://127.0.0.1:${PORT}/health" || docker logs "$CONTAINER_NAME" --tail 30
log "Done. Container: $CONTAINER_NAME"
