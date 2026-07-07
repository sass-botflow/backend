# EasyPanel Deployment Guide — BotFlow Backend

Deploy `api.botflow.ink` on port **8000**.

## Production deployment checklist (EasyPanel)

Use this before and after every backend deploy. Production is broken if `buildCommit` stays on an old value like `v1.0.0-mr84xgy9`.

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
TOKEN_ENCRYPTION_KEY=<openssl rand -hex 32>
META_APP_ID=1811541566932500
META_APP_SECRET=<from Meta Developer Console>
META_EMBEDDED_SIGNUP_CONFIG_ID=1353028573456188
META_VERIFY_TOKEN=botflow-wa-verify-7k9m2x4p8q
META_WHATSAPP_REDIRECT_URI=https://api.botflow.ink/api/channels/whatsapp/callback
N8N_WEBHOOK_URL=https://ecomgcc21.app.n8n.cloud/webhook/0edc08c4-6908-43ce-8f9f-dbc5ace31958
FRONTEND_URL=https://www.botflow.ink
CORS_ORIGIN=https://botflow.ink,https://www.botflow.ink
```

**Remove if present (legacy):**

```env
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
```

`META_EMBEDDED_SIGNUP_CONFIG_ID` is **required in production**. The container will **refuse to start** without it.

### C. Deploy steps

1. EasyPanel → `backend` → **Environment** → paste vars above → **Save**
2. **Deploy** tab → confirm branch `main` + Dockerfile
3. Click **Deploy** (use **Clear build cache** / rebuild if available)
4. Wait until status = **Running** (green)
5. Open **Logs** and confirm startup lines:

```
==> Build Commit: <not v1.0.0-mr84xgy9>
==> META_APP_ID: 1811541566932500
==> META_EMBEDDED_SIGNUP_CONFIG_ID exists: true
=== BotFlow API Startup ===
```

### D. Post-deploy verification

```bash
curl -s https://api.botflow.ink/health | python3 -m json.tool
```

| Field | Expected |
|-------|----------|
| `buildCommit` | New value (NOT `v1.0.0-mr84xgy9`) |
| `embeddedSignupConfigId` | `true` |
| `whatsappReady` | `true` |
| `config.meta.embeddedSignupConfigId` | `true` |
| `modules.whatsapp` | `true` |
| `evolution` | **must NOT appear** (old image indicator) |

Test complete endpoint accepts code+state only (no ID validation errors):

```bash
curl -s -X POST https://api.botflow.ink/api/channels/whatsapp/complete \
  -H "Content-Type: application/json" \
  -d '{"code":"test","state":"test","business_id":"","waba_id":"","phone_number_id":""}'
```

Expected: `401 Invalid or expired OAuth state` — **NOT** `business_id should not be empty`.

### E. Auto-deploy (optional)

1. EasyPanel → backend → Deploy → copy **Deploy Webhook URL**
2. GitHub → `sass-botflow/backend` → Settings → Secrets → Actions
3. Add `EASYPANEL_BACKEND_DEPLOY_WEBHOOK` = webhook URL
4. Every push to `main` triggers `.github/workflows/easypanel-deploy.yml`

### F. Build troubleshooting

| Symptom | Fix |
|---------|-----|
| `buildCommit` unchanged after deploy | Force rebuild / clear Docker cache; confirm branch `main` |
| `META_EMBEDDED_SIGNUP_CONFIG_ID exists: false` in logs | Add env var in EasyPanel → Save → Redeploy |
| Container restart loop on start | Read Logs — missing `META_EMBEDDED_SIGNUP_CONFIG_ID` or `JWT_SECRET` |
| `nest build` Killed | Already fixed via SWC in `nest-cli.json`; redeploy from latest `main` |
| `embeddedSignupConfigId: false` in `/health` | Env var not set on running container — redeploy after Save |

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
2. Branch: **`main`** ← must be `main`
3. Build method: **Dockerfile** (uses `/Dockerfile` in repo root)

## Step 3 — Environment variables

In EasyPanel → your backend app → **Environment**:

```env
NODE_ENV=production
PORT=8000
DATABASE_URL=postgresql://botflow:YOUR_PASSWORD@YOUR_POSTGRES_SERVICE:5432/botflow
JWT_SECRET=put-a-long-random-secret-at-least-32-characters
CORS_ORIGIN=https://botflow.ink,https://www.botflow.ink
FRONTEND_URL=https://botflow.ink

