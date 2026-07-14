# Deploy ma khdamch? — 7l daba (Darija)

**Daba:** `api.botflow.ink` = **502 DOWN** → backend ma deployach / container crashed.

---

## 3 أسباب لي كيخلو Deploy "ما كيوقع والو"

| Symptom | السبب | الحل |
|---------|-------|------|
| Deploy خدا **5-10 ثواني** | Restart فقط — **ماشي rebuild** | بدّل Source لـ **GitHub + Dockerfile** |
| `buildCommit: v1.0.0-mr84xgy9` | Image **9dima** | Redeploy b tariqa s7i7a (تحت) |
| Pull denied / 401 | GHCR **private** | GitHub Build **ولا** Registry PAT |
| Logs: `ERROR: Missing` | Env **ناقص** | Copy env mn تحت → Save → Deploy |
| Logs: `Killed` f build | VPS **RAM قليل** | GitHub Build (Option 1) |

---

## Option 1 — GitHub Build ✅ (الأضمن — bla GHCR)

**Ma kayhtajch pull image.** EasyPanel كيبني mn GitHub.

### Step 1 — ربط GitHub (مرة واحدة)

1. EasyPanel → **Settings** (فوق) → **GitHub** → **Connect**
2. Authorize org **sass-botflow**
3. خاصك تشوف `sass-botflow/backend` f liste

### Step 2 — Source

1. EasyPanel → **sass-botflow** → **backend** → **Source**
2. Type = **GitHub** (ماشي Docker Image!)
3. Repo: `sass-botflow/backend`
4. Branch: **`main`**
5. Build: **Dockerfile** (`/Dockerfile`)
6. Port: **8000**
7. Domain: `api.botflow.ink` → port 8000

### Step 3 — Environment (COPY-PASTE)

**احذف kolchi 9dim** w paste hado:

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

**احذف هادو** (كيcrashiw deploy):
```
META_APP_ID
META_APP_SECRET
META_REDIRECT_URI
META_EMBEDDED_SIGNUP_CONFIG_ID
META_VERIFY_TOKEN
TOKEN_ENCRYPTION_KEY
```

**Save** Environment.

### Step 4 — Deploy

1. كليكي **Deploy** (أو **Rebuild**)
2. **استنى 5-10 دقائق** — build حقيقي khass ybda
3. شوف **Logs** → خاصك تشوف:
   ```
   ==> BotFlow API starting
   ==> Build Commit: <sha جديد>
   ==> Database schema synced.
   ==> Starting server on port 8000...
   ```

### Step 5 — Verif

```bash
curl -s https://api.botflow.ink/health
```

Khass:
```json
{
  "status": "ok",
  "buildCommit": "ماشي v1.0.0-mr84xgy9",
  "whatsappReady": true,
  "deployOk": true
}
```

---

## Option 2 — GHCR Image (ila GitHub build kayfail)

Image kaynin f GitHub Actions ✅ — walakin **GHCR private** (401).

### Hal A — Registry PAT (5 min)

1. GitHub → https://github.com/settings/tokens → **Generate token (classic)**
2. Scope: **`read:packages`** فقط
3. EasyPanel → backend → **Registry**:
   | Champ | Valeur |
   |-------|--------|
   | URL | `ghcr.io` |
   | Username | **GitHub username ديالك** |
   | Password | Token |
4. Source = **Docker Image** → `ghcr.io/sass-botflow/backend:latest`
5. Port = **8000**
6. Environment = nfs Option 1
7. **Deploy** → 1-2 d9aya

### Hal B — GHCR Public (مرة واحدة)

1. https://github.com/orgs/sass-botflow/packages
2. **backend** → Package settings → **Change visibility** → **Public**
3. Verify:
   ```bash
   curl -sI https://ghcr.io/v2/sass-botflow/backend/manifests/latest | head -1
   # HTTP/2 200
   ```
4. Source = Docker Image `ghcr.io/sass-botflow/backend:latest` → Deploy

---

## Option 3 — Webhook (1 klik)

1. EasyPanel → backend → **Deployments** → copier **Deployment Trigger** URL
2. https://github.com/sass-botflow/backend/actions/workflows/deploy-now.yml
3. **Run workflow** → paste URL → Run
4. **مهم:** Source = Docker Image (Option 2) **ولا** GitHub Build (Option 1)

---

## Ila container kaycrash (restart loop)

شوف **Logs** f EasyPanel:

| Log | الحل |
|-----|------|
| `ERROR: Missing ... JWT_SECRET` | زيد JWT_SECRET (32+ chars) → Save → Deploy |
| `ERROR: Missing ... EVOLUTION` | زيد EVOLUTION_API_URL + EVOLUTION_API_KEY |
| `Partial META_* vars` | احذف kolchi META_* → Save → Deploy |
| `Could not connect to PostgreSQL` | شغّل postgres service + verify DATABASE_URL |
| `prisma db push failed` | Postgres ma خدامش — Start postgres أولاً |
| `Killed` pendant build | VPS RAM قليل → Option 1 (GitHub build) |

---

## Checklist سريع

- [ ] Source = **GitHub + Dockerfile** (ماشي Docker Image 9dim)
- [ ] Branch = **`main`**
- [ ] Port = **8000**
- [ ] `JWT_SECRET` set (32+ chars)
- [ ] `EVOLUTION_API_KEY` = نفس Evolution `AUTHENTICATION_API_KEY`
- [ ] `META_*` **محذوفة** (ila bghiti WhatsApp فقط)
- [ ] Postgres service **running**
- [ ] Evolution API service **running**
- [ ] Deploy خدا **5+ دقائق** (build) ولا **1-2 دقيقة** (image pull)

---

## بعد ما backend يخدم

1. Frontend env: `EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080`
2. Apply WhatsApp patches: `bash patches/apply-frontend-whatsapp.sh`
3. Dashboard → Channels → Connect → Scan QR

شوف: `WHATSAPP-SCAN-FIX.md`

---

## Sift screenshot

Ila mazal ma khdemch, sift:
1. EasyPanel → backend → **Source** (screenshot)
2. **Environment** (blur secrets)
3. **Logs** (آخر 30 سطر)
