# Evolution API — EasyPanel Deployment Guide

Deploy Evolution API alongside the BotFlow backend so the NestJS `EvolutionProvider` can call `POST /instance/create` in the next step.

**This guide covers infrastructure only** — no QR, WebSocket, or webhooks in this phase.

---

## Recommended version

| Setting | Value | Why |
|---------|-------|-----|
| Docker image | `evoapicloud/evolution-api:v2.3.7` | Latest **stable** v2.3.x tag on Docker Hub (Dec 2025) |
| PostgreSQL | `postgres:16-alpine` | Matches BotFlow backend stack |
| Redis | `redis:7-alpine` | Official Evolution API cache dependency |

**Do not use in production:**

- `evoapicloud/evolution-api:latest` — unpinned, can change without notice
- `evoapicloud/evolution-api:2.4.0-rc*` — release candidates
- `evoapicloud/evolution-api:homolog` — staging build
- `atendai/evolution-api` — legacy image namespace (v1/v2.1 era)

When `v2.4.0` stable is released, test in staging before upgrading.

---

## Architecture

```
┌──────────────── EasyPanel project ─────────────────┐
│                                                     │
│  ┌─────────────┐         internal HTTP              │
│  │ BotFlow API │ ──────────────────────►           │
│  │ :8000       │   http://evolution-api:8080       │
│  └─────────────┘                                    │
│         │                                           │
│         │  PostgreSQL (botflow DB)                  │
│         ▼                                           │
│  ┌─────────────────────────────────────────────┐   │
│  │  botflow-evolution (docker compose stack)    │   │
│  │                                              │   │
│  │  evolution-api:8080  ◄── public domain       │   │
│  │       │                                      │   │
│  │       ├── evolution-postgres:5432            │   │
│  │       └── evolution-redis:6379               │   │
│  │                                              │   │
│  │  volume: /evolution/instances (WhatsApp      │   │
│  │          session files — critical)           │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

BotFlow talks to Evolution **internally** (`http://evolution-api:8080`).  
Evolution's `SERVER_URL` is the **public** URL (for future QR / webhooks).

---

## Step 1 — Generate secrets

Run locally:

```bash
# Evolution global API key (use the SAME value on BotFlow backend)
openssl rand -hex 32

# PostgreSQL password for Evolution's dedicated database
openssl rand -base64 24
```

Save both — you will need them in Steps 2 and 4.

---

## Step 2 — Create the Compose app in EasyPanel

1. EasyPanel → your BotFlow **project** (same project as `api.botflow.ink` backend)
2. **Add Service** → **Compose**
3. Connect GitHub repo: `sass-botflow/backend`
4. Branch: **`main`**
5. Compose file path: `deploy/evolution-api/docker-compose.yml`
6. Working directory / build path: `deploy/evolution-api`

---

## Step 3 — Environment variables (Evolution Compose app)

In EasyPanel → Compose service → **Environment**, set **only these 3 variables**:

```env
SERVER_URL=https://evolution.api.botflow.ink
AUTHENTICATION_API_KEY=<paste-openssl-rand-hex-32>
DATABASE_CONNECTION_URI=postgresql://botflow:<PASSWORD>@sass-botflow_postgres:5432/evolution?schema=evolution_api
```

All other Evolution settings (`WEBHOOK_GLOBAL_ENABLED`, `WEBSOCKET_ENABLED`, Redis, etc.) are **hardcoded in `docker-compose.yml`**.

**Do not add** `WEBHOOK_GLOBAL_ENABLED`, `WEBSOCKET_ENABLED`, or any other key to EasyPanel Environment — EasyPanel injects them into `docker-compose.override.yml` with `${VAR}` syntax and the deploy fails with:

```
invalid interpolation format for services.evolution-api.environment.WEBHOOK_GLOBAL_ENABLED
```

If you already added those keys, **delete them** from the Environment tab and redeploy.