# Meta / WhatsApp (required for WhatsApp features)
META_APP_ID=your-meta-app-id
META_APP_SECRET=your-meta-app-secret
META_EMBEDDED_SIGNUP_CONFIG_ID=your-facebook-login-for-business-config-id
META_REDIRECT_URI=https://api.botflow.ink/api/channels/whatsapp/callback
META_WHATSAPP_REDIRECT_URI=https://api.botflow.ink/api/channels/whatsapp/callback
META_VERIFY_TOKEN=your-random-webhook-verify-token
TOKEN_ENCRYPTION_KEY=generate-a-64-char-hex-secret-for-aes-256-token-encryption

# n8n automation (required for inbound → AI flow)
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/botflow-whatsapp

# Optional
REDIS_URL=
```

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | **Yes** | PostgreSQL — use **internal** EasyPanel hostname |
| `JWT_SECRET` | **Yes** | Min 32 characters |
| `PORT` | **Yes** | Set to `8000` |
| `CORS_ORIGIN` | **Yes** | Your frontend domain |
| `FRONTEND_URL` | **Yes** | `https://botflow.ink` |
| `TOKEN_ENCRYPTION_KEY` | For Meta channels | 64-char hex (`openssl rand -hex 32`) — app starts without it |
| `META_APP_ID` | For Meta WhatsApp | Meta app ID |
| `META_APP_SECRET` | For Meta WhatsApp | Meta app secret |
| `META_EMBEDDED_SIGNUP_CONFIG_ID` | For Embedded Signup | Facebook Login for Business configuration ID |
| `META_REDIRECT_URI` | For Meta WhatsApp | `https://api.botflow.ink/api/channels/whatsapp/callback` |
| `META_WHATSAPP_REDIRECT_URI` | For Meta WhatsApp OAuth | Same as `META_REDIRECT_URI` |

**Meta App / Facebook Login for Business:** set OAuth redirect URI to exactly:
`https://api.botflow.ink/api/channels/whatsapp/callback`

Do **not** use the legacy `https://api.botflow.ink/meta/callback` — the backend ignores it.
| `META_VERIFY_TOKEN` | For WhatsApp webhooks | Random string — same value in Meta Developer Console |
| `N8N_WEBHOOK_URL` | For AI automation | n8n webhook URL for inbound messages |
| `REDIS_URL` | No | Optional |

## Step 4 — Port & domain

| Setting | Value |
|---------|-------|
| Container port | `8000` |
| Domain | `api.botflow.ink` |

## Step 5 — Deploy & test

1. EasyPanel → backend app → **Deploy** tab
2. Confirm: Branch = **`main`**, Build method = **Dockerfile**, File = `Dockerfile`
3. Click **Deploy** (or enable **Auto Deploy** so every `git push` redeploys)
4. Wait for build to finish (2–5 min) — status must show **Running** (green)
5. Test: `https://api.botflow.ink/health`

Expected response:
```json
{"status":"ok","service":"botflow-api","buildCommit":"v1.0.0-mxxxx","modules":{"channels":true},"timestamp":"..."}
```

`buildCommit` must **not** be `"unknown"` after a successful Docker build. If it is still `unknown`, the container is an old image — redeploy from `main`.

Verify channels routes are live:
```bash
curl -s https://api.botflow.ink/health | jq .modules.channels   # must be true
curl -s -o /dev/null -w "%{http_code}" https://api.botflow.ink/api/channels/whatsapp/connect  # expect 401 (not 404)
```

If `/api/channels/*` returns **404**, the running container is an old image. Check:
1. `buildCommit` in `/health` is not `unknown` and changes after redeploy
2. Redeploy from branch `main` with Dockerfile build method
3. Check `/health` → `config.database` and `config.jwt` are `true`

---

## Ma kaydéployich / Deploy kaycrashi (troubleshooting)

Follow these steps **in order** in EasyPanel:

### 1. Check required env vars

| Variable | How to fix |
|----------|------------|
| `DATABASE_URL` | PostgreSQL service → copy internal URL (`postgres:5432`, not `localhost`) |
| `JWT_SECRET` | Random string, min 32 chars |
| `PORT` | `8000` |

### 2. Read the Logs tab

EasyPanel → your backend → **Logs**. Common errors:

| Log message | Fix |
|-------------|-----|
| `ERROR: DATABASE_URL is not set` | Add `DATABASE_URL` in Environment |
| `Could not connect to PostgreSQL` | Wrong hostname in `DATABASE_URL` — use internal service name |
| `nest: not found` / build error | Branch must be **`main`** |
| Container restarts in a loop | Missing env var — check Logs for `ERROR:` lines |

