# EasyPanel Deployment Guide — BotFlow Backend

Deploy `api.botflow.ink` on port **8000**.

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
| `META_APP_ID` | For WhatsApp | Meta app ID |
| `META_APP_SECRET` | For WhatsApp | Meta app secret |
| `META_REDIRECT_URI` | For WhatsApp | `https://api.botflow.ink/api/channels/whatsapp/callback` |
| `META_WHATSAPP_REDIRECT_URI` | For WhatsApp OAuth | Same as `META_REDIRECT_URI` |
| `TOKEN_ENCRYPTION_KEY` | **Yes** | 32-byte AES key (64-char hex) for encrypting WhatsApp tokens |
| `META_VERIFY_TOKEN` | For WhatsApp webhooks | Random string — same value in Meta Developer Console |
| `N8N_WEBHOOK_URL` | For AI automation | n8n webhook URL for inbound messages |
| `REDIS_URL` | No | Optional |

## Step 4 — Port & domain

| Setting | Value |
|---------|-------|
| Container port | `8000` |
| Domain | `api.botflow.ink` |

## Step 5 — Deploy & test

1. Click **Deploy**
2. Wait for build to finish (2–5 min)
3. Test: `https://api.botflow.ink/health`

Expected response:
```json
{"status":"ok","service":"botflow-api","timestamp":"..."}
```

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
6. Only after `/health` works → configure `https://api.botflow.ink/webhooks/meta` in Meta

### `ERROR: DATABASE_URL is not set`
→ Add PostgreSQL service and set `DATABASE_URL` in Environment, then redeploy.

### `Can't reach database server` / `Could not connect to PostgreSQL`
→ Use EasyPanel **internal** Postgres hostname (e.g. `postgres` or your service name), **not** `localhost`.
→ Make sure the PostgreSQL service is running before deploying the backend.
→ The entrypoint retries up to 30 times (3s apart) — if it still fails, the hostname or password is wrong.

### `ERROR: JWT_SECRET is not set`
→ Add `JWT_SECRET` with at least 32 characters.

### Build fails: `nest: not found`
→ Branch must be **`main`** (NestJS). Old branches use Express only.

### Build fails: `Dockerfile not found`
→ Branch must be **`main`**, not empty `Initial commit`.

### `prisma db push` fails / P1001
→ PostgreSQL is not running or `DATABASE_URL` is wrong. Check Postgres service is up.

### App builds but crashes immediately
→ Check **Logs** in EasyPanel. Usually missing `DATABASE_URL` or `JWT_SECRET`.

### WhatsApp webhook not working
→ Set `META_VERIFY_TOKEN` in EasyPanel **and** Meta Developer Console (same value).
→ Webhook URL: `https://api.botflow.ink/webhooks/meta`

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
