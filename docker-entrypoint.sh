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

# EasyPanel may not pass BUILD_COMMIT; use id baked at image build time.
if [ -z "$BUILD_COMMIT" ] || [ "$BUILD_COMMIT" = "unknown" ]; then
  if [ -f build-id.txt ]; then
    BUILD_COMMIT=$(cat build-id.txt)
    export BUILD_COMMIT
  fi
fi

log "==> BotFlow API starting (build: ${BUILD_COMMIT:-unknown})..."
log "==> Node version: $(node -v 2>/dev/null || echo unknown)"

if [ -z "$DATABASE_URL" ]; then
  log "ERROR: DATABASE_URL is not set."
  log "Add PostgreSQL in EasyPanel and set DATABASE_URL in Environment."
  exit 1
fi

if [ -z "$JWT_SECRET" ]; then
  log "ERROR: JWT_SECRET is not set (min 32 characters)."
  exit 1
fi

if [ -z "$TOKEN_ENCRYPTION_KEY" ]; then
  log "WARNING: TOKEN_ENCRYPTION_KEY is not set."
  log "App will start, but Meta WhatsApp channel token encryption is disabled."
  log "Generate one: openssl rand -hex 32"
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

if [ -n "$EVOLUTION_API_URL" ] && echo "$DATABASE_URL" | grep -q 'sass-botflow_postgres'; then
  if echo "$EVOLUTION_API_URL" | grep -Eq '://evolution-api:8080/?$'; then
    log "HINT: EasyPanel internal Evolution URL is usually http://sass-botflow_evolution-api:8080"
  fi
fi

if [ -n "$EVOLUTION_API_URL" ] && [ -n "$EVOLUTION_API_KEY" ]; then
  log "==> Checking Evolution API connectivity..."
  node -e "
    const dns = require('node:dns/promises');
    const net = require('node:net');
    const base = process.env.EVOLUTION_API_URL.replace(/\/$/, '');
    const url = new URL(base);
    const host = url.hostname;
    const port = Number(url.port || 8080);
    const candidates = [host];
  if (host === 'evolution-api') candidates.push('sass-botflow_evolution-api');
    (async () => {
      for (const name of candidates) {
        try {
          const lookedUp = await dns.lookup(name);
          const ok = await new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(3000);
            socket.once('connect', () => { socket.destroy(); resolve(true); });
            socket.once('timeout', () => { socket.destroy(); resolve(false); });
            socket.once('error', () => { socket.destroy(); resolve(false); });
            socket.connect(port, name);
          });
          if (ok) {
            console.error('[INFO] Evolution reachable at http://' + name + ':' + port + ' (' + lookedUp.address + ')');
            process.exit(0);
          }
          console.error('[WARN] Evolution DNS ok for ' + name + ' but TCP port ' + port + ' refused');
        } catch (error) {
          console.error('[WARN] Evolution DNS/TCP failed for ' + name + ': ' + (error && error.code ? error.code : error));
        }
      }
      console.error('[ERROR] Evolution API not reachable. Start evolution-api Compose in EasyPanel and set EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080');
      process.exit(0);
    })().catch((error) => {
      console.error('[ERROR] Evolution startup check crashed:', error);
      process.exit(0);
    });
  " || log "WARNING: Evolution connectivity check failed to run"
fi

log "==> Database schema synced."
log "==> Starting server on port ${PORT:-8000}..."
exec node dist/main.js
