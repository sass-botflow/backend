# EasyPanel Deploy — خطوة بخطوة

**المشكل:** `Cannot POST /api/channels/whatsapp/connect` أو deploy kayfail.

**السبب:** Backend قديم (`buildCommit: v1.0.0-mr84xgy9`) — خاصك deploy image جديدة.

---

## الطريقة 1 — GitHub + Dockerfile (الأسهل ✅)

**ما تحتاجش GHCR public.** EasyPanel كيبني من GitHub مباشرة.

### الخطوات

1. **EasyPanel** → project `sass-botflow` → service **backend**

2. **Source** → اختار **GitHub** (ماشي Docker Image ولا Docker Compose)
   - Repository: `sass-botflow/backend`
   - Branch: **`main`**
   - Build method: **Dockerfile**
   - Dockerfile path: `/Dockerfile`
   - Port: **`8000`**

3. **Environment** → copy من `easypanel.env.example` وبدّل:
   ```
   JWT_SECRET=<32+ chars عشوائية>
   EVOLUTION_API_KEY=<نفس AUTHENTICATION_API_KEY ديال Evolution>
   ```

4. **Deploy** → استنى **5–10 دقائق** (build حقيقي)
   - إلا deploy خدا 5 ثواني = restart فقط، ماشي rebuild
   - شوف **Logs** → خاصك تشوف `npm run build` و `BotFlow API Startup`

5. **تحقق:**
   ```bash
   curl -s https://api.botflow.ink/health
   # modules.whatsapp: true
   # buildCommit: ماشي v1.0.0-mr84xgy9
   ```

### إلا container kaycrash (restart loop)

شوف **Logs** — غالبًا ناقص env:

| Log | الحل |
|-----|------|
| `ERROR: JWT_SECRET is not set` | زيد JWT_SECRET (32+ chars) |
| `ERROR: EVOLUTION_API_KEY is not set` | زيد EVOLUTION_API_KEY |
| `ERROR: EVOLUTION_API_URL is not set` | زيد EVOLUTION_API_URL |
| `Could not connect to PostgreSQL` | بدّل DATABASE_URL بـ hostname داخلي |

---

## الطريقة 2 — GHCR Docker Image (أسرع، 1–2 دقيقة)

Image: `ghcr.io/sass-botflow/backend:latest`

### إلا GHCR private (401)

**Option A** — خلي package public (مرة واحدة):
1. https://github.com/orgs/sass-botflow/packages
2. **backend** → Package settings → **Change visibility** → **Public**

**Option B** — Registry credentials ف EasyPanel:
1. backend → **Registry** (أو Settings)
2. URL: `ghcr.io`
3. Username: GitHub username ديالك
4. Password: GitHub PAT بـ scope `read:packages`

### Docker Compose

1. Source → **Docker Compose**
2. Paste contenu `easypanel.docker-compose.yml`
3. Environment: `JWT_SECRET`, `EVOLUTION_API_KEY`
4. Deploy

---

## Evolution API (خدمة منفصلة)

Deploy `deploy/evolution-api/docker-compose.yml` كـ service جديد:

```env
SERVER_URL=https://evolution.api.botflow.ink
AUTHENTICATION_API_KEY=<نفس EVOLUTION_API_KEY ف backend>
```

Backend كيتصل داخليًا: `http://sass-botflow_evolution-api:8080`

---

## Checklist قبل Deploy

- [ ] Branch = **`main`**
- [ ] `JWT_SECRET` set (32+ chars)
- [ ] `EVOLUTION_API_KEY` = نفس Evolution `AUTHENTICATION_API_KEY`
- [ ] `DATABASE_URL` = hostname داخلي EasyPanel
- [ ] Evolution API service running
- [ ] Deploy خدا 5+ دقائق (GitHub build) أو 1–2 دقيقة (GHCR pull)

## بعد Deploy

```bash
bash scripts/verify-whatsapp-stack.sh
```

| Result | معنى |
|--------|------|
| `POST /connect → 401` | ✅ Backend جديد خدام |
| `POST /connect → 404` | ❌ Backend قديم — redeploy |
| `whatsappReady: true` | ✅ Evolution configured |

---

## Auto-deploy (اختياري)

GitHub → `sass-botflow/backend` → Settings → Secrets:

```
EASYPANEL_BACKEND_DEPLOY_WEBHOOK=<Deploy Hook URL من EasyPanel>
```
