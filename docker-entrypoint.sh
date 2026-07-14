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
log "==> PORT: ${PORT:-8000}"
log "==> EVOLUTION_API_URL exists: $([ -n "$EVOLUTION_API_URL" ] && echo true || echo false)"
log "==> EVOLUTION_API_KEY exists: $([ -n "$EVOLUTION_API_KEY" ] && echo true || echo false)"
log "==> META_APP_ID exists: $([ -n "$META_APP_ID" ] && echo true || echo false)"

MISSING=""

if [ -z "$DATABASE_URL" ]; then
  MISSING="${MISSING} DATABASE_URL"
fi

if [ -z "$JWT_SECRET" ]; then
  MISSING="${MISSING} JWT_SECRET"
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
    if [ -n "$EVOLUTION_API_URL" ] || [ -n "$EVOLUTION_API_KEY" ]; then
      MISSING="${MISSING} EVOLUTION_API_URL+EVOLUTION_API_KEY(both required)"
    else
      MISSING="${MISSING} EVOLUTION_API_URL+EVOLUTION_API_KEY"
    fi
    if [ -n "$META_APP_ID" ] || [ -n "$META_APP_SECRET" ]; then
      log "WARN: Partial META_* vars detected — either set all three or remove META_* entirely."
    fi
  fi

  if [ "$HAS_EVOLUTION" != true ] && [ "$HAS_META" = true ]; then
    log "WARN: EVOLUTION_* not set — WhatsApp QR disabled; Instagram-only mode."
  fi

  if [ "$HAS_META" != true ] && [ "$HAS_EVOLUTION" = true ]; then
    log "WARN: META_* not set — Instagram OAuth disabled."
  fi
fi

if [ -n "$MISSING" ]; then
  log "=========================================="
  log "ERROR: Missing required environment vars:"
  log "$MISSING"
  log ""
  log "FIX (EasyPanel → sass-botflow → backend → Environment):"
  log "  1. Copy env from easypanel.env.example"
  log "  2. Set JWT_SECRET (32+ chars)"
  log "  3. Set EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080"
  log "  4. Set EVOLUTION_API_KEY (same as Evolution AUTHENTICATION_API_KEY)"
  log "  5. DELETE old META_* vars if you only need WhatsApp"
  log "  6. Save → Deploy"
  log ""
  log "Guide: DEPLOY-MKHDAMCH.md"
  log "=========================================="
  exit 1
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
