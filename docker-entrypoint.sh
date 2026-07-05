#!/bin/sh
set -e

# EasyPanel may not pass BUILD_COMMIT; use id baked at image build time.
if [ -z "$BUILD_COMMIT" ] || [ "$BUILD_COMMIT" = "unknown" ]; then
  if [ -f build-id.txt ]; then
    BUILD_COMMIT=$(cat build-id.txt)
    export BUILD_COMMIT
  fi
fi

echo "==> BotFlow API starting (build: ${BUILD_COMMIT:-unknown})..."

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Add PostgreSQL in EasyPanel and set DATABASE_URL in Environment."
  exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  echo "ERROR: JWT_SECRET is not set (min 32 characters)."
  exit 1
fi

if [ -z "$TOKEN_ENCRYPTION_KEY" ]; then
  echo "WARNING: TOKEN_ENCRYPTION_KEY is not set."
  echo "App will start, but Meta WhatsApp channel token encryption is disabled."
  echo "Generate one: openssl rand -hex 32"
fi

if [ -z "$META_VERIFY_TOKEN" ]; then
  echo "WARNING: META_VERIFY_TOKEN is not set."
  echo "WhatsApp webhook verification will fail until you set it in Environment and Meta Console."
fi

sync_schema() {
  echo "==> Syncing schema with prisma db push..."
  npx prisma db push --skip-generate --accept-data-loss
}

echo "==> Syncing database schema..."
MAX_DB_RETRIES="${DB_CONNECT_RETRIES:-30}"
RETRY=0

until sync_schema; do
  RETRY=$((RETRY + 1))
  if [ "$RETRY" -ge "$MAX_DB_RETRIES" ]; then
    echo "ERROR: Could not connect to PostgreSQL after ${MAX_DB_RETRIES} attempts."
    echo "Check DATABASE_URL uses the EasyPanel internal hostname (not localhost)."
    exit 1
  fi
  echo "Database not ready (attempt ${RETRY}/${MAX_DB_RETRIES}), retrying in 3s..."
  sleep 3
done

echo "==> Database schema synced."
echo "==> Starting server on port ${PORT:-8000}..."
exec node dist/main.js
