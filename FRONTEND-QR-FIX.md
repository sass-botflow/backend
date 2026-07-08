# WhatsApp QR Fix — Qunvert-style flow

## المشكل (screenshot: "Something went wrong" + "Generating QR code...")

Production kayfail 7it:

| Check | Production daba | Khass ykon |
|-------|-----------------|------------|
| `api.botflow.ink/health` → `buildCommit` | `v1.0.0-mr84xgy9` ❌ | git sha jdid |
| `modules` | `channels: true` ❌ | `whatsapp: true` |
| `POST /api/channels/whatsapp/connect` | **404** ❌ | **401** (JWT) |
| Frontend `evolutionUrls[0]` | `https://evolution.api.botflow.ink` ❌ (timeout 5s+) | internal Docker URL |
| Frontend BFF | Evolution **first** ❌ | Backend **first** |

**السبب:** Backend ma tdeployach men `main`. Frontend kaytimeout 3la Evolution URL public.

---

## الحل — 3 خطوات (بالترتيب)

### 1. Backend — Deploy men `main` (CRITICAL)

EasyPanel → **backend** → Source = **GitHub** → `sass-botflow/backend` → `main` → Dockerfile

Copier `easypanel.env.example` — احذف `META_*`.

Deploy 5-10 min, verify:

```bash
curl -s https://api.botflow.ink/health
# modules.whatsapp: true, deployOk: true

curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api.botflow.ink/api/channels/whatsapp/connect
# 401
```

### 2. Frontend — Minimal fix (2 files, ma كتكسّرش diagnostics)

```bash
cd /path/to/sass-botflow/frontend
bash /path/to/backend/patches/apply-frontend-minimal-fix.sh
git add -A
git commit -m "fix: WhatsApp QR backend-first + internal Evolution URL"
git push origin main
```

EasyPanel → **frontend** → Deploy

**Environment (frontend)** — واحد فقط:

```env
EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080
EVOLUTION_API_KEY=BotflowEvolution2026SecureKey!
```

احذف: `https://evolution.api.botflow.ink`, `sass-botflow_botflow-evolution`

### 3. Evolution API — verify running

EasyPanel → **evolution-api** → logs → `AUTHENTICATION_API_KEY` = نفس `EVOLUTION_API_KEY`

---

## Full patches (optional)

Ila bghiti kolchi (hooks, modal, QR instant):

```bash
bash patches/apply-frontend-whatsapp.sh
```

⚠️ Had script kayبدّل 9 files — 3la `main` الحالي خاصك `apply-frontend-minimal-fix.sh` (يحافظ على diagnostics route).

## شنو كيتبدّل ف minimal fix

| File | Fix |
|------|-----|
| `whatsapp-bff.ts` | Backend API أولاً، Evolution fallback |
| `evolution-server.ts` | بلا public URL، internal host فقط |

## تحقق

```bash
curl -s https://www.botflow.ink/api/health | python3 -m json.tool
# evolutionUrls[0] = http://sass-botflow_evolution-api:8080
```

Dashboard → Connect → QR يبان → Scan → Connected
