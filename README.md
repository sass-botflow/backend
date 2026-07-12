# Sass Botflow Backend

REST API backend for the [Sass Botflow](https://github.com/sass-botflow) SaaS platform. Manages users, bots, and automation workflows.

## Stack

- **Node.js** + **TypeScript**
- **Express 5**
- **Prisma** (SQLite by default, PostgreSQL-ready)
- **JWT** authentication

## Quick start

```bash
# Install dependencies
npm install

# Copy environment file and edit secrets
cp .env.example .env

# Create database schema
npm run db:push

# Start dev server (with hot reload)
npm run dev
```

The API runs at `http://localhost:8000`.

Production URL: `https://api.botflow.ink`

## API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check |
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Sign in |
| GET | `/api/auth/instagram` | Yes | Start Meta OAuth (redirects to Instagram) |
| GET | `/api/auth/instagram/callback` | No | OAuth callback (Meta redirect) |
| GET | `/api/bots` | Yes | List your bots |
| POST | `/api/bots` | Yes | Create a bot |
| GET | `/api/bots/:id` | Yes | Get bot details |
| PATCH | `/api/bots/:id` | Yes | Update a bot |
| DELETE | `/api/bots/:id` | Yes | Delete a bot |
| GET | `/api/bots/:botId/workflows` | Yes | List workflows |
| POST | `/api/bots/:botId/workflows` | Yes | Create workflow |
| PATCH | `/api/bots/:botId/workflows/:workflowId` | Yes | Update workflow |
| DELETE | `/api/bots/:botId/workflows/:workflowId` | Yes | Delete workflow |

Protected routes require `Authorization: Bearer <token>`.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8000` | Server port |
| `DATABASE_URL` | — | Prisma connection string |
| `JWT_SECRET` | — | Secret for signing tokens (min 16 chars) |
| `CORS_ORIGIN` | `https://botflow.ink,...` | Comma-separated allowed frontend origins |
| `FRONTEND_URL` | `http://localhost:3000` | Frontend base URL for OAuth redirects |
| `META_APP_ID` | — | Meta app ID (Instagram OAuth) |
| `META_APP_SECRET` | — | Meta app secret |
| `META_REDIRECT_URI` | — | OAuth callback URL (e.g. `https://api.botflow.ink/api/auth/instagram/callback`) |
| `META_GRAPH_API_VERSION` | `v21.0` | Meta Graph API version |

`CORS_ORIGIN` example:

```env
CORS_ORIGIN=https://botflow.ink,https://www.botflow.ink,http://localhost:3000
```

For PostgreSQL in production:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/sass_botflow"
```

Update `provider` in `prisma/schema.prisma` from `sqlite` to `postgresql`.

## EasyPanel deployment

| Service | Domain | Port |
|---------|--------|------|
| Frontend | `botflow.ink` | `3000` |
| Backend | `api.botflow.ink` | `8000` |

### Backend (`api.botflow.ink`)

In EasyPanel, set these environment variables:

```env
NODE_ENV=production
PORT=8000
DATABASE_URL=file:/app/data/prod.db
JWT_SECRET=your-long-random-secret-here
CORS_ORIGIN=https://botflow.ink,https://www.botflow.ink
```

EasyPanel settings:
- **Container port:** `8000`
- **Domain:** `api.botflow.ink`
- **Start command:** `npx prisma db push && node dist/index.js`

### Frontend (`botflow.ink`)

In the frontend repo, set:

```env
VITE_API_URL=https://api.botflow.ink
PORT=3000
```

EasyPanel settings:
- **Container port:** `3000`
- **Domain:** `botflow.ink`

## Docker

```bash
docker compose up --build
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production build |
| `npm run db:push` | Sync schema to database |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |

## Related repos

- Frontend: https://github.com/sass-botflow/frontend
