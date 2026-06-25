#!/bin/sh
set -e

echo "==> BotFlow API starting..."

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Add PostgreSQL in EasyPanel and set DATABASE_URL in Environment."
  exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  echo "ERROR: JWT_SECRET is not set (min 32 characters)."
  exit 1
fi

echo "==> Syncing database schema..."
npx prisma db push --skip-generate

echo "==> Starting server on port ${PORT:-8000}..."
exec node dist/main.js
