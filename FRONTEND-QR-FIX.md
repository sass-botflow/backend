# WhatsApp QR Fix — Qunvert-style flow

## المشكل

- QR ما كيبانش + Cloudflare gateway error
- Backend production مازال قديم (`v1.0.0-mr84xgy9`)
- Frontend كيحاول Evolution بـ URL غلط أولاً → timeout

## الحل (جوج خطوات)

### 1. Frontend — طبّق patches (repo `sass-botflow/frontend`)

```bash
cd /path/to/frontend
bash /path/to/backend/patches/apply-frontend-whatsapp.sh
git add -A
git commit -m "Fix WhatsApp QR: backend-first BFF, instant QR, no infinite loop"
git push origin main
```

EasyPanel → **frontend** → Deploy (4-8 min)

**Environment (frontend)** — واحد فقط:

```env
EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080
EVOLUTION_API_KEY=BotflowEvolution2026SecureKey!
```

احذف: `sass-botflow_botflow-evolution` (hostname غلط)

### 2. Backend — Deploy من main

EasyPanel → **backend** → Source = **GitHub** → `sass-botflow/backend` → `main` → Dockerfile

```env
JWT_SECRET=<32+ chars>
EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080
EVOLUTION_API_KEY=BotflowEvolution2026SecureKey!
DATABASE_URL=postgresql://botflow:botflow@sass-botflow_postgres:5432/postgres?sslmode=disable
```

Deploy 5-10 min.

## شنو تبدّل ف patches

| File | Fix |
|------|-----|
| `whatsapp-bff.ts` | Backend API أولاً، Evolution fallback |
| `evolution-server.ts` | QR parsing v2، timeout 8s، بلا public URL |
| `evolution-bff-service.ts` | Connect يرجع QR مباشرة |
| `use-whatsapp-evolution.ts` | بلا infinite loop، QR من connect |
| `whatsapp-qr-modal.tsx` | يعرض QR فوراً (بحال Qunvert) |

## تحقق

```bash
curl -s https://api.botflow.ink/health
# modules.whatsapp: true

curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.botflow.ink/api/channels/whatsapp/connect
# 401
```

Dashboard → Connect → QR يبان ف modal → Scan → Connected
