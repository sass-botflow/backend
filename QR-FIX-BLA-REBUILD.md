# QR ma kaybanch — FIX بلا rebuild frontend 🚀

## المشكل

"Generating QR code..." كيدور بلا نهاية لأن Evolution v2 كيرجع `name` (ماشي `instanceName`).

---

## الحل السريع (5 دقائق) — Evolution Compat Proxy

**ما محتاجش تبدّل كود frontend.** غير deploy service جديد وبدّل env.

### 1) EasyPanel → Add Service

| Field | Value |
|-------|-------|
| Name | `evolution-compat` |
| Source | **Docker Compose** |
| Repo | `sass-botflow/backend` branch `main` |
| Compose file | `deploy/evolution-compat-proxy.compose.yml` |
| Port | `8089` |

**Environment:**
```env
EVOLUTION_API_KEY=BotflowEvolution2026SecureKey!
```

Deploy → استنى **1-2 دقيقة** (خضراء ✅).

### 2) EasyPanel → frontend → Environment

بدّل هاد السطر:
```env
EVOLUTION_API_URL=http://sass-botflow_evolution-compat:8089
```

خلّي `EVOLUTION_API_KEY` كيف ما هو.

**Deploy frontend** (30 ثانية restart كافي).

### 3) Verif

```bash
curl -s https://www.botflow.ink/api/channels/whatsapp/diagnostics
# evolution.ok: true
```

Dashboard → Channels → Connect → **QR khass yban f 5-15 ثانية**.

---

## الحل الكامل (أحسن على المدى الطويل)

طبّق patches على frontend (fix أصلي فالكود):

```bash
cd /path/to/sass-botflow/frontend
bash /path/to/sass-botflow/backend/patches/apply-frontend-whatsapp.sh
git add -A && git commit -m "Fix WhatsApp QR Evolution v2" && git push
```

EasyPanel → frontend → Deploy (3-5 min)

بعدها تقدر ترجع `EVOLUTION_API_URL` مباشرة لـ evolution:
```env
EVOLUTION_API_URL=http://sass-botflow_botflow-evolution:8080
```

---

## Backend 502

`api.botflow.ink` مازال down؟ شوف `DEPLOY-DABA-URGENT.md` — deploy backend بـ `Dockerfile.easypanel` + **Rebuild**.

WhatsApp QR كيخدم حتى backend down (frontend كيتصل بـ Evolution مباشرة).
