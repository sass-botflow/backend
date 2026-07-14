# WhatsApp QR Spinner Fix

## المشكل
- Modal kaybqa "Generating QR code..." bzaf d lw9t
- Evolution v2 كيرجع `name` (ماشي `instanceName`) → frontend ma كيلقاش instance
- Create على instance موجود → 403 → frontend كيعتقد API key غالط

## الحل السريع (بلا rebuild frontend) ⚡

شوف **`QR-FIX-BLA-REBUILD.md`** — deploy `evolution-compat` proxy وبدّل `EVOLUTION_API_URL` ف frontend.

## الحل الكامل (patches frontend)

| File | Fix |
|------|-----|
| `evolution-bff-service.ts` | Connect كيجيب QR فوراً (ماشي background) |
| `evolution-qr-cache.ts` | Cache QR 50s |
| `whatsapp-bff.ts` | ما كيرجعش QR فارغ على errors |
| `use-whatsapp-evolution.ts` | Timeout 25s → error message |
| `evolution-server.ts` | Internal Evolution URL أولاً |
| `connect/route.ts` + `qr/route.ts` | API routes محدثة |

## طبّق على frontend

```bash
cd /path/to/sass-botflow/frontend
bash /path/to/sass-botflow/backend/patches/apply-frontend-whatsapp.sh
git add -A
git commit -m "Fix WhatsApp QR spinner — instant QR display"
git push origin main
```

EasyPanel → **frontend** → Deploy (3-5 min)

## Env (frontend)

```env
EVOLUTION_API_URL=http://sass-botflow_botflow-evolution:8080
EVOLUTION_API_KEY=BotflowEvolution2026SecureKey!
```

## Verif

Dashboard → Connect → QR khass yban f **5-15 ثانية** (ماشي دقائق)
Ila 25s بلا QR → error message واضح
