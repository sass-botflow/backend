#!/usr/bin/env bash
# Per-boot service reconciliation for the BotFlow API Cloud Agent environment.
# Starts PostgreSQL and Redis (no systemd in the VM), ensures the botflow role and
# database exist, and syncs the Prisma schema. Idempotent and safe to re-run.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Starting PostgreSQL cluster..."
if ! pg_isready -q 2>/dev/null; then
  sudo pg_ctlcluster 16 main start
fi

echo "==> Waiting for PostgreSQL to accept connections..."
for i in $(seq 1 30); do
  if pg_isready -q 2>/dev/null; then break; fi
  sleep 1
done

echo "==> Ensuring botflow role and database exist..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='botflow'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE botflow LOGIN PASSWORD 'botflow';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='botflow'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE botflow OWNER botflow;"

echo "==> Starting Redis..."
if ! redis-cli ping >/dev/null 2>&1; then
  sudo mkdir -p /var/lib/redis
  sudo redis-server --daemonize yes --dir /var/lib/redis
fi

echo "==> Syncing Prisma schema (prisma db push)..."
npx prisma db push --skip-generate --accept-data-loss

echo "==> start.sh complete: PostgreSQL and Redis are ready."
