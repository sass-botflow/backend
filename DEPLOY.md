# BotFlow Backend — Evolution API Deploy

> **Production broken?** See **[PRODUCTION-FIX.md](./PRODUCTION-FIX.md)** if frontend shows `Cannot POST /api/channels/whatsapp/connect`.

WhatsApp integration uses **Evolution API** (WhatsApp Web QR), not Meta Cloud API.

## Architecture

```
Frontend → NestJS Backend → Evolution API → WhatsApp Web
```

## Required env vars (backend)

```env
EVOLUTION_API_URL=http://sass-botflow_evolution-api:8080
EVOLUTION_API_KEY=your-evolution-api-key
EVOLUTION_WEBHOOK_URL=https://api.botflow.ink/webhooks/evolution
JWT_SECRET=<32+ chars>
DATABASE_URL=postgresql://...
```

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/channels/whatsapp/connect` | Create Evolution instance (one per user) |
| GET | `/api/channels/whatsapp/:id/qr` | Base64 QR code |
| GET | `/api/channels/whatsapp/:id/status` | CONNECTED / DISCONNECTED / WAITING_QR / CONNECTING |
| DELETE | `/api/channels/whatsapp/:id` | Delete instance |
| POST | `/api/channels/whatsapp/send` | Send text message |
| POST | `/webhooks/evolution` | Evolution webhooks |

All `/api/channels/whatsapp/*` routes require JWT (`Authorization: Bearer`).

## EasyPanel setup

1. Deploy Evolution API: `deploy/evolution-api/docker-compose.yml`
2. Deploy backend with `easypanel.docker-compose.yml`
3. Set `EVOLUTION_API_URL` to internal Evolution service URL
4. Set `EVOLUTION_API_KEY` same as Evolution `AUTHENTICATION_API_KEY`

## Verify

```bash
bash scripts/verify-whatsapp-stack.sh
```

Expected `/health`:
- `whatsappReady: true`
- `config.evolution.apiUrl: true`
- **no** `config.meta` fields
