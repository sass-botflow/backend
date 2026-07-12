# Deploy ma ki drch? — 3 dakika

`api.botflow.ink` = **502** → backend ma deployach wla container kaycrash.

---

## 1. Source (أهم حاجة)

EasyPanel → **backend** → **Source**

| غلط ❌ | صح ✅ |
|--------|------|
| Docker Image بلا Registry | **GitHub** → `sass-botflow/backend` → `main` → **Dockerfile** |
| Docker Compose قديم | GitHub + Dockerfile |
| GHCR pull 401 | GitHub + Dockerfile (ما kayhtajch GHCR) |

Port: **8000** | Domain: `api.botflow.ink`

---

## 2. Environment (copier كامل)

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

**احذف:** `META_*`, `TOKEN_ENCRYPTION_KEY`, `redirect_uri`

`JWT_SECRET` = **نفس القيمة** ف frontend.

---

## 3. Deploy

1. **Save** Environment
2. **Deploy** → استنى **5–10 دقائق** (build)
3. Logs → خاصك تشوف:
   ```
   ==> BotFlow API starting
   ==> Database schema synced.
   ```

إلا deploy خدا **5 ثواني** = restart فقط — بدّل Source لـ GitHub + Dockerfile.

---

## 4. تحقق

```bash
curl -s https://api.botflow.ink/health
```

خاصو:
- `"status":"ok"`
- `"modules":{"whatsapp":true}`
- `buildCommit` ماشي `v1.0.0-mr84xgy9`

---

## Ila ba9i ma khdemch

| Log | الحل |
|-----|------|
| `ERROR: JWT_SECRET` | زيد JWT_SECRET (32+ chars) |
| `ERROR: EVOLUTION_API_KEY` | زيد EVOLUTION_API_KEY |
| `Could not connect to PostgreSQL` | `sass-botflow_postgres` ف DATABASE_URL |
| `Killed` / build fail | VPS RAM قليل — جرب GHCR (تحت) |
| Pull 401 | GitHub+Dockerfile ولا GHCR public |

### GHCR (إلا GitHub build kayfail)

1. https://github.com/orgs/sass-botflow/packages → **backend** → **Public**
2. Source = Docker Image → `ghcr.io/sass-botflow/backend:latest`
3. Deploy (1–2 min)

---

## صيفط ليا

Screenshot: Source + Logs (آخر 20 سطر)
