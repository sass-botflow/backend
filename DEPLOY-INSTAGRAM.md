# Deploy Instagram backend — Darija (main)

`main` daba fih Instagram OAuth. Follow had l-steps **b tari9a**.

---

## 1. Source (EasyPanel)

**backend** → **Source**:

| Field | Value |
|-------|-------|
| Type | **GitHub** |
| Repo | `sass-botflow/backend` |
| Branch | **`main`** |
| Build | **Dockerfile** |
| Port | **8000** |

> Ma tstعملch **Docker Image** bla Registry — GHCR kayb9a private.

---

## 2. Environment — Instagram only

Copier **kamel** f EasyPanel → Environment → **Save**:

```env
NODE_ENV=production
PORT=8000
DATABASE_URL=postgresql://botflow:botflow@sass-botflow_postgres:5432/postgres?sslmode=disable
JWT_SECRET=BotflowJwtSecret2026Min32CharsLong!!

META_APP_ID=YOUR_META_APP_ID
META_APP_SECRET=YOUR_META_APP_SECRET
META_REDIRECT_URI=https://api.botflow.ink/api/auth/instagram/callback
META_GRAPH_API_VERSION=v21.0

BACKEND_URL=https://api.botflow.ink
FRONTEND_URL=https://www.botflow.ink
CORS_ORIGIN=https://botflow.ink,https://www.botflow.ink
```

`JWT_SECRET` = **nfs l-value** f frontend.

Meta Developer Console → Valid OAuth Redirect URIs:
```
https://api.botflow.ink/api/auth/instagram/callback
```

---

## 3. Deploy

1. **Deploy** → استنى **5–10 دقائق** (build mn GitHub)
2. **Logs** → خاصك تشوف:
   ```
   ==> BotFlow API starting
   META OAuth configured: true
   BotFlow API running on port 8000
   ```

---

## 4. Verif

```bash
curl -s https://api.botflow.ink/health
```

```json
{
  "status": "ok",
  "modules": { "instagram": true },
  "config": { "meta": { "oauth": true } }
}
```

---

## Connect Instagram

```
https://api.botflow.ink/api/auth/instagram?token=USER_JWT_TOKEN
```

---

## Ila mazal 502

| Log | Fix |
|-----|-----|
| `ERROR: JWT_SECRET` | Zid JWT_SECRET (32+ chars) |
| `Configure WhatsApp OR Instagram` | Zid META_APP_ID/SECRET/REDIRECT_URI |
| `Could not connect to PostgreSQL` | DATABASE_URL hostname = `sass-botflow_postgres` |
| Deploy 5 thwayeq + 502 | Source = GitHub+Dockerfile (mashi Docker Image) |

Sift screenshot **Logs** (20 سطر).