See [Environment variable reference](#environment-variable-reference) below for every variable.

---

## Step 4 — Domain & port (Evolution API)

| Setting | Value |
|---------|-------|
| Service | `evolution-api` |
| Container port | `8080` |
| Domain (optional now, required before QR) | `evolution.api.botflow.ink` |

`SERVER_URL` must match the domain you assign (with `https://`).

---

## Step 5 — Persistent volumes

The compose file declares three named volumes — **do not delete them** after first deploy:

| Volume | Mount | Purpose |
|--------|-------|---------|
| `botflow_evolution_instances` | `/evolution/instances` | WhatsApp session/auth files |
| `botflow_evolution_postgres_data` | PostgreSQL data dir | Instance metadata DB |
| `botflow_evolution_redis_data` | Redis AOF | Cache persistence |

EasyPanel persists Docker named volumes automatically when using Compose.

---

## Step 6 — Deploy

1. Click **Deploy**
2. Wait until all three containers are **Running**
3. Check **Logs** for `evolution-api` — should show server listening on port 8080

---

## Step 7 — BotFlow backend environment variables

Add these to the **BotFlow backend app** (not the Evolution compose app):

```env
# Internal URL — BotFlow and Evolution must be in the SAME EasyPanel project
# Use project-prefixed hostname (same pattern as sass-botflow_postgres):
EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080

# Must be identical to AUTHENTICATION_API_KEY on Evolution API
EVOLUTION_API_KEY=<same-key-as-step-3>
```

### Required on BotFlow backend (phase 1)

| Variable | Required | Example |
|----------|----------|---------|
| `EVOLUTION_API_URL` | **Yes** | `http://sass-botflow_evolution-api:8080` |
| `EVOLUTION_API_KEY` | **Yes** | Same as `AUTHENTICATION_API_KEY` |

No other Evolution-related backend variables are needed until QR / webhooks are implemented.

### Important

- Use the **internal** hostname `sass-botflow_evolution-api` (EasyPanel project prefix), not `evolution-api` alone and not the public domain.
- `EVOLUTION_API_KEY` and `AUTHENTICATION_API_KEY` **must match exactly**.
- Redeploy the BotFlow backend after adding these variables.

---

## Verification after deployment

### 1. All containers healthy

EasyPanel → Compose → Logs. You should see no restart loops.

### 2. Evolution health endpoint (public)

```bash
curl -s https://evolution.api.botflow.ink/health
```

Expected: HTTP 200 with a JSON health response.

### 3. Authenticated API call

```bash
curl -s https://evolution.api.botflow.ink/instance/fetchInstances \
  -H "apikey: YOUR_AUTHENTICATION_API_KEY"
```

Expected: HTTP 200, JSON array (empty `[]` is fine on fresh install).

### 4. Internal connectivity from BotFlow backend

EasyPanel → BotFlow backend → **Console** (or exec into container):

```bash
curl -s http://evolution-api:8080/health
curl -s http://evolution-api:8080/instance/fetchInstances \
  -H "apikey: YOUR_AUTHENTICATION_API_KEY"
```

Both must return HTTP 200. If this fails, Evolution and BotFlow are not in the same EasyPanel project/network.

### 5. BotFlow health config flag

```bash
curl -s https://api.botflow.ink/health | jq .config
```

After backend env vars are set and redeployed:

```json
{
  "database": true,
  "jwt": true,
  "tokenEncryption": true,
  "evolution": true
}
```

`evolution: true` confirms both `EVOLUTION_API_URL` and `EVOLUTION_API_KEY` are set.

### 6. Create a test instance (optional smoke test)

```bash
curl -s -X POST https://evolution.api.botflow.ink/instance/create \
  -H "apikey: YOUR_AUTHENTICATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "botflow-smoke-test",
    "integration": "WHATSAPP-BAILEYS",
    "qrcode": false
  }'
```

Expected: HTTP 201/200 with instance JSON. Delete the test instance from the manager or API when done.

---

## Environment variable reference

### Server

| Variable | Required | Description |
|----------|----------|-------------|
| `SERVER_URL` | **Yes** | Public base URL (`https://evolution.api.botflow.ink`). Used by Evolution for callbacks and QR in later phases. |
| `SERVER_PORT` | **Yes** | API listen port inside the container. Default `8080`. |
| `SERVER_TYPE` | No | `http` or `https`. Use `http` when TLS terminates at EasyPanel proxy. |
| `SERVER_NAME` | No | Display name in logs/metrics. |

### Authentication

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTHENTICATION_API_KEY` | **Yes** | Global API key. Every request must send header `apikey: <value>`. **Copy to BotFlow `EVOLUTION_API_KEY`.** |
| `AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES` | No | Set `false` in production to avoid leaking per-instance tokens. |

### Database (PostgreSQL)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_PROVIDER` | **Yes** | Must be `postgresql`. |
| `DATABASE_CONNECTION_URI` | **Yes** | Full Prisma-style URI. Host must be `evolution-postgres` (Compose service name). |
| `DATABASE_CONNECTION_CLIENT_NAME` | No | Logical client name when sharing a Postgres server. Use `botflow_evolution`. |
| `POSTGRES_DATABASE` | **Yes** | Database name created by the Postgres container. |
| `POSTGRES_USERNAME` | **Yes** | Postgres user. |
| `POSTGRES_PASSWORD` | **Yes** | Postgres password. Must match the password in `DATABASE_CONNECTION_URI`. |
| `DATABASE_SAVE_DATA_*` | No | What to persist. Phase 1 keeps only `DATABASE_SAVE_DATA_INSTANCE=true`. |

### Redis cache

| Variable | Required | Description |
|----------|----------|-------------|
| `CACHE_REDIS_ENABLED` | **Yes** | Must be `true` for production multi-instance setups. |
| `CACHE_REDIS_URI` | **Yes** | Redis URL. Host must be `evolution-redis`. |
| `CACHE_REDIS_PREFIX_KEY` | No | Key prefix to isolate this install. Use `botflow_evolution`. |
| `CACHE_REDIS_SAVE_INSTANCES` | No | `false` = instance connection state in Postgres (recommended). |

### Disabled in phase 1

| Variable | Value | Reason |
|----------|-------|--------|
| `WEBSOCKET_ENABLED` | `false` | QR/WebSocket not implemented yet |
| `WEBHOOK_GLOBAL_ENABLED` | `false` | Webhooks not implemented yet |
| `WEBHOOK_GLOBAL_URL` | empty | — |
| `RABBITMQ_ENABLED` | `false` | Not needed |
| `SQS_ENABLED` | `false` | Not needed |

### Logging & instances

| Variable | Required | Description |
|----------|----------|-------------|
| `LOG_LEVEL` | No | `ERROR,WARN,INFO` for production. |
| `LOG_BAILEYS` | No | WhatsApp library log level. Use `error`. |
| `DEL_INSTANCE` | No | `false` = keep instances after disconnect (SaaS default). |
| `LANGUAGE` | No | API response language (`en`). |
| `CONFIG_SESSION_PHONE_CLIENT` | No | Name shown on phone during QR (future). |
| `CONFIG_SESSION_PHONE_NAME` | No | Browser name shown on phone (future). |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `invalid interpolation format` / `WEBHOOK_GLOBAL_ENABLED` / `\${WEBHOOK_GLOBAL_ENABLED\}` | Remove **all** env vars except the 3 required (`SERVER_URL`, `AUTHENTICATION_API_KEY`, `DATABASE_CONNECTION_URI`) from EasyPanel Environment. Redeploy. Values must be literals (`false`), never `${VAR}` or `\$` escapes. |
| `evolution-api` restart loop | Check Logs — usually wrong `DATABASE_CONNECTION_URI` or Postgres not healthy |
| `401` on API calls | `apikey` header does not match `AUTHENTICATION_API_KEY` |
| BotFlow cannot reach Evolution | Both apps must be in the **same EasyPanel project**; use `http://evolution-api:8080` not `localhost` |
| `/health` OK but `fetchInstances` fails | API key mismatch or Evolution still starting (wait 60s) |
| Data lost after redeploy | Volumes were deleted — never run `docker compose down -v` in production |

---

## Next step (separate PR)

Once this stack is verified:

1. Merge the BotFlow `WhatsAppModule` + `EvolutionProvider` backend PR
2. Set `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` on the backend
3. Call `POST /api/whatsapp/sessions` — backend will hit `POST /instance/create` on Evolution API

QR, WebSocket events, and inbound webhooks will be added in later PRs.
