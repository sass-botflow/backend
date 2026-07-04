#!/bin/sh
set -e

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
  echo "ERROR: TOKEN_ENCRYPTION_KEY is not set (32-byte hex or base64)."
  exit 1
fi

if [ -z "$META_VERIFY_TOKEN" ]; then
  echo "WARNING: META_VERIFY_TOKEN is not set."
  echo "WhatsApp webhook verification will fail until you set it in Environment and Meta Console."
fi

sync_schema() {
  if [ -d prisma/migrations ] && ls prisma/migrations/*/migration.sql >/dev/null 2>&1; then
    echo "==> Trying prisma migrate deploy..."
    if npx prisma migrate deploy; then
      echo "==> Prisma migrations applied."
      return 0
    fi
    echo "WARNING: prisma migrate deploy failed — falling back to prisma db push."
  else
    echo "==> No migrations found — using prisma db push."
  fi

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
