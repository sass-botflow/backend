# Production fix — "Cannot POST /api/channels/whatsapp/connect"

## المشكل / Le problème

Frontend kay affichi:
```
Cannot POST /api/channels/whatsapp/connect
```

**السبب:** Production backend mazal 3la image قديمة (`buildCommit: v1.0.0-mr84xgy9`).  
Had route ma kaynach f l-code القديم (Meta Embedded Signup).  
L-code الجديد (Evolution API QR) deja f `main` walakin **ma tdeployach** f EasyPanel.

## تحقق / Vérification

```bash
curl -s https://api.botflow.ink/health | python3 -m json.tool
bash scripts/verify-whatsapp-stack.sh
```

| إذا شفتي | المعنى |
|---------|--------|
| `buildCommit: v1.0.0-mr84xgy9` | Backend قديم — خاصك redeploy |
| `modules.channels: true` | Backend قديم (Meta) |
| `modules.whatsapp: true` | Backend جديد (Evolution) ✓ |
| `config.meta` موجود | Backend قديم |
| POST `/connect` → **404** | Backend قديم |
| POST `/connect` → **401** | Backend جديد ✓ (JWT مطلوب) |

---

## الحل — 3 خطوات ف EasyPanel

### 1. GHCR image — خليها Public (مرة واحدة)

1. GitHub → `sass-botflow` org → **Packages** → `backend`
2. **Package settings** → **Change visibility** → **Public**

بلا هادشي EasyPanel ما يقدرش يpull `ghcr.io/sass-botflow/backend:latest`.

### 2. Deploy backend جديد

EasyPanel → project `sass-botflow` → service **backend**:

1. **Source** → **Docker Compose**
2. Paste contenu dyal `easypanel.docker-compose.yml` (من repo)
3. **Environment** — تأكد هاد المتغيرات:

```env
JWT_SECRET=<32+ chars>
EVOLUTION_API_KEY=<نفس AUTHENTICATION_API_KEY ديال Evolution>
```

4. **Deploy** (خاصو ياخد 1–2 دقيقة، ماشي 5 ثواني)

### 3. Evolution API — نفس API key

EasyPanel → service **evolution-api**:

```env
SERVER_URL=https://evolution.api.botflow.ink
AUTHENTICATION_API_KEY=<نفس القيمة ف backend EVOLUTION_API_KEY>
```

Backend kayتصل بـ Evolution داخليًا:
```env
EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080
```

---

## بعد Deploy — تحقق

```bash
curl -s https://api.botflow.ink/health
# buildCommit: git sha جديد (ماشي v1.0.0-mr84xgy9)
# modules.whatsapp: true
# whatsappReady: true

curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.botflow.ink/api/channels/whatsapp/connect
# 401 (ماشي 404)
```

## Flow ديال المستخدم (بعد fix)

1. Frontend → **Connect WhatsApp** → `POST /api/channels/whatsapp/connect`
2. `GET /api/channels/whatsapp/:id/qr` → QR code
3. User kayscan QR b WhatsApp
4. `GET /api/channels/whatsapp/:id/status` → `CONNECTED`

---

## Auto-deploy (اختياري)

GitHub → `sass-botflow/backend` → Settings → Secrets:

```
EASYPANEL_BACKEND_DEPLOY_WEBHOOK=<Deploy Hook URL من EasyPanel>
```

بعدها كل push لـ `main` كيdeploy تلقائيًا.
