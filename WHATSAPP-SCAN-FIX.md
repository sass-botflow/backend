# WhatsApp Scan / QR — 7l "Evolution API offline" (Darija)

Screenshot dyalek = **Backend 502** + Evolution ma reachable-ch.

---

## السبب (daba)

| Service | Status |
|---------|--------|
| `api.botflow.ink` | **502 DOWN** |
| Frontend → backend | `reachable: false` |
| Evolution URL ghalet | `https://evolution.api.botflow.ink` (ma kaynch) |

**Bla backend + Evolution, QR ma kaybanch.**

---

## Fix — 3 services f EasyPanel

### 1. Backend (أهم حاجة)

**Source:** GitHub → `sass-botflow/backend` → `main` → **Dockerfile**  
**Port:** 8000

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

**Deploy** → 5–10 d9ayeq → Logs: `BotFlow API starting`

### 2. Evolution API

EasyPanel → **botflow-evolution** (wla evolution-api) → **Start** / Deploy

```env
AUTHENTICATION_API_KEY=BotflowEvolution2026SecureKey!
SERVER_URL=https://evolution.api.botflow.ink
```

Verify internal: `http://sass-botflow_evolution-api:8080`

### 3. Frontend

**Environment — واحد فقط (احذف evolution.api.botflow.ink):**

```env
EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080
EVOLUTION_API_KEY=BotflowEvolution2026SecureKey!
```

Apply patches:
```bash
bash patches/apply-frontend-whatsapp.sh /path/to/frontend
```

**Deploy** frontend.

---

## Verif

```bash
curl -s https://api.botflow.ink/health
```

Khass:
```json
{
  "status": "ok",
  "whatsappReady": true,
  "evolutionReachable": true,
  "deployOk": true
}
```

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.botflow.ink/api/channels/whatsapp/connect
# 401 (mashi 404 wla 502)
```

---

## Flow

1. Dashboard → Channels → **Connect**
2. QR kayban f modal
3. WhatsApp → Linked Devices → Scan
4. Connected ✅

---

## Ila mazal error

| Error f UI | Fix |
|------------|-----|
| **Backend API offline** | Redeploy backend (step 1) |
| **Evolution API offline** | Start evolution service (step 2) |
| Generating QR... forever | Backend 502 — step 1 |

Sift screenshot Logs dyal **backend** + **evolution**.