### 3. Force a clean redeploy

1. Environment → verify all vars above
2. Deploy → branch **`main`**, method **Dockerfile**
3. Click **Deploy** (wait until build + start complete)
4. Status = **Running** before testing

### 4. Verify deploy succeeded

```bash
curl -s https://api.botflow.ink/health
```

- `status: ok` + `modules.channels: true` → backend is live
- `buildCommit: unknown` → old image still running; redeploy again
- EasyPanel 404 on whole domain → app not Running or domain not bound to port 8000

### 5. Enable Auto Deploy (optional)

Deploy tab → **Auto Deploy** ON → every push to `main` triggers a new build automatically.

---

## Common errors & fixes

### EasyPanel 404 on `api.botflow.ink` (entire site down)

This is **not** a webhook bug. EasyPanel returns 404 when **no running app** is bound to the domain.

Fix checklist:
1. EasyPanel → your backend service → status must be **Running** (green)
2. **Domains** tab → `api.botflow.ink` must point to this service on port **8000**
3. **Deploy** tab → branch = `main`, build method = **Dockerfile**
4. **Logs** tab → check for crash (`DATABASE_URL`, `JWT_SECRET`, Postgres connection)
5. Test: `https://api.botflow.ink/health` must return JSON **before** configuring Meta webhook
6. Only after `/health` works → configure `https://api.botflow.ink/api/channels/whatsapp/webhook` in Meta

### `ERROR: DATABASE_URL is not set`
→ Add PostgreSQL service and set `DATABASE_URL` in Environment, then redeploy.

### `Can't reach database server` / `Could not connect to PostgreSQL`
→ Use EasyPanel **internal** Postgres hostname (e.g. `postgres` or your service name), **not** `localhost`.
→ Make sure the PostgreSQL service is running before deploying the backend.
→ The entrypoint retries up to 30 times (3s apart) — if it still fails, the hostname or password is wrong.

### `ERROR: JWT_SECRET is not set`
→ Add `JWT_SECRET` with at least 32 characters.

### Build fails: `nest build` / `Killed` / `context canceled`

EasyPanel VPS ran out of memory during Docker build. This repo uses **SWC** (`nest build` via `.swcrc`) instead of slow `tsc` to keep RAM under ~512MB.

Redeploy from latest `main`. If it still fails, increase EasyPanel build memory or build on a machine with 2GB+ RAM.

### Build fails: `nest: not found`
→ Branch must be **`main`** (NestJS). Old branches use Express only.

### Build fails: `Dockerfile not found`
→ Branch must be **`main`**, not empty `Initial commit`.

### `prisma db push` fails / P1001
→ PostgreSQL is not running or `DATABASE_URL` is wrong. Check Postgres service is up.

### App builds but crashes immediately
→ Check **Logs** in EasyPanel. Usually missing `DATABASE_URL` or `JWT_SECRET`.
→ Run `curl -s https://api.botflow.ink/health` and check `config.database` / `config.jwt`.

### WhatsApp webhook not working
→ Set `META_VERIFY_TOKEN` in EasyPanel **and** Meta Developer Console (same value).
→ Webhook URL: `https://api.botflow.ink/api/channels/whatsapp/webhook`
→ Subscribe fields: `messages`, `message_status`, `message_template_status_update`, `phone_number_name_update`

### n8n not receiving messages
→ Set `N8N_WEBHOOK_URL` in Environment and redeploy.

---

## Alternative: Build without Docker

If Dockerfile fails, use **Nixpacks** or custom build:

| Setting | Value |
|---------|-------|
| Install | `npm ci` |
| Build | `npm run build` |
| Start | `npx prisma db push --skip-generate && node dist/main.js` |
| Port | `8000` |

Same environment variables as above.

---

## Checklist

- [ ] PostgreSQL service created and **running** in EasyPanel
- [ ] `DATABASE_URL` uses internal Postgres hostname (not localhost)
- [ ] `JWT_SECRET` set (32+ chars)
- [ ] `PORT=8000`
- [ ] Domain `api.botflow.ink` → port 8000
- [ ] Branch **`main`** selected
- [ ] `/health` returns OK
- [ ] `META_VERIFY_TOKEN` set for WhatsApp webhooks
- [ ] `N8N_WEBHOOK_URL` set for AI automation
