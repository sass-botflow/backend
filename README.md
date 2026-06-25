# BotFlow API

Production NestJS backend for [BotFlow](https://botflow.ink) — AI automation platform for WhatsApp, Instagram, TikTok, and Messenger.

| Environment | URL | Port |
|-------------|-----|------|
| Production  | `https://api.botflow.ink` | 8000 |
| Frontend    | `https://botflow.ink` | 3000 |

## Stack

- **NestJS 11** + TypeScript
- **Prisma** + PostgreSQL
- **Redis** for caching/queues
- **JWT** authentication
- **Stripe** subscriptions (Starter / Pro / Agency)
- **Swagger** docs at `/docs`

## Modules

| Module | Path | Description |
|--------|------|-------------|
| Auth | `/api/auth` | Register, login, profile |
| Inbox | `/api/inbox` | Unified multi-channel conversations |
| Bots | `/api/bots` | AI agent builder with workflow nodes |
| CRM | `/api/crm` | Contacts, pipelines, deals |
| Appointments | `/api/appointments` | Booking calendar |
| Analytics | `/api/analytics` | Dashboard KPIs |
| Knowledge | `/api/knowledge` | AI knowledge base |
| Billing | `/api/billing` | Stripe checkout |
| Integrations | `/api/integrations` | Channel connectors |
| Settings | `/api/settings` | Branding, API keys |

## Quick start

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npx prisma db push
npm run dev
```

API: `http://localhost:8000`  
Docs: `http://localhost:8000/docs`

## EasyPanel deployment

**Full guide:** [EASYPANEL.md](./EASYPANEL.md)

### Quick setup

1. Add **PostgreSQL** service in EasyPanel (required)
2. Deploy from branch **`main`** using **Dockerfile**
3. Set environment variables:

```env
NODE_ENV=production
PORT=8000
DATABASE_URL=postgresql://user:pass@postgres-service:5432/botflow
JWT_SECRET=your-secret-min-32-chars
CORS_ORIGIN=https://botflow.ink,https://www.botflow.ink
```

| Setting | Value |
|---------|-------|
| Container port | `8000` |
| Domain | `api.botflow.ink` |
| Branch | `main` |

Test: `https://api.botflow.ink/health`

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full system design.

## Related

- Frontend: https://github.com/sass-botflow/frontend
