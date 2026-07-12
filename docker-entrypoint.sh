#!/bin/sh
set -e
set -o pipefail

log() {
  echo "$@" >&2
}

on_error() {
  log "ERROR: entrypoint failed at line $1 (exit code $?)"
}

trap 'on_error $LINENO' ERR

NODE_ENV="${NODE_ENV:-production}"

if [ -z "$BUILD_COMMIT" ] || [ "$BUILD_COMMIT" = "unknown" ]; then
  if [ -f build-id.txt ]; then
    BUILD_COMMIT=$(cat build-id.txt)
    export BUILD_COMMIT
  fi
fi

if [ -f build-id.txt ]; then
  log "==> Image build-id.txt: $(cat build-id.txt)"
fi

log "==> BotFlow API starting"
log "==> Build Commit: ${BUILD_COMMIT:-unknown}"
log "==> NODE_ENV: ${NODE_ENV}"
log "==> Node version: $(node -v 2>/dev/null || echo unknown)"
log "==> EVOLUTION_API_URL exists: $([ -n "$EVOLUTION_API_URL" ] && echo true || echo false)"
log "==> META_APP_ID exists: $([ -n "$META_APP_ID" ] && echo true || echo false)"

if [ -z "$DATABASE_URL" ]; then
  log "ERROR: DATABASE_URL is not set."
  exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  log "ERROR: JWT_SECRET is not set (min 32 characters)."
  log "FIX: EasyPanel → backend → Environment → add JWT_SECRET"
  log "See: EASYPANEL-DEPLOY.md"
  exit 1
fi

if [ "$NODE_ENV" = "production" ]; then
  HAS_EVOLUTION=false
  HAS_META=false

  if [ -n "$EVOLUTION_API_URL" ] && [ -n "$EVOLUTION_API_KEY" ]; then
    HAS_EVOLUTION=true
  fi

  if [ -n "$META_APP_ID" ] && [ -n "$META_APP_SECRET" ] && [ -n "$META_REDIRECT_URI" ]; then
    HAS_META=true
  fi

  if [ "$HAS_EVOLUTION" != true ] && [ "$HAS_META" != true ]; then
    log "ERROR: Configure WhatsApp (EVOLUTION_API_URL + EVOLUTION_API_KEY)"
    log "       OR Instagram (META_APP_ID + META_APP_SECRET + META_REDIRECT_URI)."
    log "FIX: EasyPanel → backend → Environment"
    exit 1
  fi

  if [ "$HAS_EVOLUTION" != true ]; then
    log "WARN: EVOLUTION_* not set — WhatsApp QR disabled; Instagram-only mode."
  fi

  if [ "$HAS_META" != true ]; then
    log "WARN: META_* not set — Instagram OAuth disabled."
  fi
fi

sync_schema() {
  log "==> Syncing schema with prisma db push..."
  if ! npx prisma db push --skip-generate --accept-data-loss 2>&1; then
    log "ERROR: prisma db push failed"
    return 1
  fi
}

log "==> Syncing database schema..."
MAX_DB_RETRIES="${DB_CONNECT_RETRIES:-30}"
RETRY=0

until sync_schema; do
  RETRY=$((RETRY + 1))
  if [ "$RETRY" -ge "$MAX_DB_RETRIES" ]; then
    log "ERROR: Could not connect to PostgreSQL after ${MAX_DB_RETRIES} attempts."
    exit 1
  fi
  log "Database not ready (attempt ${RETRY}/${MAX_DB_RETRIES}), retrying in 3s..."
  sleep 3
done

log "==> Database schema synced."
log "==> Starting server on port ${PORT:-8000}..."
exec node dist/main.js
