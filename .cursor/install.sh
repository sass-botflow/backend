#!/usr/bin/env bash
# Idempotent repository bootstrap for the BotFlow API Cloud Agent environment.
# Installs system services (PostgreSQL + Redis), Node dependencies, generates the
# Prisma client, and writes a local development .env when one is not present.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Ensuring system services (PostgreSQL + Redis) are installed..."
if ! command -v psql >/dev/null 2>&1 || ! command -v redis-server >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    postgresql postgresql-contrib redis-server openssl
else
  echo "    PostgreSQL and Redis already installed."
fi

echo "==> Writing local development .env (if missing)..."
if [ ! -f .env ]; then
  cat > .env <<'EOF'
NODE_ENV=development
PORT=8000

DATABASE_URL=postgresql://botflow:botflow@localhost:5432/botflow
REDIS_URL=redis://localhost:6379

JWT_SECRET=local-dev-jwt-secret-change-me-please-32chars-minimum
CORS_ORIGIN=http://localhost:3000,http://localhost:8000
FRONTEND_URL=http://localhost:3000

TOKEN_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
META_VERIFY_TOKEN=local-dev-verify-token
EOF
  echo "    Wrote .env with local development defaults."
else
  echo "    .env already exists; leaving it untouched."
fi

echo "==> Installing Node dependencies (npm ci)..."
npm ci

echo "==> Generating Prisma client..."
npx prisma generate

echo "==> install.sh complete."
