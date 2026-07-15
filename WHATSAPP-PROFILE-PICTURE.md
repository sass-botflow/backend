# WhatsApp profile picture f Channels

## شنو تبدّل

منين user يconnecti WhatsApp، card كتبان **tswira dyal profile** (mn WhatsApp) بلا ما تبقى غير logo vert.

Evolution API كيرجع `profilePicUrl` — daba كيتمرّر للـ UI.

## طبّق

```bash
cd /path/to/sass-botflow/frontend
bash /path/to/sass-botflow/backend/patches/apply-frontend-whatsapp.sh
git add -A && git commit -m "feat: show WhatsApp profile picture on connected channel card"
git push
```

EasyPanel → **frontend** → Deploy

## Files

| File | Change |
|------|--------|
| `evolution-server.ts` | `extractProfilePictureUrl()` |
| `evolution-bff-service.ts` | Pass `profilePictureUrl` f status + channels |
| `evolution-types.ts` | Type `profilePictureUrl` |
| `use-whatsapp-evolution.ts` | Map URL f channels |
| `whatsapp-channel-dashboard-card.tsx` | Avatar + badge WhatsApp (b7al Instagram) |
