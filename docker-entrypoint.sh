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

# EasyPanel may not pass BUILD_COMMIT; use id baked at image build time.
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
log "==> META_APP_ID: ${META_APP_ID:-(not set)}"
if [ -n "$META_EMBEDDED_SIGNUP_CONFIG_ID" ]; then
  log "==> META_EMBEDDED_SIGNUP_CONFIG_ID exists: true"
else
  log "==> META_EMBEDDED_SIGNUP_CONFIG_ID exists: false"
fi

if [ -z "$DATABASE_URL" ]; then
  log "ERROR: DATABASE_URL is not set."
  log "Add PostgreSQL in EasyPanel and set DATABASE_URL in Environment."
  exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  log "ERROR: JWT_SECRET is not set (min 32 characters)."
  exit 1
fi

if [ "$NODE_ENV" = "production" ]; then
  if [ -z "$META_EMBEDDED_SIGNUP_CONFIG_ID" ]; then
    log "ERROR: META_EMBEDDED_SIGNUP_CONFIG_ID is not set."
    log "Add META_EMBEDDED_SIGNUP_CONFIG_ID=1353028573456188 in EasyPanel backend Environment."
    exit 1
  fi

  if [ -z "$META_APP_ID" ]; then
    log "ERROR: META_APP_ID is not set."
    exit 1
  fi

  if [ -z "$META_APP_SECRET" ]; then
    log "ERROR: META_APP_SECRET is not set."
    exit 1
  fi

  if [ -z "$TOKEN_ENCRYPTION_KEY" ]; then
    log "ERROR: TOKEN_ENCRYPTION_KEY is not set."
    log "Generate one: openssl rand -hex 32"
    exit 1
  fi
else
  if [ -z "$TOKEN_ENCRYPTION_KEY" ]; then
    log "WARNING: TOKEN_ENCRYPTION_KEY is not set."
    log "Generate one: openssl rand -hex 32"
  fi

  if [ -z "$META_EMBEDDED_SIGNUP_CONFIG_ID" ]; then
    log "WARNING: META_EMBEDDED_SIGNUP_CONFIG_ID is not set."
  fi
fi

if [ -z "$META_VERIFY_TOKEN" ]; then
  log "WARNING: META_VERIFY_TOKEN is not set."
  log "WhatsApp webhook verification will fail until you set it in Environment and Meta Console."
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
    log "Check DATABASE_URL uses the EasyPanel internal hostname (not localhost)."
    exit 1
  fi
  log "Database not ready (attempt ${RETRY}/${MAX_DB_RETRIES}), retrying in 3s..."
  sleep 3
done

log "==> Database schema synced."
log "==> Starting server on port ${PORT:-8000}..."
exec node dist/main.js
