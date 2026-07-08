# Ma9drtch ndir deploy backend? — 3 طرق (واحدة غادي تخدم)

Production daba: `buildCommit: v1.0.0-mr84xgy9` → backend **9dim** → WhatsApp QR ma khdemch.

**Image jdid deja kayn f GitHub Actions** (`Build and Push Backend Image` ✅) — khass ghir EasyPanel **ijbedha**.

---

## شنو كيوقع غالبًا؟

| إلا شفتي هادشي | المعنى |
|----------------|--------|
| Deploy خدا **5–10 ثواني** | Restart فقط — **ماشي rebuild** |
| `buildCommit` ma tbdlch | Image 9dima mazal خدامة |
| Logs: `ERROR: JWT_SECRET` | Env ناقص — container kaycrash |
| Logs: `Killed` / `nest build` | VPS ma عندوش RAM — استعمل **Tariqa 1** (GHCR) |
| Pull failed **401** | GHCR private — dir **Public** (Tariqa 1 خطوة 1) |
| Source = Docker Image قديم | بدّل لـ `ghcr.io/sass-botflow/backend:latest` |

---

## Tariqa 1 — GHCR Image ✅ (الأسهل إلا GitHub build kayfail)

**ما كتبنيش على VPS** — GitHub كيبني image و EasyPanel كيجيبها (1–2 دقيقة).

### خطوة 1 — خلي GHCR public (مرة واحدة)

1. دخل: https://github.com/orgs/sass-botflow/packages
2. كليكي على package **backend** (أو `sass-botflow/backend`)
3. **Package settings** → **Change visibility** → **Public** → Confirm

تحقق:
```bash
curl -sI https://ghcr.io/v2/sass-botflow/backend/manifests/latest | head -1
# خاصو: HTTP/2 200  (ماشي 401)
```

### خطوة 2 — EasyPanel

1. http://187.124.12.89:3000 → **sass-botflow** → **backend**
2. **Source** → **Docker Image** (ماشي GitHub ولا Docker Compose)
3. Image:
   ```
   ghcr.io/sass-botflow/backend:latest
   ```
4. Port: **8000**
5. Domain: `api.botflow.ink` → port 8000

### خطوة 3 — Environment (copier وبدّل secrets)

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
N8N_WEBHOOK_URL=https://ecomgcc21.app.n8n.cloud/webhook/0edc08c4-6908-43ce-8f9f-dbc5ace31958
```

**احذف هادو** (9dam Meta — كيcrashiw deploy):
```
META_APP_ID
META_APP_SECRET
META_EMBEDDED_SIGNUP_CONFIG_ID
META_VERIFY_TOKEN
TOKEN_ENCRYPTION_KEY
```

`JWT_SECRET` خاصو **نفس القيمة** ف frontend.

### خطوة 4 — Deploy

1. **Save** Environment
2. **Deploy** → استنى **1–2 دقيقة**
3. **Logs** → خاصك تشوف:
   ```
   ==> Build Commit: b6c69b2...  (ماشي v1.0.0-mr84xgy9)
   ==> BotFlow API starting
   ```

### خطوة 5 — تحقق

```bash
curl -s https://api.botflow.ink/health
# modules.whatsapp: true
# deployOk: true

curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.botflow.ink/api/channels/whatsapp/connect
# 401 (ماشي 404)
```

---

## Tariqa 2 — GitHub + Dockerfile (إلا VPS عندو RAM)

### قبل ما تبدا — ربط GitHub

1. EasyPanel → **Settings** (أعلى) → **GitHub**
2. **Connect GitHub** → authorize **sass-botflow** org
3. خاصك تشوف `sass-botflow/backend` ف liste

### Deploy

1. backend → **Source** → **GitHub**
2. Repo: `sass-botflow/backend` | Branch: **`main`** | **Dockerfile**
3. Environment: نفس Tariqa 1
4. **Deploy** → استنى **5–10 دقائق** (build حقيقي)

إلا build kayfail بـ `Killed` → رجع لـ **Tariqa 1** (GHCR).

---

## Tariqa 3 — Webhook (1 klik من GitHub)

1. EasyPanel → backend → **Deployments** → copier **Deployment Trigger** URL
   ```
   http://187.124.12.89:3000/api/deploy/xxxxxxxx
   ```
2. GitHub → https://github.com/sass-botflow/backend/actions/workflows/deploy-now.yml
3. **Run workflow** → paste webhook URL → Run
4. Workflow كيبني image + كيtrigger deploy

**مهم:** Source خاصو يكون **Docker Image** `ghcr.io/sass-botflow/backend:latest` (Tariqa 1).

---

## Ila container kaycrash (restart loop)

شوف **Logs** ف EasyPanel:

| Log | الحل |
|-----|------|
| `ERROR: JWT_SECRET is not set` | زيد `JWT_SECRET` (32+ chars) → Save → Deploy |
| `ERROR: EVOLUTION_API_KEY is not set` | زيد `EVOLUTION_API_KEY` |
| `Could not connect to PostgreSQL` | `DATABASE_URL` hostname غلط — استعمل `sass-botflow_postgres` |
| `prisma db push failed` | Postgres service ma خدامش — شغّلو أولاً |

---

## Ila ba9i ma khdemch

صيفط ليا screenshot من:
1. EasyPanel → backend → **Source** (شنو مكتوب: GitHub / Docker Image / Compose)
2. **Logs** (آخر 20 سطر)
3. نتيجة: `curl -s https://api.botflow.ink/health`

---

## بعد ما backend يخدم

1. Frontend env: `EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080`
2. طبّق frontend fix: `patches/apply-frontend-minimal-fix.sh` (شوف `FRONTEND-QR-FIX.md`)
3. Dashboard → Connect → QR
