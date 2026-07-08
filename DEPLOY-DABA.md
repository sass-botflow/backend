# Deploy DABA — Backend (2 dakika)

**Ma9drtch deploy?** → **[DEPLOY-M9DRTCH.md](./DEPLOY-M9DRTCH.md)** (3 طرق + troubleshooting)

Production mazal 3la `buildCommit: v1.0.0-mr84xgy9` → WhatsApp ma khdemch.

---

## Tariqa 1 — GHCR Image ✅ (الأسهل — image deja mبنية)

شوف **DEPLOY-M9DRTCH.md → Tariqa 1** (GHCR public + Docker Image)

---

## Tariqa 2 — EasyPanel GitHub Build

1. **http://187.124.12.89:3000** → **sass-botflow** → **backend** → **Source**
2. Type = **GitHub** → `sass-botflow/backend` → branch **`main`** → **Dockerfile**
3. Port = **8000** | Domain = `api.botflow.ink`
4. **Environment** — copier `easypanel.env.example` (bلا Meta):

```env
NODE_ENV=production
PORT=8000
DATABASE_URL=postgresql://botflow:botflow@sass-botflow_postgres:5432/postgres?sslmode=disable
JWT_SECRET=<secret 32+ chars>
EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080
EVOLUTION_API_KEY=BotflowEvolution2026SecureKey!
EVOLUTION_WEBHOOK_URL=https://api.botflow.ink/webhooks/evolution
BACKEND_URL=https://api.botflow.ink
FRONTEND_URL=https://www.botflow.ink
CORS_ORIGIN=https://botflow.ink,https://www.botflow.ink
N8N_WEBHOOK_URL=https://ecomgcc21.app.n8n.cloud/webhook/0edc08c4-6908-43ce-8f9f-dbc5ace31958
```

5. **احذف:** `META_*`, `TOKEN_ENCRYPTION_KEY`, `redirect_uri`
6. **Deploy** → stana **5-10 d9aya** (build mn GitHub)
7. Test:

```bash
curl -s https://api.botflow.ink/health
# modules.whatsapp: true
# buildCommit: ماشي v1.0.0-mr84xgy9

curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.botflow.ink/api/channels/whatsapp/connect
# 401 (ماشي 404)
```

---

## Tariqa 2 — Webhook (1 klik)

1. EasyPanel → **backend** → **Deployments** → copier **Deployment Trigger** URL
2. GitHub → **Actions** → **Deploy backend now** → **Run workflow**
3. Paste webhook URL → Run
4. Chouf result f Actions summary

---

## Tariqa 3 — GHCR Image (b3d ma dir package public)

1. GitHub → Packages → `backend` → **Public**
2. EasyPanel Source = **Docker Compose** → paste `easypanel.docker-compose.yml`
3. Deploy

---

## Ila ba9i kayfail

| Symptom | Hal |
|---------|-----|
| Deploy 5 thaniya | Source = GitHub mashi restart |
| `buildCommit` ma tbdlch | Clear cache + redeploy |
| Container restart loop | Logs → `JWT_SECRET` / `EVOLUTION_API_KEY` na9sin |
| `POST /connect` → 404 | Image 9dima — redeploy men `main` |
