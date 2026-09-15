# Site down — FIX URGENT (Darija)

## Diagnosis (daba)

| URL | Status | السبب |
|-----|--------|-------|
| `www.botflow.ink` | **500** | Clerk keys **ghalatin** f EasyPanel (sk_live ma kaymatchich pk_live, wla nاقص) |
| `api.botflow.ink/health` | **502** | Backend container ma khddamch |
| `/api/health/live` | 200 | Frontend container khddam — ghir auth middleware kaytferq |

**Important:** `botflow.ink` → redirect 308 → `www.botflow.ink` → 500. Normal.

---

## FIX 1 — Frontend 500 (URGENT — 3 d9aya)

### Step 1: Clerk keys

1. Ftl [dashboard.clerk.com](https://dashboard.clerk.com) → **API Keys**
2. Copy **Secret key** (`sk_live_...`) w **Publishable key** (`pk_live_...`)
3. EasyPanel → **sass-botflow** → **frontend** → **Environment**

```env
CLERK_SECRET_KEY=sk_live_XXXXX
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_XXXXX
JWT_SECRET=BotflowJwtSecret2026Min32CharsLong!!
NEXT_PUBLIC_APP_URL=https://www.botflow.ink
NEXT_PUBLIC_API_URL=https://api.botflow.ink
PORT=3000
```

⚠️ **JWT_SECRET** khass ykon **nfs l-value** f backend.

4. **Save** → **Deploy** (stana 2-3 min)

### Step 2: Verif

```bash
curl -sI https://www.botflow.ink/en | head -1
# HTTP/2 200
```

Ila baqi 500 → keys ghalatin. 3awd copy mn Clerk (ma tdirch sk_test f production).

### Step 3 — Patch (ila ma bghitch t3awd Clerk)

```bash
cd /path/to/sass-botflow/frontend
bash /path/to/sass-botflow/backend/patches/apply-frontend-urgent-500.sh
git add src/proxy.ts && git commit -m "fix: site 500 clerk middleware" && git push
```

EasyPanel → frontend → **Rebuild** (GitHub Source + Dockerfile.build) — 5-10 min

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
