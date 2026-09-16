# DEPLOY DABA — 502 fix (Darija, 3 steps)

**502 = backend ma khadamch.** Dir hadchi b tartib:

---

## 1. Kill deploy 9dim

EasyPanel → **backend** → **Deployments** → **Kill** (ila kayn chi haja running)

---

## 2. Source (copy exact)

EasyPanel → **backend** → **Source**:

| | |
|---|---|
| Type | **GitHub** |
| Repo | `sass-botflow/backend` |
| Branch | **`main`** |
| Dockerfile | **`/Dockerfile.easypanel`** |
| Port | **8000** |

**Save**

---

## 3. Environment (copy-paste → Save)

```env
NODE_ENV=production
PORT=8000
DATABASE_URL=postgresql://botflow:botflow@sass-botflow_postgres:5432/postgres?sslmode=disable
JWT_SECRET=BotflowJwtSecret2026Min32CharsLong!!
EVOLUTION_API_URL=http://sass-botflow_botflow-evolution:8080
EVOLUTION_API_KEY=BotflowEvolution2026SecureKey!
EVOLUTION_WEBHOOK_URL=https://api.botflow.ink/webhooks/evolution
BACKEND_URL=https://api.botflow.ink
FRONTEND_URL=https://www.botflow.ink
CORS_ORIGIN=https://botflow.ink,https://www.botflow.ink
```

**احذف** kolchi `META_*` ila ma bghitch Instagram.

---

## 4. Deploy

**Deploy** → khass **1-3 d9aya** (download bundle, ma npm ci)

Logs khass:
```
==> [1/2] download runtime-full...
==> BotFlow API starting
==> Starting server on port 8000...
```

---

## 5. Test

https://api.botflow.ink/health → **200** (mashi 502)

Ila mazal 502 → sift screenshot **Logs** (30 sطر).
