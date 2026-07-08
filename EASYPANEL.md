# EasyPanel Deployment Guide — BotFlow Backend

**Quick start:** see **[DEPLOY.md](./DEPLOY.md)** for Evolution API deploy steps.

Deploy `api.botflow.ink` on port **8000**.

## Architecture

```
Frontend → NestJS Backend → Evolution API → WhatsApp Web
```

## Production deployment checklist (EasyPanel)

Production is broken if `buildCommit` stays on an old value like `v1.0.0-mr84xgy9`.

### A. EasyPanel service settings

| Setting | Required value |
|---------|----------------|
| Project | `sass-botflow` |
| Service | `backend` |
| Source repo | `sass-botflow/backend` |
| Branch | `main` |
| Build method | **Dockerfile** |
| Dockerfile | `/Dockerfile` (repo root) |
| Container port | `8000` |
| Domain | `api.botflow.ink` → port `8000` |

### B. Required environment variables

Copy into EasyPanel → backend → **Environment** → Save:

```env
NODE_ENV=production
PORT=8000
DATABASE_URL=postgresql://botflow:botflow@sass-botflow_postgres:5432/postgres?sslmode=disable
JWT_SECRET=<min 32 random chars>
EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080
EVOLUTION_API_KEY=<same as Evolution AUTHENTICATION_API_KEY>
EVOLUTION_WEBHOOK_URL=https://api.botflow.ink/webhooks/evolution
BACKEND_URL=https://api.botflow.ink
N8N_WEBHOOK_URL=https://ecomgcc21.app.n8n.cloud/webhook/0edc08c4-6908-43ce-8f9f-dbc5ace31958
FRONTEND_URL=https://www.botflow.ink
CORS_ORIGIN=https://botflow.ink,https://www.botflow.ink
```

`EVOLUTION_API_URL` and `EVOLUTION_API_KEY` are **required in production**. The container will **refuse to start** without them.

**Remove if present (legacy Meta Cloud API):**

```env
META_APP_ID=
META_APP_SECRET=
META_EMBEDDED_SIGNUP_CONFIG_ID=
META_VERIFY_TOKEN=
META_WHATSAPP_REDIRECT_URI=
TOKEN_ENCRYPTION_KEY=
```

### C. Deploy Evolution API (separate service)

Deploy `deploy/evolution-api/docker-compose.yml` in EasyPanel first. Set `AUTHENTICATION_API_KEY` to the same value as backend `EVOLUTION_API_KEY`.

### D. Deploy backend

**Option 1 — Docker Image from GitHub (recommended)**

1. Wait for GitHub Actions `Build and Push Backend Image` to finish on `main`
2. Make package public (once): GitHub → org `sass-botflow` → **Packages** → `backend` → **Change visibility** → Public
3. EasyPanel → `backend` → **Source** → **Docker Image**
4. Image: `ghcr.io/sass-botflow/backend:latest`
5. Port: `8000` → **Save** → **Deploy**

**Option 2 — Build on EasyPanel VPS (GitHub source)**

1. EasyPanel → `backend` → **Environment** → paste vars above → **Save**
2. **Source** → **GitHub** → `sass-botflow/backend` → branch `main` → **Dockerfile**
3. **Deploy** tab → click **Deploy** (use **Clear build cache** if available)
4. Wait **5–10 minutes** (real Docker build). ~1 min = restart only, not a rebuild.

Expected startup logs:

```
==> Build Commit: <git sha, NOT v1.0.0-mr84xgy9>
==> EVOLUTION_API_URL exists: true
=== BotFlow API Startup ===
```

### E. Post-deploy verification

```bash
curl -s https://api.botflow.ink/health | python3 -m json.tool
bash scripts/verify-whatsapp-stack.sh
```

| Field | Expected |
|-------|----------|
| `buildCommit` | New value (NOT `v1.0.0-mr84xgy9`) |
| `whatsappReady` | `true` |
| `config.evolution.apiUrl` | `true` |
| `config.evolution.apiKey` | `true` |
| `modules.whatsapp` | `true` |
| `config.meta` | **must NOT appear** |

Test WhatsApp connect endpoint (JWT required):

```bash
curl -s -o /dev/null -w "%{http_code}" https://api.botflow.ink/api/channels/whatsapp/connect
# expect 401 (not 404)
```

### F. Auto-deploy (optional)

1. EasyPanel → backend → Deploy → copy **Deploy Webhook URL**
2. GitHub → `sass-botflow/backend` → Settings → Secrets → Actions
3. Add `EASYPANEL_BACKEND_DEPLOY_WEBHOOK` = webhook URL
4. Every push to `main` triggers `.github/workflows/easypanel-deploy.yml`

### G. Build troubleshooting

