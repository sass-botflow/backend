# Site down — FIX URGENT (Darija)

## Diagnosis (daba)

| URL | Status | السبب |
|-----|--------|-------|
| `www.botflow.ink` | **500** | `CLERK_SECRET_KEY` ناقص ف EasyPanel frontend → middleware كيتcrash |
| `api.botflow.ink/health` | **502** | Backend container ma khddamch (env ناقص أو deploy 2s) |
| `/api/health/live` | 200 | Frontend container khddam — المشكل middleware/auth |

---

## FIX 1 — Frontend 500 (5 دقائق)

### Option A — رجّع Clerk env (أسرع)

EasyPanel → **frontend** → **Environment** → تأكد هاد vars **موجودين**:

```env
CLERK_SECRET_KEY=sk_live_...   # من dashboard.clerk.com → API Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
JWT_SECRET=BotflowJwtSecret2026Min32CharsLong!!
NEXT_PUBLIC_APP_URL=https://www.botflow.ink
NEXT_PUBLIC_API_URL=https://api.botflow.ink
```

**Save → Deploy** (استنى 1-3 min)

Verif:
```bash
curl -sI https://www.botflow.ink/en | head -1
# HTTP/2 200  (ماشي 500)
```

### Option B — Patch middleware (ما يcrashش ila Clerk ناقص)

```bash
cd /path/to/sass-botflow/frontend
bash /path/to/sass-botflow/backend/patches/apply-frontend-urgent-500.sh
git add src/proxy.ts
git commit -m "fix: site 500 when Clerk env missing"
git push
```

EasyPanel → frontend → **Rebuild** (Dockerfile.build) أو trigger GitHub Actions `Publish Docker image`

---

## FIX 2 — Backend 502

EasyPanel → **backend** → Source = **GitHub** → `Dockerfile.easypanel` → branch `main` → **Rebuild**

Environment (copy من `easypanel.env.example`):

```env
DATABASE_URL=postgresql://botflow:botflow@sass-botflow_postgres:5432/postgres?sslmode=disable
JWT_SECRET=BotflowJwtSecret2026Min32CharsLong!!
EVOLUTION_API_URL=http://sass-botflow_botflow-evolution:8080
EVOLUTION_API_KEY=BotflowEvolution2026SecureKey!
EVOLUTION_WEBHOOK_URL=https://api.botflow.ink/webhooks/evolution
BACKEND_URL=https://api.botflow.ink
FRONTEND_URL=https://www.botflow.ink
CORS_ORIGIN=https://botflow.ink,https://www.botflow.ink
CACHEBUST=99
```

Deploy khass yاخد **2-5 دقائق** (ماشي 2 ثانية).

Verif:
```bash
curl -s https://api.botflow.ink/health
# {"status":"ok",...}
```

شوف `DEPLOY-MKHDAMCH.md` و `DEPLOY-2-THANIYA.md` ila deploy baqi 2s.

---

## Checklist

- [ ] Frontend `/en` → 200
- [ ] `/login` → redirect أو 200 (ماشي 500)
- [ ] `api.botflow.ink/health` → ok
- [ ] Dashboard → login → channels
