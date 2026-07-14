# Deploy backend — ma khasskch t3ani (Darija)

> **Deploy 2 thaniya / ma khdamch?** → **[DEPLOY-2-THANIYA.md](./DEPLOY-2-THANIYA.md)** ← ابدأ هنا
> **Deploy ma khdamch / 502?** → **[DEPLOY-DABA-URGENT.md](./DEPLOY-DABA-URGENT.md)**

> **L'mochkil:** GitHub kaybni l'image ✅ — walakin EasyPanel ma kaypullach / kayb9a 3la image 9dima (`v1.0.0-mr84xgy9`).
> **L'hal:** 2 dakika — paste URL w deploy.

---

## Option 0 — Deploy DABA (2 min, bla secrets) ✅

> **Ila GHCR kayfail (401):** skip to **DEPLOY-MAIN-DABA.md Option 1** (GitHub Build — bla pull).

### Step 1 — EasyPanel Source (مرة واحدة)

1. http://187.124.12.89:3000 → **sass-botflow** → **backend**
2. **Source** = **Docker Image** (ماشي GitHub)
3. Image: `ghcr.io/sass-botflow/backend:latest`
4. Port: **8000**

### Step 2 — Environment (مرة واحدة)

Copier من `easypanel.env.example` — **احذف META_***:

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

**Save** Environment.

### Step 3 — Copier webhook URL

EasyPanel → **backend** → **Deployments** → **Deployment Trigger**:
```
http://187.124.12.89:3000/api/deploy/xxxxxxxx
```

### Step 4 — Run workflow

1. https://github.com/sass-botflow/backend/actions/workflows/deploy-now.yml
2. **Run workflow** → paste webhook → **Run**

### Step 5 — T2akked

```bash
curl -s https://api.botflow.ink/health
# modules.whatsapp: true
# buildCommit: ماشي v1.0.0-mr84xgy9

curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.botflow.ink/api/channels/whatsapp/connect
# 401
```

---

## Ila kaygol "Pull access denied" / 401 GHCR

Image **private** — jouj hal:

### Hal A — Registry f EasyPanel (bla ma dir public)

1. GitHub → https://github.com/settings/tokens → **Generate new token (classic)**
2. Scope: **`read:packages`** فقط
3. EasyPanel → **backend** → **Registry** (أو Settings):
   | Champ | Valeur |
   |-------|--------|
   | URL | `ghcr.io` |
   | Username | **GitHub username ديالك** (ماشي sass-botflow) |
   | Password | Token li generiti |
4. **Save** → **Deploy**

### Hal B — Dir package public (مرة واحدة)

1. https://github.com/orgs/sass-botflow/packages
2. **backend** → Package settings → **Public**

تحقق:
```bash
curl -sI https://ghcr.io/v2/sass-botflow/backend/manifests/latest | head -1
# HTTP/2 200
```

---

## Option 1 — GitHub Webhook (auto kol push)

1. Copier **Deployment Trigger** URL mn EasyPanel (nfs Step 3)
2. https://github.com/sass-botflow/backend/settings/hooks → **Add webhook**
3. Payload URL = Deployment Trigger URL
4. Content type: `application/json`
5. **SSL verification: Disable**
6. Events: **push**
7. Source f EasyPanel = **Docker Image** `ghcr.io/sass-botflow/backend:latest`

---

## Option 2 — Terminal (mn PC ديالك)

```bash
EASYPANEL_DEPLOY_URL='http://187.124.12.89:3000/api/deploy/xxxxxxxx' \
  ./scripts/deploy-backend-easypanel.sh
```

---

## Erreurs

| Mochkil | Hal |
|---------|-----|
| Deploy 5 thaniya | Source = **Docker Image** ماشي GitHub build |
| `buildCommit` ma tbdlch | Registry 401 → Hal A wla Hal B |
| `ERROR: JWT_SECRET` | زيد env → Save → Deploy |
| `ERROR: EVOLUTION_API_KEY` | زيد env → Save → Deploy |
| Container restart loop | شوف Logs — env ناقص |
| `POST /connect` → 404 | Image 9dima — redeploy |

---

## Sift l'admin (copy-paste)

```
Salam, khass deploy dyal BotFlow backend:

1. EasyPanel → sass-botflow → backend
2. Source = Docker Image: ghcr.io/sass-botflow/backend:latest
3. Port = 8000
4. Environment: JWT_SECRET + EVOLUTION_API_KEY (شوف easypanel.env.example)
5. Ila Pull denied: Registry ghcr.io + GitHub PAT (read:packages)
6. Deploy

Verify: curl https://api.botflow.ink/health → modules.whatsapp: true
```