| Symptom | Fix |
|---------|-----|
| `buildCommit` unchanged after deploy | Force rebuild / clear Docker cache; confirm branch `main` |
| `EVOLUTION_API_URL exists: false` in logs | Add env var in EasyPanel → Save → Redeploy |
| Container restart loop on start | Read Logs — missing `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, or `JWT_SECRET` |
| `nest build` Killed | Already fixed via SWC in `nest-cli.json`; redeploy from latest `main` |
| `whatsappReady: false` in `/health` | Set Evolution env vars and redeploy |

---

## Step 1 — Add PostgreSQL (required)

The backend **cannot start without PostgreSQL**.

In EasyPanel:

1. Create a new service → **PostgreSQL**
2. Note the internal connection string, e.g.:
   ```
   postgresql://botflow:YOUR_PASSWORD@postgres:5432/botflow
   ```
3. Use the **internal hostname** (service name), not `localhost`

## Step 2 — Create backend app

1. New app → connect GitHub repo `sass-botflow/backend`
2. Branch: **`main`**
3. Build method: **Dockerfile** (uses `/Dockerfile` in repo root)

## Step 3 — Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | **Yes** | PostgreSQL — use **internal** EasyPanel hostname |
| `JWT_SECRET` | **Yes** | Min 32 characters (Clerk bridge / Passport JWT) |
| `PORT` | **Yes** | Set to `8000` |
| `CORS_ORIGIN` | **Yes** | Your frontend domain |
| `FRONTEND_URL` | **Yes** | `https://botflow.ink` |
| `EVOLUTION_API_URL` | **Yes** | Internal Evolution API URL |
| `EVOLUTION_API_KEY` | **Yes** | Same as Evolution `AUTHENTICATION_API_KEY` |
| `EVOLUTION_WEBHOOK_URL` | Recommended | `https://api.botflow.ink/webhooks/evolution` |
| `BACKEND_URL` | Recommended | `https://api.botflow.ink` |
| `N8N_WEBHOOK_URL` | For AI automation | n8n webhook URL for inbound messages |
| `REDIS_URL` | No | Optional |

## Step 4 — Port & domain

| Setting | Value |
|---------|-------|
| Container port | `8000` |
| Domain | `api.botflow.ink` |

## Step 5 — Deploy & test

1. EasyPanel → backend app → **Deploy** tab
2. Confirm: Branch = **`main`**, Build method = **Dockerfile**
3. Click **Deploy**
4. Wait for build to finish — status must show **Running**
5. Test: `https://api.botflow.ink/health`

Expected response:

```json
{
  "status": "ok",
  "service": "botflow-api",
  "whatsappReady": true,
  "modules": { "whatsapp": true },
  "config": {
    "evolution": { "apiUrl": true, "apiKey": true }
  }
}
```

Verify WhatsApp routes:

```bash
curl -s https://api.botflow.ink/health | jq .modules.whatsapp
curl -s -o /dev/null -w "%{http_code}" https://api.botflow.ink/api/channels/whatsapp/connect
```

---

## Common errors & fixes

### EasyPanel 404 on `api.botflow.ink`

Fix checklist:
1. EasyPanel → backend service → status must be **Running**
2. **Domains** tab → `api.botflow.ink` → port **8000**
3. **Deploy** tab → branch = `main`, build method = **Dockerfile**
4. **Logs** tab → check for crash (`DATABASE_URL`, `JWT_SECRET`, Postgres connection)
5. Test: `https://api.botflow.ink/health` must return JSON

### `ERROR: DATABASE_URL is not set`

Add PostgreSQL service and set `DATABASE_URL` in Environment, then redeploy.

### `ERROR: EVOLUTION_API_URL is not set`

Deploy Evolution API service and set `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` in backend Environment.

### `ERROR: JWT_SECRET is not set`

Add `JWT_SECRET` with at least 32 characters.

### Build fails: `nest build` / `Killed`

Redeploy from latest `main` (SWC build). Increase EasyPanel build memory if needed.

### n8n not receiving messages

Set `N8N_WEBHOOK_URL` in Environment and redeploy. Ensure WhatsApp session is `CONNECTED`.

### QR code not appearing

1. `POST /api/channels/whatsapp/connect` with JWT
2. `GET /api/channels/whatsapp/:id/qr` with JWT
3. Check Evolution API logs and `EVOLUTION_WEBHOOK_URL`

---

## Checklist

- [ ] PostgreSQL service created and **running**
- [ ] Evolution API service deployed (`deploy/evolution-api/docker-compose.yml`)
- [ ] `EVOLUTION_API_URL` + `EVOLUTION_API_KEY` set on backend
- [ ] `JWT_SECRET` set (32+ chars)
- [ ] `PORT=8000`
- [ ] Domain `api.botflow.ink` → port 8000
- [ ] Branch **`main`** selected
- [ ] `/health` returns `whatsappReady: true`
- [ ] `N8N_WEBHOOK_URL` set for AI automation
