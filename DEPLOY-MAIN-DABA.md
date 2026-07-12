# Deploy backend DABA — ila ma9drtch (Darija)

> **api.botflow.ink down / 522?** Backend container crashed or ma deployach. Follow **Option 1** below.

---

## Option 1 — GitHub Build (BLA GHCR) ✅ الأضمن

**Ma kayhtajch pull image.** EasyPanel كيبني من GitHub مباشرة.

1. EasyPanel → **sass-botflow** → **backend** → **Source**
2. Type = **GitHub** (ماشي Docker Image)
3. Repo: `sass-botflow/backend` | Branch: **`main`** | **Dockerfile**
4. Port: **8000** | Domain: `api.botflow.ink`
5. **Environment** — copier `easypanel.env.example`:

```env
NODE_ENV=production
PORT=8000
DATABASE_URL=postgresql://botflow:botflow@sass-botflow_postgres:5432/postgres?sslmode=disable
JWT_SECRET=BotflowJwtSecret2026Min32CharsLong!!
EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080
EVOLUTION_API_KEY=BotflowEvolution2026SecureKey!
EVOLUTION_WEBHOOK_URL=https://api.botflow.ink/webhooks/evolution
BACKEND_URL=https://api.botflow.ink
FRONTEND_URL=https://www.botflow.ink
CORS_ORIGIN=https://botflow.ink,https://www.botflow.ink
```

6. **احذف:** `META_*`, `TOKEN_ENCRYPTION_KEY`
7. **Deploy** → استنى **5-10 دقائق** (build حقيقي)
8. Logs → خاصك تشوف `BotFlow API starting`

---

## Option 2 — GHCR + Registry PAT

Ila bghiti Docker Image:

1. GitHub → Settings → Tokens → PAT → scope `read:packages`
2. EasyPanel → backend → **Registry**: `ghcr.io` | Username = **GitHub username ديالك** | Password = PAT
3. Source = **Docker Image** → `ghcr.io/sass-botflow/backend:latest`
4. Deploy

---

## Option 3 — GHCR Public (مرة واحدة)

https://github.com/orgs/sass-botflow/packages → **backend** → **Public**

---

## تحقق

```bash
curl -s https://api.botflow.ink/health
# status: ok

curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.botflow.ink/api/channels/whatsapp/connect
# 401
```

---

## Ila container kaycrash

| Log | الحل |
|-----|------|
| `ERROR: JWT_SECRET` | زيد JWT_SECRET (32+ chars) |
| `ERROR: EVOLUTION_API_KEY` | زيد EVOLUTION_API_KEY |
| `Could not connect to PostgreSQL` | DATABASE_URL hostname غلط |
| `Killed` f build | استعمل **Option 1** (GitHub build) |
