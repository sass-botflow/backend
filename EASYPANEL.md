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
2. Branch: **`main`**
3. Build method: **Dockerfile** (uses `/Dockerfile` in repo root)

## Step 3 — Environment variables

In EasyPanel → your backend app → **Environment**:

```env
NODE_ENV=production
PORT=8000
DATABASE_URL=postgresql://botflow:YOUR_PASSWORD@YOUR_POSTGRES_SERVICE:5432/botflow
JWT_SECRET=put-a-long-random-secret-at-least-32-characters
CORS_ORIGIN=https://botflow.ink,https://www.botflow.ink
REDIS_URL=
```

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | Min 32 characters |
| `PORT` | Yes | Set to `8000` |
| `CORS_ORIGIN` | Yes | Your frontend domain |
| `REDIS_URL` | No | Optional for now |
| `META_APP_ID` | For WhatsApp OAuth | Meta app ID |
| `META_APP_SECRET` | For WhatsApp OAuth | Meta app secret |
| `META_OAUTH_REDIRECT_URI` | For WhatsApp OAuth | `https://api.botflow.ink/api/integrations/whatsapp/oauth/callback` |
| `FRONTEND_URL` | For WhatsApp OAuth | `https://botflow.ink` |

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

### `ERROR: DATABASE_URL is not set`
→ Add PostgreSQL service and set `DATABASE_URL` in Environment, then redeploy.

### `Can't reach database server`
→ Use EasyPanel **internal** Postgres hostname (e.g. `postgres` or your service name), not `localhost`.

### `ERROR: JWT_SECRET is not set`
→ Add `JWT_SECRET` with at least 32 characters.

### Build fails: `nest: not found`
→ Make sure branch is `main` (NestJS version). Old branches use Express only.

### Build fails: `Dockerfile not found`
→ Branch must be `main`, not empty `Initial commit`.

### `prisma db push` fails / P1001
→ PostgreSQL is not running or `DATABASE_URL` is wrong. Check Postgres service is up.

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

- [ ] PostgreSQL service created in EasyPanel
- [ ] `DATABASE_URL` points to internal Postgres host
- [ ] `JWT_SECRET` set (32+ chars)
- [ ] `PORT=8000`
- [ ] Domain `api.botflow.ink` → port 8000
- [ ] Branch `main` selected
- [ ] `/health` returns OK
